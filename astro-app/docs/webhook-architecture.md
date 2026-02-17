# Webhook & Notification Adapter Architecture

> **Status: FUTURE FEATURE** -- This document describes a planned system that is
> not yet implemented. It serves as a design reference for when development begins.

## Overview

The notification adapter system delivers extraction results to external systems.
When a property listing is extracted, the structured data can be forwarded to one
or more configured destinations: HTTP endpoints, chat platforms, email services,
or local storage.

The design is inspired by multi-adapter notification systems (such as Fredy's
13-adapter architecture) but tailored to the property extraction domain. Each
adapter implements a common interface, and adapters are auto-discovered at
startup from a conventional directory.

## Adapter Interface

Every notification adapter must implement the following TypeScript interface:

```typescript
interface AdapterField {
  key: string;
  label: string;
  type: "string" | "number" | "boolean" | "select";
  required: boolean;
  placeholder?: string;
  options?: { label: string; value: string }[];
}

interface ListingPayload {
  listing: Record<string, unknown>;
  metadata: {
    extractedAt: string;       // ISO 8601 timestamp
    portalName: string;        // e.g. "idealista", "zoopla"
    sourceUrl: string;
    scraperId: string;
    pipelineVersion: string;
  };
}

interface NotificationAdapter {
  id: string;
  name: string;
  description: string;
  configSchema: AdapterField[];
  send(payload: ListingPayload): Promise<void>;
}
```

### Interface Contract

- `id` -- A unique, URL-safe identifier (e.g. `"slack"`, `"http-webhook"`).
- `name` -- Human-readable display name shown in the admin UI.
- `description` -- One-line explanation of what the adapter does.
- `configSchema` -- Describes the fields a user must fill in to configure the
  adapter (e.g. webhook URL, API token, channel name). The admin UI renders a
  form from this schema.
- `send(payload)` -- Delivers the extraction result. Must throw on permanent
  failure. Transient failures (network timeout, 5xx) should throw so the retry
  mechanism can re-attempt delivery.

## Planned Adapters

| Adapter | ID | Description |
|---|---|---|
| HTTP Webhook (generic) | `http-webhook` | POST JSON payload to any URL. Supports custom headers for authentication. |
| Slack | `slack` | Send formatted messages to a Slack channel via incoming webhook URL. |
| Discord | `discord` | Send embed messages to a Discord channel via webhook URL. |
| Email (SendGrid) | `email-sendgrid` | Send an email with listing details via the SendGrid API. |
| Telegram | `telegram` | Send messages to a Telegram chat via Bot API. |
| SQLite (local storage) | `sqlite-local` | Insert listing data into a local SQLite database for archival or offline use. |

Additional adapters can be added without modifying core code -- see
Auto-Discovery below.

## Rate Limiting Strategy

Each adapter has independent rate limiting using a **token bucket** algorithm:

- **Bucket capacity**: Configurable per adapter (default: 10 requests).
- **Refill rate**: Configurable per adapter (default: 1 token per second).
- **Per-channel limits**: A single adapter instance (e.g. one Slack workspace)
  can have its own rate ceiling independent of other instances of the same
  adapter type.

```
AdapterInstance
  ├── tokenBucket: { capacity: 10, refillRate: 1/s, tokens: 10 }
  └── send() checks bucket before dispatching
```

When the bucket is empty, the delivery is queued and retried when tokens become
available. This prevents overwhelming external services and respects
platform-specific rate limits (e.g. Slack allows 1 message per second per
webhook, Telegram allows 30 messages per second to different chats).

## Retry on Failure

When `send()` throws a transient error, the system retries with **exponential
backoff plus jitter**:

| Attempt | Base delay | Jitter range | Max delay |
|---|---|---|---|
| 1 | 1 second | 0--500 ms | 1.5 s |
| 2 | 4 seconds | 0--2000 ms | 6 s |
| 3 | 16 seconds | 0--8000 ms | 24 s |

- **Max retries**: 3 (configurable).
- **Backoff formula**: `delay = min(baseDelay * 4^attempt, maxDelay) + random(jitterRange)`.
- **Dead-letter queue**: After all retries are exhausted, the failed delivery is
  written to a dead-letter store (SQLite table or JSON file). Failed deliveries
  can be inspected and manually retried from the admin interface.

