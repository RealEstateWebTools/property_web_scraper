# Production Hardening

## Overview

Deploy the new D-workstream features (webhooks, price history, AI mapping) to production with proper KV bindings, environment secrets, monitoring, and operational procedures.

## Current Production State

```jsonc
// wrangler.jsonc
{
  "name": "property-web-scraper",
  "compatibility_date": "2026-02-01",
  "compatibility_flags": ["nodejs_compat"],
  "pages_build_output_dir": "dist",
  "kv_namespaces": [
    { "binding": "RESULTS", "id": "a256f3e986d048e8bda850e4a5ac967a" }
  ]
}
```

Only the `RESULTS` KV namespace exists. Webhooks, price history, and AI mapping need additional configuration.

---

## 1. KV Namespace Setup

### New Namespaces

| Binding | Purpose | TTL |
|---------|---------|-----|
| `WEBHOOKS` | Webhook registrations + index | No expiry |
| `PRICE_HISTORY` | Price snapshots + indices | 365 days |

### Create and Bind

```bash
# Create KV namespaces
npx wrangler kv namespace create WEBHOOKS
npx wrangler kv namespace create PRICE_HISTORY

# Preview namespaces for dev
npx wrangler kv namespace create WEBHOOKS --preview
npx wrangler kv namespace create PRICE_HISTORY --preview
```

### Updated wrangler.jsonc

```jsonc
{
  "name": "property-web-scraper",
  "compatibility_date": "2026-02-01",
  "compatibility_flags": ["nodejs_compat"],
  "pages_build_output_dir": "dist",
  "kv_namespaces": [
    { "binding": "RESULTS", "id": "..." },
    { "binding": "WEBHOOKS", "id": "<from create output>" },
    { "binding": "PRICE_HISTORY", "id": "<from create output>" }
  ]
}
```

### Middleware Init

Create or update middleware to pass KV bindings to services:

```typescript
// src/middleware.ts or per-request init
import { initKV } from '@lib/services/listing-store.js';
import { initWebhookKV } from '@lib/services/webhook-service.js';
import { initPriceHistoryKV } from '@lib/services/price-history.js';

export function initBindings(env: any) {
  initKV(env.RESULTS);
  initWebhookKV(env.WEBHOOKS);
  initPriceHistoryKV(env.PRICE_HISTORY);
}
```

---

## 2. Environment Secrets

### Required Secrets

```bash
# AI Mapping
npx wrangler secret put GEMINI_API_KEY
# Or for OpenAI:
npx wrangler secret put OPENAI_API_KEY

# Existing (verify set)
npx wrangler secret put PWS_API_KEY
npx wrangler secret put PWS_ADMIN_KEY
```

### Secrets Inventory

| Secret | Service | Required |
|--------|---------|----------|
| `PWS_API_KEY` | API auth | Yes |
| `PWS_ADMIN_KEY` | Admin panel | Yes |
| `GEMINI_API_KEY` | AI mapping (D5) | For AI features |
| `OPENAI_API_KEY` | AI mapping fallback | Optional |

---

## 3. Webhook Operational Procedures

### Secret Rotation

Webhook consumers can register with an HMAC secret. If compromised:

1. Consumer registers a new webhook with a new secret
2. Both old and new webhooks active during transition
3. Consumer verifies signatures from new webhook work
4. Consumer deletes old webhook via `DELETE /public_api/v1/webhooks?id=...`

### Delivery Monitoring

Add tracking via the existing `logActivity` system:

```typescript
// In webhook-service.ts fireWebhooks():
for (const result of deliveryResults) {
  logActivity({
    level: result.success ? 'info' : 'warn',
    category: 'webhook_delivery',
    message: `Webhook ${result.webhookId}: ${result.success ? 'delivered' : 'failed'}`,
    webhookId: result.webhookId,
    statusCode: result.statusCode,
    durationMs: result.durationMs,
    error: result.error,
  });
}
```

### Retry Policy (future enhancement)

