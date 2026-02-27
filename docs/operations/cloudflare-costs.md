# Cloudflare Cost Controls

This document describes the KV cost surface, optimizations applied, and how
to monitor for unexpected bills.

## Deployment Model

- **Platform:** Cloudflare Pages (SSR via `@astrojs/cloudflare`)
- **Storage:** Single KV namespace (`RESULTS`) for all data
- **No other paid primitives:** No Workers (standalone), Durable Objects, R2,
  or Analytics Engine

## KV Operations Per Request

Each extraction is the most expensive operation. Here's what happens:

| Operation | KV Reads | KV Writes | Notes |
|-----------|----------|-----------|-------|
| Quota check (`checkDailyQuota`) | **0-1** | 0 | Cached in memory for 60s |
| API key validation | **0-1** | 0 | Cached in memory for 5 min |
| Listing store (dedup check) | 1 | 1 | 1-hour TTL |
| Diagnostics store | 0 | 1 | 1-hour TTL |
| Scrape metadata | 1 | 2-3 | 1-year TTL, max 50 per listing |
| Price history | 1 | 0-1 | Only writes when price changes |
| Usage meter (record) | 1 | 1 | 90-day TTL |
| **Total per extraction** | **~4-5** | **~5-6** | ~10 ops total |

Before the caching optimizations, quota checks alone cost 1 KV read per
request and the full usage summary read 30 KV keys. API key validation added
another 1-2 reads per request.

## Cost Optimizations Applied

### 1. Usage meter cache (60s TTL)

**File:** `src/lib/services/usage-meter.ts`

`getTodayUsage()` is the hot path — called by `checkDailyQuota()` on every
authenticated extraction. We cache the result in memory for 60 seconds.

- **Before:** 1 KV read per request
- **After:** 1 KV read per 60 seconds per user
- **Savings at 500 req/day:** ~498 reads/day saved

`recordUsage()` updates the cache on write so the count stays fresh without
an extra read.

The full 30-day `getUsage()` (used only by the `/usage` summary endpoint) is
**not cached** — it's called rarely and correctness matters more there.

### 2. API key validation cache (5 min TTL)

**File:** `src/lib/services/api-key-service.ts`

`validateApiKey()` hashes the raw key and looks up the hash in KV. We cache
the result (including null for invalid keys) for 5 minutes.

- **Before:** 1-2 KV reads per request (key record + user record)
- **After:** 1-2 KV reads per 5 min per distinct key
- **Trade-off:** Key revocations take up to 5 min to propagate

Cache is invalidated immediately when `revokeApiKey()` is called on the same
Worker isolate (covers the common case of revoking via the admin UI).

### 3. Webhook registration limit (max 20)

**File:** `src/lib/services/webhook-service.ts`

`registerWebhook()` now throws when the limit is reached. This prevents
unbounded KV growth from the webhook index + individual webhook records.

`listWebhooks()` iterates the index, reading each webhook from KV. Without a
cap, a malicious actor could register thousands of webhooks and make every
`fireWebhooks()` call read thousands of KV keys.

## Bounded Data Structures

All KV-backed collections have explicit limits:

| Collection | Max Items | TTL | Enforced In |
|------------|-----------|-----|-------------|
| Haul scrapes | 20 | 30 days | `haul-store.ts` |
| Scrapes per listing | 50 | 1 year | `scrape-metadata.ts` |
| Portal history entries | 100 | 1 year | `scrape-metadata.ts` |
| Price history per URL | 100 | 1 year | `price-history.ts` |
| Export history per user | 200 | 30 days | `export-history.ts` |
| Webhooks | 20 | none (manual) | `webhook-service.ts` |
| Usage records | unbounded | 90 days auto | `usage-meter.ts` |
| Listing cache | unbounded | 1 hour auto | `listing-store.ts` |

## Cloudflare Free Tier Limits (as of 2025)

- **KV reads:** 100,000/day
- **KV writes:** 1,000/day
- **KV storage:** 1 GB

At ~10 KV ops per extraction (with caching), the free tier supports roughly
**10,000 extractions/day** before hitting read limits. Write limits (1,000/day)
are the actual bottleneck on the free plan — roughly **170 extractions/day**.

The paid Workers plan ($5/month) includes 10M KV reads and 1M writes per month.

## Monitoring

Watch these in the Cloudflare dashboard under **Workers & Pages > KV**:

1. **Daily KV reads** — should stay well under your plan limit
2. **Daily KV writes** — the tighter constraint on free tier
3. **Storage size** — 1-hour listing TTL prevents runaway growth

If reads spike unexpectedly, check:
- Is `getUsage()` being called on a high-traffic path? (It does 30 reads)
- Are webhook deliveries iterating a large webhook list?
- Is the validation cache being cleared too often? (Worker restarts reset it)
