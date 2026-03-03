import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock api-key-service for handleWebhookEvent tests
vi.mock('../../src/lib/services/api-key-service.js', () => {
  const users = new Map<string, any>();
  return {
    getUser: vi.fn(async (id: string) => users.get(id) || null),
    createUser: vi.fn(async (id: string, email: string) => {
      const user = { userId: id, email, tier: 'free', keyHashes: [] };
      users.set(id, user);
      return user;
    }),
    updateUserTier: vi.fn(async (id: string, tier: string) => {
      const user = users.get(id);
      if (!user) return false;
      user.tier = tier;
      return true;
    }),
    setStripeBillingInfo: vi.fn(async (id: string, customerId: string, subscriptionId?: string) => {
      const user = users.get(id);
      if (!user) return false;
      user.stripeCustomerId = customerId;
      if (subscriptionId) user.stripeSubscriptionId = subscriptionId;
      return true;
    }),
    resetMockUsers: () => users.clear(),
    _users: users,
  };
});

import { handleWebhookEvent, verifyWebhookSignature, createCheckoutSession } from '../../src/lib/services/stripe-service.js';
import { updateUserTier, createUser, setStripeBillingInfo } from '../../src/lib/services/api-key-service.js';

// Access mock internals
const mockModule = await import('../../src/lib/services/api-key-service.js') as any;

describe('stripe-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockModule.resetMockUsers?.();
    // Pre-seed env
    import.meta.env.STRIPE_PRICE_STARTER = 'price_starter_test';
    import.meta.env.STRIPE_PRICE_PRO = 'price_pro_test';
    import.meta.env.STRIPE_SECRET_KEY = '';
    import.meta.env.STRIPE_WEBHOOK_SECRET = '';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('handleWebhookEvent', () => {
    it('handles checkout.session.completed → creates user + upgrades tier', async () => {
      const result = await handleWebhookEvent({
        type: 'checkout.session.completed',
        data: {
          object: {
            client_reference_id: 'user-stripe-1',
            customer: 'cus_xxx',
            subscription: null, // skip sub fetch
            customer_email: 'test@example.com',
          },
        },
      });

      expect(result.handled).toBe(true);
      expect(result.action).toBe('checkout_completed');
      expect(result.userId).toBe('user-stripe-1');
      expect(createUser).toHaveBeenCalledWith('user-stripe-1', 'test@example.com');
      expect(setStripeBillingInfo).toHaveBeenCalledWith('user-stripe-1', 'cus_xxx', null);
    });

    it('handles customer.subscription.updated → syncs tier', async () => {
      // Pre-create user
      mockModule._users.set('user-sub-1', { userId: 'user-sub-1', tier: 'free' });

      const result = await handleWebhookEvent({
        type: 'customer.subscription.updated',
        data: {
          object: {
            customer: 'cus_yyy',
            metadata: { user_id: 'user-sub-1' },
            items: {
              data: [{ price: { id: 'price_pro_test' } }],
            },
          },
        },
      });

      expect(result.handled).toBe(true);
      expect(result.action).toBe('subscription_updated');
      expect(result.tier).toBe('pro');
      expect(updateUserTier).toHaveBeenCalledWith('user-sub-1', 'pro');
    });

    it('handles customer.subscription.deleted → downgrades to free', async () => {
      mockModule._users.set('user-del-1', { userId: 'user-del-1', tier: 'pro' });

      const result = await handleWebhookEvent({
        type: 'customer.subscription.deleted',
        data: {
          object: {
            metadata: { user_id: 'user-del-1' },
          },
        },
      });

      expect(result.handled).toBe(true);
      expect(result.action).toBe('subscription_deleted');
      expect(result.tier).toBe('free');
      expect(updateUserTier).toHaveBeenCalledWith('user-del-1', 'free');
    });

    it('handles invoice.payment_failed → logs but does not downgrade', async () => {
      const result = await handleWebhookEvent({
        type: 'invoice.payment_failed',
        data: {
          object: {
            metadata: { user_id: 'user-pay-1' },
          },
        },
      });

      expect(result.handled).toBe(true);
      expect(result.action).toBe('payment_failed');
      expect(updateUserTier).not.toHaveBeenCalled();
    });

    it('ignores unknown event types', async () => {
      const result = await handleWebhookEvent({
        type: 'charge.refunded',
        data: { object: {} },
      });

      expect(result.handled).toBe(false);
      expect(result.action).toContain('ignored');
    });

    it('returns error when checkout session has no user_id', async () => {
      const result = await handleWebhookEvent({
        type: 'checkout.session.completed',
        data: {
          object: {
            customer: 'cus_zzz',
            subscription: null,
          },
        },
      });

      expect(result.handled).toBe(false);
      expect(result.error).toContain('No user_id');
    });
  });

  describe('verifyWebhookSignature', () => {
    it('returns false when no webhook secret configured', async () => {
      import.meta.env.STRIPE_WEBHOOK_SECRET = '';
      const valid = await verifyWebhookSignature('{}', 't=123,v1=abc');
      expect(valid).toBe(false);
    });

    it('returns false for malformed signature', async () => {
      import.meta.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
      const valid = await verifyWebhookSignature('{}', 'bad-signature');
      expect(valid).toBe(false);
    });

    it('returns false for expired timestamp', async () => {
      import.meta.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
      const oldTs = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
      const valid = await verifyWebhookSignature('{}', `t=${oldTs},v1=fakesig`);
      expect(valid).toBe(false);
    });

    it('validates correct signature', async () => {
      const secret = 'whsec_test_secret_key';
      import.meta.env.STRIPE_WEBHOOK_SECRET = secret;

      const payload = '{"test":"data"}';
      const ts = Math.floor(Date.now() / 1000);
      const signedPayload = `${ts}.${payload}`;

      // Compute expected HMAC
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

      const signature = `t=${ts},v1=${expectedSig}`;
      const valid = await verifyWebhookSignature(payload, signature);
      expect(valid).toBe(true);
    });
  });

  describe('createCheckoutSession', () => {
    it('includes subscription metadata user_id for downstream webhooks', async () => {
      import.meta.env.STRIPE_SECRET_KEY = 'sk_test_123';
      import.meta.env.STRIPE_PRICE_STARTER = 'price_starter_test';

      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response(JSON.stringify({ id: 'cs_test_123', url: 'https://checkout.stripe.test/session' }), { status: 200 }))
      );

      await createCheckoutSession({
        userId: 'user-meta-1',
        email: 'meta@example.com',
        priceId: 'price_starter_test',
        successUrl: 'https://app.example.com/success',
        cancelUrl: 'https://app.example.com/cancel',
      });

      const fetchMock = vi.mocked(fetch);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = String(init.body || '');
      expect(body).toContain('subscription_data%5Bmetadata%5D%5Buser_id%5D=user-meta-1');
    });
  });
});
