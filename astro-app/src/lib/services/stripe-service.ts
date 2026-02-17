/**
 * Stripe Billing Service
 *
 * Handles Stripe integration for subscription management:
 *   - Checkout session creation for plan upgrades
 *   - Webhook processing for subscription lifecycle events
 *   - Customer portal session creation
 *   - Automatic tier sync on plan changes
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY
 *   STRIPE_WEBHOOK_SECRET
 *   STRIPE_PRICE_STARTER  (Stripe Price ID for Starter plan)
 *   STRIPE_PRICE_PRO      (Stripe Price ID for Pro plan)
 */

import { updateUserTier, getUser, createUser } from './api-key-service.js';
import type { SubscriptionTier } from './api-key-service.js';

// ─── Stripe price → tier mapping ────────────────────────────────

let PRICE_TO_TIER: Record<string, SubscriptionTier> = {};

function initPriceTierMap(): void {
  const starterPrice = import.meta.env.STRIPE_PRICE_STARTER || '';
  const proPrice = import.meta.env.STRIPE_PRICE_PRO || '';

  PRICE_TO_TIER = {};
  if (starterPrice) PRICE_TO_TIER[starterPrice] = 'starter';
  if (proPrice) PRICE_TO_TIER[proPrice] = 'pro';
}

function getTierForPrice(priceId: string): SubscriptionTier {
  initPriceTierMap();
  return PRICE_TO_TIER[priceId] || 'free';
}

// ─── Stripe API helpers ─────────────────────────────────────────

function getStripeKey(): string {
  return import.meta.env.STRIPE_SECRET_KEY || '';
}

function getWebhookSecret(): string {
  return import.meta.env.STRIPE_WEBHOOK_SECRET || '';
}