```typescript
interface DeadLetterEntry {
  id: string;
  adapterId: string;
  adapterConfig: Record<string, unknown>;
  payload: ListingPayload;
  error: string;
  failedAt: string;         // ISO 8601
  retryCount: number;
}
```

## Auto-Discovery

Adapters are loaded automatically from the `src/lib/notification/adapters/`
directory using a glob import at startup:

```
src/lib/notification/
  ├── adapter-registry.ts       # Discovers and registers adapters
  ├── delivery-engine.ts        # Rate limiting, retry, dead-letter queue
  ├── types.ts                  # Shared interfaces (NotificationAdapter, etc.)
  └── adapters/
      ├── http-webhook.ts
      ├── slack.ts
      ├── discord.ts
      ├── email-sendgrid.ts
      ├── telegram.ts
      └── sqlite-local.ts
```

The registry uses a glob import pattern:

```typescript
const adapterModules = import.meta.glob("./adapters/*.ts", { eager: true });

for (const [path, module] of Object.entries(adapterModules)) {
  const adapter = (module as { default: NotificationAdapter }).default;
  registry.set(adapter.id, adapter);
}
```

To add a new adapter, create a new `.ts` file in `adapters/` that exports a
default `NotificationAdapter`. No other registration step is needed.

## Message Format

Every adapter receives a standardized `ListingPayload`:

```typescript
{
  listing: {
    title: "3 Bedroom Apartment in Centro",
    price_float: 285000,
    price_string: "285.000 EUR",
    currency: "EUR",
    count_bedrooms: 3,
    count_bathrooms: 2,
    latitude: 40.4168,
    longitude: -3.7038,
    images: ["https://...jpg", "https://...jpg"],
    // ... all extracted fields
  },
  metadata: {
    extractedAt: "2026-02-17T14:30:00.000Z",
    portalName: "idealista",
    sourceUrl: "https://www.idealista.com/inmueble/12345678/",
    scraperId: "idealista",
    pipelineVersion: "2.1.0"
  }
}
```

Individual adapters are responsible for formatting this payload for their
platform. For example, the Slack adapter would build a Block Kit message with
the listing title, price, and a link. The HTTP webhook adapter sends the raw
JSON payload.

## Configuration

Notification delivery is organized around **jobs**. A job combines one or more
portals (sources) with one or more adapters (destinations):

```typescript
interface NotificationJob {
  id: string;
  name: string;                         // e.g. "Madrid apartment alerts"
  enabled: boolean;
  portals: string[];                    // scraper IDs: ["idealista", "fotocasa"]
  adapters: NotificationJobAdapter[];
  filters?: ListingFilter[];            // optional: only notify on matching listings
}

interface NotificationJobAdapter {
  adapterId: string;                    // e.g. "slack"
  config: Record<string, unknown>;      // adapter-specific settings
  rateLimit?: {
    capacity: number;
    refillRatePerSecond: number;
  };
}

interface ListingFilter {
  field: string;                        // e.g. "price_float"
  operator: "eq" | "gt" | "lt" | "gte" | "lte" | "contains";
  value: string | number | boolean;
}
```

### Example job configuration

```json
{
  "id": "madrid-alerts",
  "name": "Madrid apartment alerts",
  "enabled": true,
  "portals": ["idealista", "fotocasa"],
  "adapters": [
    {
      "adapterId": "slack",
      "config": {
        "webhookUrl": "https://hooks.slack.com/services/T.../B.../xxx",
        "channel": "#madrid-listings"
      }
    },
    {
      "adapterId": "http-webhook",
      "config": {
        "url": "https://my-crm.example.com/api/listings",
        "headers": { "Authorization": "Bearer token123" }
      }
    }
  ],
  "filters": [
    { "field": "price_float", "operator": "lte", "value": 350000 },
    { "field": "count_bedrooms", "operator": "gte", "value": 2 }
  ]
}
```

When a listing is extracted from any of the configured portals, it is checked
against the filters. If it passes (or no filters are defined), the payload is
dispatched to each configured adapter in the job.

Jobs are stored in a local JSON file or SQLite database and managed through the
admin interface.
