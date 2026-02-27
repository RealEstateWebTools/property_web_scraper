# Persistence Architecture Audit

Date: 2026-02-20

This document catalogues structural problems in the data persistence layer
and proposes concrete fixes. It was produced from a full audit of every
service in `src/lib/services/`.

---

## Background: How Persistence Works Today

The app runs on Cloudflare Pages (SSR). Each HTTP request may execute in a
different Worker isolate with its own JavaScript heap. Three storage tiers
are used:

| Tier | Scope | Latency | Durability |
|------|-------|---------|------------|
| In-memory Maps | Single isolate only | <1ms | Lost on isolate reallocation |
| Cloudflare KV | Cross-isolate, single namespace (`RESULTS`) | 1-5ms | Durable until TTL expiry |
| Firestore | Global, no TTL | 50-200ms | Permanent |

Every service follows the same pattern: a module-level `let kv` variable,
an `initXxxKV(binding)` function that must be called per-request, and one
or more in-memory Maps as a fast cache. The KV binding comes from
`Astro.locals.runtime.env.RESULTS` (production) or `DevKV` (local dev).

---

## Issue 1: Four Services Have KV Init Functions That Are Never Called

**Severity: Critical**

These services define `initXxxKV()` but no endpoint ever calls them. Their
`kv` variable is always `null`, so all data lives only in the per-isolate
in-memory Map and is lost between requests in production.

| Service | Init function | File |
|---------|--------------|------|
| Price history | `initPriceHistoryKV()` | `price-history.ts:59` |
| Webhooks | `initWebhookKV()` | `webhook-service.ts:51` |
| Export history | `initExportHistoryKV()` | `export-history.ts:21` |
| Usage meter | `initUsageKV()` | `usage-meter.ts:59` |

Additionally, `initUsersKV()` in `api-key-service.ts:51` is never called.

`initScrapeMetadataKV()` is called in 6 Astro page endpoints but **not** in
`extraction-runner.ts`, which calls `recordScrapeAndUpdatePortal()`. So
scrape metadata recorded via the public API or haul scrapes endpoint is
memory-only.

**Impact:**
- Price history is silently discarded on every request.
- Webhook registrations disappear on isolate reallocation.
- Export history is ephemeral.
- Usage metering and quota enforcement are per-isolate; attackers can bypass
  quotas by having requests hit different isolates.
- API key validation never reaches KV; the 5-minute cache documented in
  `cloudflare-costs.md` is not operative.

### Proposed fix: Centralized init in middleware

Replace the per-endpoint init ceremony with a single function called from
`middleware.ts`. This eliminates the "forgot to init" failure class.

**New file: `src/lib/services/kv-init.ts`**

```typescript
import { resolveKV } from './kv-resolver.js';
import { initKV } from './listing-store.js';
import { initHaulKV } from './haul-store.js';
import { initScrapeMetadataKV } from './scrape-metadata.js';
import { initPriceHistoryKV } from './price-history.js';
import { initWebhookKV } from './webhook-service.js';
import { initExportHistoryKV } from './export-history.js';
import { initUsageKV } from './usage-meter.js';
import { initUsersKV } from './api-key-service.js';

export function initAllKV(locals: unknown): void {
  const binding = resolveKV(locals);
  initKV(binding);
  initHaulKV(binding);
  initScrapeMetadataKV(binding);
  initPriceHistoryKV(binding);
  initWebhookKV(binding);
  initExportHistoryKV(binding);
  initUsageKV(binding);
  initUsersKV(binding);
}
```

**Modified: `src/middleware.ts`**

```typescript
import { initAllKV } from '@lib/services/kv-init.js';

export const onRequest: MiddlewareHandler = async (context, next) => {
  validateEnv();
  initAllKV(context.locals);
  // ... rest unchanged
};
```

After this change, individual `initKV(resolveKV(locals))` calls in
endpoints become redundant and can be removed in a follow-up cleanup.

---

## Issue 2: Hauls Have No Firestore Fallback

**Severity: Critical**

Hauls are stored in KV with a 30-day TTL and in an in-memory Map. There is
no Firestore persistence. When the KV entry expires, the haul and all its
scrapes are permanently lost.

