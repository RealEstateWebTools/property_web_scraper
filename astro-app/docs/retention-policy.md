# Data Retention Policy

## Overview

PropertyWebScraper uses a request-driven probabilistic cleanup system to manage
data retention in Firestore. Since Cloudflare Pages does not support cron jobs,
cleanup is triggered opportunistically on admin and API requests.

## Default TTLs

| Collection | Default TTL | Notes |
|---|---|---|
| `diagnostics` | 90 days | Field traces, quality scores |
| `price_history` | 365 days | Price snapshots |
| `scrape_metadata` | 90 days | Scrape records |
| `audit_log` | 90 days | Audit entries |
| `scraper_health` | 180 days | Health trend snapshots |
| `export_history` | 90 days | Export activity |
| `hauls` | 30 days | Haul sessions |
| **`listings`** | **forever** | **Exempt — never expired** |

## How Cleanup Works

### Probabilistic trigger

On every admin (`/admin/*`) or public API (`/public_api/*`) request, there is
a **1% chance** of triggering a background cleanup. This is rate-limited to
**once per hour** to avoid excessive Firestore reads.

The trigger runs as fire-and-forget — it does not block the request.

### Cleanup process

1. Load retention config from Firestore (or use defaults)
2. For each collection with a TTL policy:
   - Fetch all documents
   - Filter expired documents client-side (using `timestamp` or `created_at` field)
   - Delete expired documents in batches (max 100 per collection per run)
3. Log results to the activity logger

### Client-side filtering

The Firestore REST client only supports `EQUAL` where clauses, so date-range
filtering is done client-side after fetching documents. This means cleanup
reads all documents in each collection — for very large collections, the
batch limit (100 deletions) prevents excessive Firestore write operations
per run.

## Admin Configuration

### Viewing policies

Visit `/admin/retention` to see current TTL policies and last cleanup results.

### Updating a policy

POST to `/admin/api/retention`:

```json
{
  "action": "update_policy",
  "collectionName": "diagnostics",
  "ttlDays": 60
}
```

### Manual cleanup

POST to `/admin/api/retention`:

```json
{
  "action": "cleanup",
  "dryRun": true
}
```

Set `dryRun: false` to actually delete expired documents.

### Exempt collections

Listings are exempt from retention and cannot have a TTL policy applied.
Attempting to set a policy on `listings` will return an error.

## Firestore Storage

Retention configuration is stored in a single Firestore document:
`{prefix}retention_config/current`. If this document does not exist, default
policies are used.

## Timestamp Fields

Documents must have a `timestamp` or `created_at` field (milliseconds since
epoch) for cleanup to determine their age. Documents without either field
are never considered expired.