async function stripeRequest(
  path: string,
  method: 'GET' | 'POST' | 'DELETE' = 'POST',
  body?: Record<string, string>,
): Promise<any> {
  const key = getStripeKey();
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  const options: RequestInit = { method, headers };
  if (body && method === 'POST') {
    options.body = new URLSearchParams(body).toString();
  }

  const response = await fetch(`https://api.stripe.com/v1${path}`, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Stripe API error: ${data.error?.message || response.statusText}`);
  }

  return data;
}

// ─── Webhook signature verification ─────────────────────────────

/**
 * Verify Stripe webhook signature using the raw body.
 * Uses the `stripe-signature` header and HMAC-SHA256.
 */
export async function verifyWebhookSignature(
  payload: string,
  signature: string,
): Promise<boolean> {
  const secret = getWebhookSecret();
  if (!secret) return false;

  const parts = signature.split(',');
  const tsStr = parts.find(p => p.startsWith('t='))?.slice(2);
  const v1Sigs = parts.filter(p => p.startsWith('v1=')).map(p => p.slice(3));

  if (!tsStr || v1Sigs.length === 0) return false;

  // Check timestamp tolerance (5 minutes)
  const ts = parseInt(tsStr, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > 300) return false;

  // Compute expected signature
  const signedPayload = `${tsStr}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
  const expectedSig = Array.from(new Uint8Array(sigBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return v1Sigs.some(sig => sig === expectedSig);
}

// ─── Checkout ───────────────────────────────────────────────────

export interface CheckoutOptions {
  userId: string;
  email: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}

/**
 * Create a Stripe Checkout session for a plan upgrade.
 */
export async function createCheckoutSession(
  options: CheckoutOptions,
): Promise<{ sessionId: string; url: string }> {
  // Check if user already has a Stripe customer
  const user = await getUser(options.userId);
  const params: Record<string, string> = {
    'mode': 'subscription',
    'line_items[0][price]': options.priceId,
    'line_items[0][quantity]': '1',
    'success_url': options.successUrl,
    'cancel_url': options.cancelUrl,
    'client_reference_id': options.userId,
    'metadata[user_id]': options.userId,
  };

  if (user?.stripeCustomerId) {
    params['customer'] = user.stripeCustomerId;
  } else {
    params['customer_email'] = options.email;
  }

  const session = await stripeRequest('/checkout/sessions', 'POST', params);

  return { sessionId: session.id, url: session.url };
}

// ─── Customer Portal ────────────────────────────────────────────

/**
 * Create a Stripe Customer Portal session for managing billing.
 */
export async function createPortalSession(
  userId: string,
  returnUrl: string,
): Promise<{ url: string }> {
  const user = await getUser(userId);
  if (!user?.stripeCustomerId) {
    throw new Error('No Stripe customer found. Please subscribe first.');
  }

  const session = await stripeRequest('/billing_portal/sessions', 'POST', {
    customer: user.stripeCustomerId,
    return_url: returnUrl,
  });

  return { url: session.url };
}

// ─── Webhook event processing ───────────────────────────────────

export interface WebhookResult {
  handled: boolean;
  action?: string;
  userId?: string;
  tier?: SubscriptionTier;
  error?: string;
}

/**
 * Process a Stripe webhook event.
 * Handles subscription lifecycle events and syncs tier accordingly.
 */
export async function handleWebhookEvent(event: {
  type: string;
  data: { object: any };
}): Promise<WebhookResult> {
  switch (event.type) {
    case 'checkout.session.completed':
      return handleCheckoutCompleted(event.data.object);

    case 'customer.subscription.updated':
      return handleSubscriptionUpdated(event.data.object);

    case 'customer.subscription.deleted':
      return handleSubscriptionDeleted(event.data.object);

    case 'invoice.payment_failed':
      return handlePaymentFailed(event.data.object);

    default:
      return { handled: false, action: `ignored: ${event.type}` };
  }
}

async function handleCheckoutCompleted(session: any): Promise<WebhookResult> {
  const userId = session.client_reference_id || session.metadata?.user_id;
  if (!userId) return { handled: false, error: 'No user_id in checkout session' };

  const customerId = session.customer;
  const subscriptionId = session.subscription;

  // Ensure user exists
  let user = await getUser(userId);
  if (!user) {
    user = await createUser(userId, session.customer_email || '');
  }

  // Store Stripe IDs
  user.stripeCustomerId = customerId;
  user.stripeSubscriptionId = subscriptionId;

  // Determine tier from subscription items
  let tier: SubscriptionTier = 'starter'; // default for new checkout
  if (subscriptionId) {
    try {
      const sub = await stripeRequest(`/subscriptions/${subscriptionId}`, 'GET');
      const priceId = sub.items?.data?.[0]?.price?.id;
      if (priceId) tier = getTierForPrice(priceId);
    } catch {
      // Can't fetch sub, default to starter
    }
  }

  await updateUserTier(userId, tier);
  return { handled: true, action: 'checkout_completed', userId, tier };
}

async function handleSubscriptionUpdated(subscription: any): Promise<WebhookResult> {
  const customerId = subscription.customer;
  const priceId = subscription.items?.data?.[0]?.price?.id;
  if (!priceId) return { handled: false, error: 'No price_id in subscription' };

  const tier = getTierForPrice(priceId);

  // Find user by customerId (search through our users)
  // For now, use metadata
  const userId = subscription.metadata?.user_id;
  if (!userId) return { handled: false, error: 'No user_id in subscription metadata' };

  await updateUserTier(userId, tier);
  return { handled: true, action: 'subscription_updated', userId, tier };
}

async function handleSubscriptionDeleted(subscription: any): Promise<WebhookResult> {
  const userId = subscription.metadata?.user_id;
  if (!userId) return { handled: false, error: 'No user_id in subscription metadata' };

  await updateUserTier(userId, 'free');
  return { handled: true, action: 'subscription_deleted', userId, tier: 'free' };
}

async function handlePaymentFailed(invoice: any): Promise<WebhookResult> {
  const userId = invoice.metadata?.user_id || invoice.subscription_details?.metadata?.user_id;
  // Don't downgrade immediately; Stripe will retry.
  // Just log the event.
  return {
    handled: true,
    action: 'payment_failed',
    userId: userId || 'unknown',
  };
}