| Data | KV TTL | Firestore backup |
|------|--------|-----------------|
| Hauls | 30 days | None |
| Haul scrapes | 30 days (part of haul JSON) | None |

**Impact:** Users who create a haul and revisit it after 30 days find it
gone with no recovery path. The haul page shows "not found".

### Proposed fix: Firestore write-through for hauls

Add Firestore persistence alongside KV. KV remains the fast read path;
Firestore is the durable source of truth.

Changes to `haul-store.ts`:

1. **On create/update**: After `kv.put()`, also write to Firestore
   collection `hauls/{id}`. Use fire-and-forget with error logging (not
   silent swallowing).

2. **On read (`getHaul`)**: Add Firestore as a third fallback tier:
   ```
   in-memory Map → KV → Firestore
   ```
   If found in Firestore, repopulate KV (with remaining TTL) and memory.

3. **Expiration**: Keep the 30-day TTL on KV for cache eviction. In
   Firestore, store `expiresAt` as a field and enforce it on read (or use
   Firestore TTL policies). This way KV acts as a cache and Firestore
   retains the data for longer-term access.

The haul JSON is small (max 20 scrapes, ~50KB worst case), so Firestore
document size limits are not a concern.

---

## Issue 3: Price History Has No Firestore Fallback

**Severity: Critical**

Price history snapshots are stored in KV with a 1-year TTL and in an
in-memory Map. There is no Firestore persistence. Additionally, per Issue 1,
`initPriceHistoryKV()` is never called, so price history is actually
memory-only today.

| Data | KV TTL | Firestore backup |
|------|--------|-----------------|
| Price snapshots | 1 year | None |
| Price index | 1 year | None |

**Impact:** All price history is discarded between requests. Even after
fixing Issue 1, snapshots older than 1 year are permanently lost.

### Proposed fix: Firestore subcollection for price history

Store snapshots in `listings/{listingId}/price_history/{timestamp}`. Each
document is small (~200 bytes). Firestore's free tier allows 50K reads and
20K writes per day.

On read, check KV first (fast), fall back to Firestore (durable). On write,
write to both KV and Firestore.

---

## Issue 4: Webhooks Stored in KV With No TTL

**Severity: High**

`webhook-service.ts` calls `kv.put()` without an `expirationTtl` option.
Webhook registrations persist in KV indefinitely. While there is a max-20
registration limit, abandoned webhooks are never cleaned up.

```typescript
// webhook-service.ts — no expirationTtl
await kv.put(`${KV_PREFIX}${registration.id}`, JSON.stringify(registration));
```

The webhook index (`webhook-index` key) grows monotonically as webhooks are
registered, even if they are later revoked (the index is rewritten on
each register/revoke, but stale IDs can accumulate if revocation code has
bugs).

**Impact:** KV storage grows without bound. On the free tier (1 GB limit),
this is unlikely to be a problem at current scale, but it is architecturally
unsound.

### Proposed fix

1. Add a 90-day `expirationTtl` to webhook KV entries.
2. Add a `lastDeliveredAt` field. Webhooks with no successful delivery in
   90 days are auto-pruned on the next `listWebhooks()` call.
3. Consider Firestore as the primary store for webhooks (small dataset,
   needs durability more than speed).

---

## Issue 5: Rate Limiting Is Per-Isolate Only

**Severity: High**

Two rate limiters use in-memory Maps:

| Limiter | Location | Limit | Scope |
|---------|----------|-------|-------|
| Haul creation | `hauls.ts:8` | 5/hour per IP | Per-isolate |
| API rate limiter | `rate-limiter.ts:34-37` | Per-minute + daily | Per-isolate |

On Cloudflare Workers, requests from the same IP can hit different isolates.
Each isolate maintains its own counter, so the effective limit is
`N * (number of isolates)`.

**Impact:** Rate limits are trivially bypassable in production. An attacker
can create unlimited hauls or exhaust API quotas.

### Proposed fix

Move rate limit counters to KV. Use atomic KV reads/writes per IP:

```
rate:{ip}:{window} → { count: number, expiresAt: number }
```