Currently fire-and-forget. Future improvement:
- Store failed deliveries in KV (`webhook-failure:{id}:{timestamp}`)
- Retry with exponential backoff (1m, 5m, 30m)
- Disable webhook after 10 consecutive failures
- Admin dashboard shows webhook delivery stats

---

## 4. Rate Limiter Hardening

### Current Issue
In-memory `Map` — resets on deploy/restart, not shared across isolates.

### Fix: KV-Backed Rate Limiting

```typescript
// Approach: Use KV with atomic counters
// Key: ratelimit:{clientKey}:{minuteWindow}
// Value: count
// TTL: 120 seconds (covers the 60s window + buffer)

async function checkRateLimitKV(request: Request, kv: any) {
  const key = getClientKey(request);
  const window = Math.floor(Date.now() / 60000);
  const kvKey = `ratelimit:${key}:${window}`;

  const count = parseInt(await kv.get(kvKey) || '0', 10);
  if (count >= maxRequests) return { allowed: false };

  await kv.put(kvKey, String(count + 1), { expirationTtl: 120 });
  return { allowed: true };
}
```

> [!NOTE]
> KV is eventually consistent (up to 60s propagation). For strict limiting, consider Cloudflare Durable Objects or Rate Limiting API instead.

---

## 5. Monitoring & Alerts

### Health Checks

| Check | Frequency | Alert Channel |
|-------|-----------|---------------|
| Contract tests (B1) | Weekly (GitHub Action) | GitHub Issues |
| Stale scraper detection (B3) | Weekly | GitHub Issues |
| Webhook delivery failures | Real-time | Activity log |
| KV storage usage | Monthly | Admin dashboard |

### Admin Dashboard Additions

Add to `/admin/scraper-health`:
- Webhook delivery success rate (last 24h)
- Price history snapshot count by portal
- AI mapping usage (calls/day)

### Log Aggregation

All services already use `logActivity()`. Add structured fields for filtering:

```typescript
// Categories for new features:
'webhook_delivery'   // Webhook POST results
'price_history'      // Snapshot recording
'ai_mapping'         // LLM calls and results
```

---

## 6. Deployment Checklist

### Pre-deploy

- [ ] Create `WEBHOOKS` KV namespace
- [ ] Create `PRICE_HISTORY` KV namespace
- [ ] Update `wrangler.jsonc` with new namespace IDs
- [ ] Set `GEMINI_API_KEY` secret
- [ ] Verify `PWS_API_KEY` and `PWS_ADMIN_KEY` are set
- [ ] Update middleware to init all KV bindings

### Deploy

- [ ] `npm run build` — verify no build errors
- [ ] `npx wrangler pages deploy dist/` — deploy to Cloudflare Pages
- [ ] Verify admin panel loads at `/admin`
- [ ] Verify AI Map page loads at `/admin/ai-map`

### Post-deploy Verification

- [ ] `POST /public_api/v1/listings` with test URL → verify webhook fire + price snapshot
- [ ] `POST /public_api/v1/webhooks` → register test webhook (webhook.site)
- [ ] `GET /public_api/v1/listings/history?url=...` → verify price history returns
- [ ] `POST /admin/api/ai-map` with sample HTML → verify AI mapping generation
- [ ] Check activity logs for webhook delivery entries

### Rollback Plan

If issues arise:
1. `npx wrangler pages deploy dist/ --branch=rollback` with previous build
2. KV data persists across deploys (no data loss)
3. New KV namespaces can remain even if code rolls back (unused bindings are harmless)

---

## 7. Performance Considerations

| Concern | Mitigation |
|---------|------------|
| Webhook delivery latency | Fire-and-forget (doesn't block API response) |
| Price history KV reads | Minimal — only on explicit `/history` queries |
| AI mapping LLM latency | 10-30s — shown with loading indicator |
| KV write costs | Deduped (price history skips if unchanged) |
| Rate limiter accuracy | KV eventually consistent — acceptable for this use case |
