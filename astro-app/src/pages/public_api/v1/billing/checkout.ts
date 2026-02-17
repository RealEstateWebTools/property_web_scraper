/**
 * POST /public_api/v1/billing/checkout
 *
 * Creates a Stripe Checkout session for upgrading to a paid plan.
 * Body: { plan: "starter" | "pro", success_url: string, cancel_url: string }
 */

import type { APIRoute } from 'astro';
import { authenticateApiKey } from '@lib/services/auth.js';
import { checkRateLimit } from '@lib/services/rate-limiter.js';
import {
  errorResponse, successResponse, corsPreflightResponse,
  ApiErrorCode,
} from '@lib/services/api-response.js';
import { createCheckoutSession } from '@lib/services/stripe-service.js';
import { getUser } from '@lib/services/api-key-service.js';

export const OPTIONS: APIRoute = ({ request }) => corsPreflightResponse(request);

export const POST: APIRoute = async ({ request }) => {
  const auth = await authenticateApiKey(request);
  if (!auth.authorized) return auth.errorResponse!;

  const rateCheck = checkRateLimit(request, auth.tier, auth.userId);
  if (!rateCheck.allowed) return rateCheck.errorResponse!;

  if (!auth.userId || auth.userId === 'anonymous') {
    return errorResponse(
      ApiErrorCode.UNAUTHORIZED,
      'Checkout requires authentication with a personal API key',
      request,
    );
  }

  let body: { plan?: string; success_url?: string; cancel_url?: string };
  try {
    body = await request.json();
  } catch {
    return errorResponse(ApiErrorCode.INVALID_REQUEST, 'Invalid JSON body', request);
  }

  const { plan, success_url, cancel_url } = body;

  if (!plan || !['starter', 'pro'].includes(plan)) {
    return errorResponse(
      ApiErrorCode.INVALID_REQUEST,
      'Invalid plan. Must be "starter" or "pro".',
      request,
    );
  }

  if (!success_url || !cancel_url) {
    return errorResponse(
      ApiErrorCode.INVALID_REQUEST,
      'Missing success_url or cancel_url',
      request,
    );
  }

  const priceId = plan === 'starter'
    ? (import.meta.env.STRIPE_PRICE_STARTER || '')
    : (import.meta.env.STRIPE_PRICE_PRO || '');

  if (!priceId) {
    return errorResponse(
      ApiErrorCode.INTERNAL_ERROR,
      `Stripe price not configured for plan: ${plan}`,
      request,
    );
  }

  const user = await getUser(auth.userId);

  try {
    const session = await createCheckoutSession({
      userId: auth.userId,
      email: user?.email || '',
      priceId,
      successUrl: success_url,
      cancelUrl: cancel_url,
    });

    return successResponse({ checkout: session }, request);
  } catch (err) {
    return errorResponse(
      ApiErrorCode.INTERNAL_ERROR,
      `Checkout failed: ${err instanceof Error ? err.message : 'unknown error'}`,
      request,
    );
  }
};