KV reads are cheap (free tier: 100K/day). One read + one write per
rate-limited request is acceptable. For the haul creation limiter (low
volume), this is straightforward. For the per-minute API limiter, the 60s
in-memory usage cache already provides some tolerance; augment it with a
KV-backed daily counter.

Alternatively, use Cloudflare's built-in rate limiting (available on the
paid plan) for the API endpoints, and keep the in-memory limiter as a
best-effort local guard.

---

## Issue 6: Fire-and-Forget Patterns Silently Lose Data

**Severity: High**

Several places in `extraction-runner.ts` use `.catch(() => {})` to
swallow errors from important operations:

```typescript
// extraction-runner.ts:143
recordSnapshot({...}).catch(() => { /* price history failure */ });

// extraction-runner.ts:155
recordScrapeAndUpdatePortal({...}).catch(() => { /* scrape metadata failure */ });

// extraction-runner.ts:123
try { await listing.save(); } catch { /* Firestore unavailable */ }
```

These failures are invisible. There are no logs, no metrics, no alerts.

Other instances:
- `listings.ts:431` — webhook delivery failures swallowed by
  `Promise.allSettled()`
- `listing-store.ts:102,149` — Firestore `Listing.find()` failures
  return `undefined` silently

**Impact:** Data loss goes undetected. Operators have no way to know that
price history, scrape metadata, or Firestore persistence is failing.

### Proposed fix

Replace silent `.catch(() => {})` with `.catch((err) => console.error(...))`.
This is the minimum viable improvement — errors become visible in Cloudflare
logs. A more robust approach is an async error buffer that collects failures
and surfaces them via an admin endpoint or periodic summary log.

Do NOT change the control flow (the extraction response should still succeed
even if ancillary writes fail). Only add observability.

---

## Issue 7: TTL Mismatches Between Related Data

**Severity: Medium**

Data that logically belongs together has different KV TTLs:

| Data | KV TTL | Relationship |
|------|--------|-------------|
| Listing | 1 hour | Parent |
| Diagnostics | 1 hour | Paired with listing |
| Scrape metadata | 1 year | References listing by ID |
| Price history | 1 year | References listing by URL |
| Haul scrapes | 30 days | Contains listing snapshot |

After 1 hour, a listing expires from KV. Its scrape metadata and price
history remain for up to a year, referencing a listing that requires a slow
Firestore lookup (or returns nothing if Firestore is unavailable).

Diagnostics reconstructed from Firestore are lossy — field traces (the
per-field extraction detail) are not stored in Firestore, so the
diagnostics panel shows incomplete data.

### Proposed fix

1. Increase listing + diagnostics KV TTL from 1 hour to 24 hours. The cost
   impact is minimal (entries are small, KV storage is cheap).
2. Store full diagnostics in Firestore alongside the listing (currently only
   summary fields are embedded). This eliminates the lossy reconstruction.

---

## Issue 8: `extraction-runner.ts` Previously Clobbered KV Init

**Severity: High (fixed)**

This was fixed in the current session. `extraction-runner.ts:102` had
`initKV(undefined)`, which reset the KV binding to `null` on every
extraction, breaking listing deduplication. The fix adds an optional
`kvBinding` parameter and only calls `initKV` when a binding is provided.

After Issue 1 is fixed (middleware-level init), the `kvBinding` parameter
in `runExtraction` becomes redundant — KV will already be initialized
before any endpoint code runs.

---

## Issue 9: DevKV Does Not Clean Up Expired Entries

**Severity: Low**

`DevKV` checks TTL on read (lazy expiration) but never proactively deletes
expired files. The `.kv-data/` directory grows indefinitely during local
development.

Additionally, `DevKV` does not implement `delete()`, which is used by
`listing-store.ts:deleteListing()`. This would throw at runtime if
`deleteListing` is called in dev with `DEV_KV_PERSIST` enabled.

### Proposed fix

1. Add a `delete(key)` method to `DevKV`.
2. Optionally, add a cleanup pass on startup that removes files with
   expired TTLs.

---

## Issue 10: Global Mutable Module State

**Severity: Medium**

Every service uses module-level `let kv` and `Map` variables:

```typescript
// Repeated pattern across 7+ services
let kv: any = null;
const store = new Map<string, Foo>();

export function initFooKV(kvNamespace: any): void {
  kv = kvNamespace ?? null;
}
```

