# Payment & Subscription System

## Overview

Replace the current single shared API key (`PWS_API_KEY`) with per-user API keys tied to subscription tiers. Introduce usage metering, Stripe billing, and tiered rate limits to monetize the extraction API and unblock batch extraction (E1) and multi-property pages (E2).

## Current State

| Component | Today | Limitation |
|-----------|-------|------------|
| Auth | Single `PWS_API_KEY` env var | No user identity, no per-user limits |
| Rate limit | 60 req/min, in-memory | Shared across all users, resets on deploy |
| Billing | None | No revenue path |
| Storage | `RESULTS` KV namespace | Single namespace, no tenant isolation |

## Subscription Tiers

| Tier | Monthly | Rate Limit | Batch | Multi-property | Retained History |
|------|---------|------------|-------|----------------|------------------|
| **Free** | $0 | 30 req/min, 500/day | ❌ | ❌ | 7 days |
| **Starter** | $29 | 120 req/min, 5K/day | ✅ (10 URLs/batch) | ❌ | 30 days |
| **Pro** | $79 | 300 req/min, 25K/day | ✅ (50 URLs/batch) | ✅ | 90 days |
| **Enterprise** | Custom | Custom | ✅ (unlimited) | ✅ | 365 days |

---

## Architecture

### Data Model

```
KV Keys:
  apikey:{key}          → { userId, tier, createdAt, active, label }
  user:{userId}         → { email, name, stripeCustomerId, tier, keys: string[] }
  usage:{userId}:{date} → { extractions: number, bytes: number }
  usage-month:{userId}:{month} → { total: number }
```

### Components

#### 1. API Key Management Service

**File**: `src/lib/services/api-key-service.ts`

- `generateApiKey(userId, label?)` → creates prefixed key (`pws_live_...`, `pws_test_...`)
- `validateApiKey(key)` → returns `{ userId, tier, limits }` or null
- `revokeApiKey(key)` → soft-delete (marks inactive)
- `listUserKeys(userId)` → all keys for a user
- Key format: `pws_live_{32 random hex}` (44 chars total)
- Keys stored as SHA-256 hashes in KV; raw key only shown at creation

#### 2. Usage Metering Service

**File**: `src/lib/services/usage-meter.ts`

- `recordUsage(userId, type, metadata)` → increment daily counter
- `getUsage(userId, period)` → daily/monthly aggregates
- `checkQuota(userId)` → compare usage against tier limits
- Daily counters stored in KV with `expirationTtl` matching history retention
- Monthly rollups computed lazily on read or via scheduled cron

#### 3. Stripe Integration

**File**: `src/lib/services/stripe-service.ts`

- `createCheckoutSession(userId, tier)` → Stripe Checkout redirect
- `handleWebhook(event)` → process `checkout.session.completed`, `invoice.paid`, `customer.subscription.deleted`
- `getSubscription(userId)` → current plan + status
- `cancelSubscription(userId)` → cancel at period end

**Webhook endpoint**: `POST /public_api/v1/stripe-webhook`

#### 4. Tiered Rate Limiter (replaces current)

**File**: `src/lib/services/rate-limiter.ts` (modify)

```diff
- const DEFAULT_MAX_REQUESTS = 60;
+ function getMaxRequests(tier: string): number {
+   const limits = { free: 30, starter: 120, pro: 300, enterprise: 1000 };
+   return limits[tier] || 30;
+ }
```

- Rate limits keyed by `userId` instead of IP/API key
- Daily quota checks via `usage-meter.ts`
- KV-backed counters for cross-isolate consistency

#### 5. Auth Middleware (replaces current)

**File**: `src/lib/services/auth.ts` (modify)

```diff
- const expectedKey = import.meta.env.PWS_API_KEY || '';
+ const keyInfo = await validateApiKey(providedKey);
+ if (!keyInfo) return { authorized: false, ... };
+ return { authorized: true, userId: keyInfo.userId, tier: keyInfo.tier };
```

- Backwards compatible: if `PWS_API_KEY` is set, it acts as a master key
- Per-user keys checked via `api-key-service.ts`
- Returns `userId` and `tier` for downstream use

---

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/public_api/v1/auth/register` | Create account (email + password) |
| POST | `/public_api/v1/auth/login` | Get session token |
| GET | `/public_api/v1/auth/keys` | List API keys |
| POST | `/public_api/v1/auth/keys` | Generate new API key |
| DELETE | `/public_api/v1/auth/keys?id=...` | Revoke key |
| GET | `/public_api/v1/usage` | Current usage stats |
| POST | `/public_api/v1/billing/checkout` | Start Stripe Checkout |
| POST | `/public_api/v1/billing/portal` | Stripe Customer Portal link |
| POST | `/public_api/v1/stripe-webhook` | Stripe webhook handler |

## Admin Dashboard

Add to `/admin`:
- **Users page**: list users, tiers, usage
- **Revenue page**: MRR, churn, active subscriptions
- **Usage page**: daily/monthly extraction volume graphs

---

## Implementation Phases

### Phase 1: API Keys & Tiers (no payment yet)
1. `api-key-service.ts` — key CRUD with KV storage
2. Modify `auth.ts` — per-user key validation
3. Modify `rate-limiter.ts` — tier-based limits
4. Admin UI for creating/managing keys manually
5. Migration: existing `PWS_API_KEY` users get a "legacy" key

### Phase 2: Usage Metering
1. `usage-meter.ts` — daily counters
2. Wire into `listings.ts` POST handler
3. `/public_api/v1/usage` endpoint
4. Daily quota enforcement

### Phase 3: Stripe Billing
1. `stripe-service.ts` — checkout, webhook, portal
2. `stripe-webhook` endpoint
3. Automatic tier upgrades/downgrades on subscription events
4. Self-service signup page

### Phase 4: Unlock E1 & E2
1. Batch extraction API (Starter+ only)
2. Multi-property page support (Pro+ only)
3. Tier gate checks in request handlers

---

## Environment Variables

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
```

## KV Namespace Requirements

Add a second KV namespace for user/billing data:

```jsonc
// wrangler.jsonc
"kv_namespaces": [
  { "binding": "RESULTS", "id": "..." },
  { "binding": "USERS", "id": "..." }
]
```

## Security Considerations

- API keys stored as SHA-256 hashes (never plaintext)
- Stripe webhook signature verification (`stripe.webhooks.constructEvent`)
- Rate limiting applied before key validation to prevent enumeration
- Key rotation: users can create multiple keys, revoke old ones
- HMAC-based session tokens for authenticated endpoints