These are per-isolate singletons. On Cloudflare Workers, this means:

- **Stale state**: If an isolate is reused across requests, the in-memory
  Map retains data from prior requests. This is by design (it's the cache),
  but the `kv` variable can also be stale if a previous request set it and
  the current request doesn't re-init.
- **No isolation**: Two concurrent requests on the same isolate share the
  same `kv` reference and Maps. This is fine for reads but could cause
  subtle bugs if writes interleave.

After Issue 1 is fixed (middleware init), the staleness concern is
eliminated because `kv` is re-set on every request.

The Maps themselves are intentionally retained across requests (that is the
cache). This is correct behavior.

---

## Issue 11: Single KV Namespace for All Data

**Severity: Low (informational)**

All data — listings, diagnostics, hauls, price history, scrape metadata,
webhooks, usage, export history, API keys — lives in a single KV namespace
(`RESULTS`). Key collisions are prevented by prefix conventions
(`listing:`, `haul:`, `history:`, etc.).

This is adequate at current scale but means:

- No per-service KV metrics (impossible to tell which service consumes
  the most reads/writes from the Cloudflare dashboard).
- A runaway service (e.g., unbounded webhook growth) could fill the 1 GB
  storage limit and break all other services.
- Difficult to apply different consistency or caching policies per data
  type.

No immediate action needed. If the project outgrows the single-namespace
model, split into per-service namespaces (e.g., `HAULS`, `PRICE_HISTORY`).

---

## Summary: Prioritized Fix Order

### Phase 1 — Stop the bleeding (immediate)

| # | Fix | Effort | Impact |
|---|-----|--------|--------|
| 1 | Centralized KV init in middleware | Small | Fixes 5 never-initialized services |
| 2 | Add error logging to fire-and-forget calls | Small | Makes failures visible |
| 3 | Add TTL to webhook KV entries | Small | Prevents unbounded storage growth |

### Phase 2 — Data durability (next sprint)

| # | Fix | Effort | Impact |
|---|-----|--------|--------|
| 4 | Firestore fallback for hauls | Medium | Hauls survive KV expiration |
| 5 | Firestore fallback for price history | Medium | Price trends survive KV expiration |
| 6 | Increase listing/diagnostics KV TTL to 24h | Small | Fewer slow Firestore fallbacks |

### Phase 3 — Hardening (next quarter)

| # | Fix | Effort | Impact |
|---|-----|--------|--------|
| 7 | KV-backed rate limiting | Medium | Rate limits enforceable in production |
| 8 | Store full diagnostics in Firestore | Small | Eliminates lossy reconstruction |
| 9 | DevKV `delete()` method + cleanup | Small | Dev environment correctness |

---

## Appendix A: KV Init Coverage (Current State)

Which endpoints call which init functions. Grayed entries are never called.

```
Service                     Init function                 Called in
─────────────────────────── ───────────────────────────── ────────────────────────
listing-store               initKV()                      ~12 endpoints + middleware candidate
haul-store                  initHaulKV()                  All haul endpoints
scrape-metadata             initScrapeMetadataKV()        6 Astro pages, 1 API route
price-history               initPriceHistoryKV()          *** NEVER ***
webhook-service             initWebhookKV()               *** NEVER ***
export-history              initExportHistoryKV()         *** NEVER ***
usage-meter                 initUsageKV()                 *** NEVER ***
api-key-service             initUsersKV()                 *** NEVER ***
```

## Appendix B: Data Durability Matrix (Current State)

```
Data type          In-memory   KV (TTL)        Firestore
────────────────── ─────────── ─────────────── ──────────
Listings           Map         1 hour          Yes (fallback)
Diagnostics        Map         1 hour          Partial (lossy)
Hauls              Map         30 days         *** NO ***
Price history      Map         1 year *        *** NO ***
Scrape metadata    Map         1 year *        *** NO ***
Webhooks           Map         No TTL *        *** NO ***
Export history     Array(200)  30 days *       *** NO ***
Usage data         Map         90 days *       *** NO ***
API keys           Map         5 min cache *   *** NO ***

* = KV init never called; effectively memory-only today
```
