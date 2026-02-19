# Learnings from Fredy — Implementation Plan

> Source: [orangecoding/fredy](https://github.com/orangecoding/fredy)
> — a self-hosted German real estate listing aggregator (14 providers, 13 notification adapters)

This document captures patterns from the Fredy project that are applicable to
PropertyWebScraper, with concrete implementation TODOs for each.

---

## Table of Contents

1. [Auto-Discovery of Scraper Mappings](#1-auto-discovery-of-scraper-mappings)
2. [Modifier Pipeline for Field Extraction](#2-modifier-pipeline-for-field-extraction)
3. [Image URL Normalization](#3-image-url-normalization)
4. [Graceful Degradation and Partial Results](#4-graceful-degradation-and-partial-results)
5. [Content-Based Deduplication](#5-content-based-deduplication)
6. [Anti-Bot Defense Layering](#6-anti-bot-defense-layering)
7. [API Bypass Strategy](#7-api-bypass-strategy)
8. [Post-Extraction Filtering](#8-post-extraction-filtering)
9. [Notification / Webhook Adapter System](#9-notification--webhook-adapter-system)
10. [Cross-Source Listing Merging](#10-cross-source-listing-merging)

---

## 1. Auto-Discovery of Scraper Mappings

### What Fredy Does

Fredy auto-discovers providers by reading all `.js` files from the
`lib/provider/` directory at startup. No manual registration is needed — drop in
a file and it becomes available.

### Current State

PropertyWebScraper has **three places** that must be updated when adding a new
scraper:

1. `config/scraper_mappings/<name>.json` — the mapping file itself
2. `astro-app/src/lib/services/portal-registry.ts` — `PORTAL_REGISTRY` object
3. `astro-app/src/lib/extractor/mappings-bundle.ts` — manual `import` + entry in
   the `mappings` object

This triple-registration creates friction and is error-prone: a mapping file can
exist but be invisible to the system if the other two files aren't updated.

### Implementation Plan

**Goal:** Derive the mapping registry from the mapping files themselves. A new
scraper is added by creating a single JSON file.

#### TODO 1.1: Embed portal metadata in mapping JSON

Add an optional `portal` key to each mapping JSON file. Example for
`rightmove.json`:

```json
{
  "name": "rightmove",
  "portal": {
    "hosts": ["www.rightmove.co.uk", "rightmove.co.uk"],
    "country": "GB",
    "currency": "GBP",
    "localeCode": "en-GB",
    "areaUnit": "sqft",
    "contentSource": "script-json",
    "requiresJsRendering": false
  },
  "expectedExtractionRate": 0.90,
  "defaultValues": { ... },
  ...
}
```

**Files to change:**
- All 22 files in `config/scraper_mappings/*.json` — add `portal` key
- `astro-app/src/lib/extractor/mapping-loader.ts` — extend `ScraperMapping`
  interface with optional `portal?: PortalConfig`

#### TODO 1.2: Generate portal registry from mappings at build time

Replace the hand-maintained `PORTAL_REGISTRY` in `portal-registry.ts` with a
function that derives it from loaded mappings:

```typescript
// portal-registry.ts
import { allMappings } from '../extractor/mapping-loader.js';

export function buildPortalRegistry(): Record<string, PortalConfig> {
  const registry: Record<string, PortalConfig> = {};
  for (const [name, mapping] of Object.entries(allMappings())) {
    if (mapping.portal) {
      registry[name] = { scraperName: name, slug: name, ...mapping.portal };
    }
  }
  return registry;
}
```

Keep the existing `PORTAL_REGISTRY` as a fallback for mappings that haven't been
migrated yet.

**Files to change:**
- `astro-app/src/lib/services/portal-registry.ts`
- `astro-app/src/lib/services/url-validator.ts` (derive `LOCAL_HOST_MAP` from
  the new function)

#### TODO 1.3: Auto-discover mapping files with Vite glob import

Replace the 22 manual imports in `mappings-bundle.ts` with Vite's
`import.meta.glob`:

```typescript
// mappings-bundle.ts
import JSON5 from 'json5';
import type { ScraperMapping } from './mapping-loader.js';

const rawModules = import.meta.glob(
  '../../../config/scraper_mappings/*.json',
  { eager: true, query: '?raw', import: 'default' }
);

function parse(raw: string): ScraperMapping {
  const parsed = JSON5.parse(raw);
  return Array.isArray(parsed) ? parsed[0] : parsed;
}

const mappings: Record<string, ScraperMapping> = {};
for (const [path, raw] of Object.entries(rawModules)) {
  const name = path.split('/').pop()!.replace('.json', '');
  mappings[name] = parse(raw as string);
}

export default mappings;
```

**Files to change:**
- `astro-app/src/lib/extractor/mappings-bundle.ts` — replace with glob import
- Verify with `cd astro-app && npx vitest run` — all existing tests must pass

#### TODO 1.4: Update the `/add-scraper` skill

Update the add-scraper workflow so it only creates one file (the mapping JSON
with embedded portal metadata) instead of requiring edits to three files.

**Files to change:**
- `.claude/skills/add-scraper/` — update the skill prompt/template
- `astro-app/scripts/capture-fixture.ts` — remove hardcoded hostname checks if
  they exist

---

## 2. Modifier Pipeline for Field Extraction

### What Fredy Does

Fredy uses a pipe-delimited modifier chain in its `crawlFields` config:

```javascript
price: '.price-tag | removeNewline | trim'
id: '.aditem@data-adid | int'
```

This is more composable than fixed field-type categories. Any field can have any
combination of modifiers.

### Current State

PropertyWebScraper uses **separate sections** (`textFields`, `intFields`,
`floatFields`) to determine how a field is processed. The processing is
hardcoded per section in `html-extractor.ts`:

- `intFields` → `parseInt(text, 10) || 0`
- `floatFields` → `parseFloat(text) || 0` + optional `stripPunct`/`stripFirstChar`
- `textFields` → `text.trim()`

Post-processing modifiers (`splitTextCharacter`, `stripString`) are applied in
`cleanUpString()` in `strategies.ts` but are limited to split-then-pick and
substring removal.

### Implementation Plan

**Goal:** Add a `modifiers` array to `FieldMapping` that allows composable
post-processing. Keep backward compatibility with existing section-based
processing.

#### TODO 2.1: Define modifier registry

Create `astro-app/src/lib/extractor/modifiers.ts`:

```typescript
export type Modifier = (text: string) => string;

export const MODIFIER_REGISTRY: Record<string, Modifier> = {
  trim: (t) => t.trim(),
  int: (t) => String(parseInt(t, 10) || 0),
  float: (t) => String(parseFloat(t) || 0),
  removeNewline: (t) => t.replace(/[\r\n]+/g, ' '),
  stripPunct: (t) => t.replace(/[.,]/g, ''),
  stripFirstChar: (t) => t.slice(1),
  lowercase: (t) => t.toLowerCase(),
  uppercase: (t) => t.toUpperCase(),
  collapseWhitespace: (t) => t.replace(/\s+/g, ' ').trim(),
};

export function applyModifiers(text: string, modifiers: string[]): string {
  let result = text;
  for (const name of modifiers) {
    const fn = MODIFIER_REGISTRY[name];
    if (fn) result = fn(result);
    else console.warn(`[Modifiers] Unknown modifier: ${name}`);
  }
  return result;
}
```

**Files to create:**
- `astro-app/src/lib/extractor/modifiers.ts`

#### TODO 2.2: Extend FieldMapping with optional modifiers

Add `modifiers?: string[]` to `FieldMapping` in `mapping-loader.ts`.

Update `cleanUpString()` in `strategies.ts` to apply modifiers after existing
split/strip logic when present:

```typescript
if (mapping.modifiers) {
  result = applyModifiers(result, mapping.modifiers);
}
```

**Files to change:**
- `astro-app/src/lib/extractor/mapping-loader.ts` — add `modifiers?: string[]`
  to `FieldMapping`
- `astro-app/src/lib/extractor/strategies.ts` — integrate into `cleanUpString()`

#### TODO 2.3: Add modifier tests

Create unit tests for each built-in modifier and for chained combinations.

**Files to create:**
- `astro-app/test/lib/modifiers.test.ts`

#### TODO 2.4: (Optional) Support pipe syntax in mapping JSON

For future convenience, allow shorthand like
`"modifiers": "removeNewline | trim | int"` that gets parsed into an array.
This is a nice-to-have after the array-based version works.

---

## 3. Image URL Normalization

### What Fredy Does

Fredy's `normalizeImageUrl` utility:
- Enforces HTTPS protocol
- Validates file extensions (jpg, png, gif)
- Converts WebP references to JPG
- WG-Gesucht provider replaces `small` with `large` in image paths

### Current State

`image-extractor.ts` resolves relative URLs to absolute using `new URL(imgUrl,
uri.href)` and supports `imagePathPrefix`, but does **not**:
- Enforce HTTPS
- Validate extensions
- Upgrade thumbnail URLs to full-size
- Handle protocol-relative URLs (`//cdn.example.com/...`)

### Implementation Plan

#### TODO 3.1: Create image URL normalizer

Create `astro-app/src/lib/extractor/image-normalizer.ts`:

```typescript
export interface ImageNormalizeOptions {
  enforceHttps?: boolean;          // default true
  allowedExtensions?: string[];    // default ['jpg','jpeg','png','gif','webp','avif','svg']
  thumbnailPatterns?: { match: RegExp; replace: string }[];
}

export function normalizeImageUrl(
  url: string,
  options: ImageNormalizeOptions = {}
): string | null {
  // 1. Handle protocol-relative URLs
  // 2. Enforce HTTPS
  // 3. Validate extension (return null if invalid)
  // 4. Apply thumbnail → full-size pattern replacements
  // 5. Return normalized URL
}
```

**Files to create:**
- `astro-app/src/lib/extractor/image-normalizer.ts`

#### TODO 3.2: Integrate into image-extractor.ts

Call `normalizeImageUrl()` in `extractImages()` before pushing to the results
array. Filter out null returns (invalid URLs).

**Files to change:**
- `astro-app/src/lib/extractor/image-extractor.ts`

#### TODO 3.3: Add per-scraper thumbnail upgrade patterns to mappings

Extend the image mapping in JSON to support thumbnail-to-full-size rewrites:

```json
"images": [{
  "cssLocator": "img.gallery-image",
  "cssAttr": "src",
  "thumbnailPatterns": [
    { "match": "_135x100", "replace": "_max_800x600" }
  ]
}]
```

**Files to change:**
- `astro-app/src/lib/extractor/mapping-loader.ts` — add `thumbnailPatterns?` to
  `FieldMapping`
- `astro-app/src/lib/extractor/image-extractor.ts` — pass patterns to normalizer

#### TODO 3.4: Add tests

Test HTTPS enforcement, extension validation, protocol-relative handling,
thumbnail upgrades.

**Files to create:**
- `astro-app/test/lib/image-normalizer.test.ts`

---

## 4. Graceful Degradation and Partial Results

### What Fredy Does

- `NoNewListingsWarning` is treated as a normal condition (debug level)
- `Promise.allSettled()` prevents one provider failure from aborting others
- Puppeteer returns null on failure instead of throwing
- The pipeline continues with whatever data it got

### Current State

`html-extractor.ts` already has good foundations:
- `ExtractionResult` has `success: boolean` and `errorMessage`
- Quality grading tracks missing fields
- ContentAnalysis detects bot blocks and JS-only shells

However, the pipeline is binary: it either returns `success: true` with all
fields or `success: false` with an error. There's no concept of partial success.

### Implementation Plan

#### TODO 4.1: Add partial success status

Extend `ExtractionResult` to distinguish between full success, partial success,
and failure:

```typescript
export type ExtractionStatus = 'full' | 'partial' | 'blocked' | 'failed';

export interface ExtractionResult {
  success: boolean;
  status: ExtractionStatus;        // new field
  properties: Record<string, unknown>[];
  errorMessage?: string;
  warnings?: string[];             // new field
  diagnostics?: ExtractionDiagnostics;
  splitSchema?: SplitSchema;
}
```

**Criteria:**
- `full`: all critical fields populated, grade A or B
- `partial`: some critical fields missing but at least one populated
- `blocked`: contentAnalysis.appearsBlocked is true
- `failed`: mapping not found or no fields populated at all

**Files to change:**
- `astro-app/src/lib/extractor/html-extractor.ts` — add `status` and `warnings`

#### TODO 4.2: Collect warnings instead of swallowing errors

Replace `console.warn` calls with a collected warnings array that gets returned
in the result. This gives API consumers visibility into issues without treating
them as hard failures.

**Files to change:**
- `astro-app/src/lib/extractor/html-extractor.ts`
- `astro-app/src/lib/extractor/strategies.ts` — return warnings from xpath
  deprecation, etc.

#### TODO 4.3: Update API endpoints to surface warnings

Ensure API responses include `status` and `warnings` so consumers can decide how
to handle partial data.

**Files to change:**
- Relevant Astro API endpoint files in `astro-app/src/pages/`

#### TODO 4.4: Add tests for partial extraction

Create fixtures that simulate partial scenarios (some selectors match, others
don't) and verify the correct status is returned.

**Files to create:**
- `astro-app/test/lib/partial-extraction.test.ts`

---

## 5. Content-Based Deduplication

### What Fredy Does

SHA-256 hash of `(title, price, address)` across all sources. The same apartment
listed on both Immowelt and ImmoScout24 is detected as a duplicate. The listing
ID is `hash(rawId + price)` so a price change creates a new entry.

### Current State

PropertyWebScraper has no deduplication. Each extraction is independent.

### Implementation Plan

This is relevant if/when the project supports batch extraction or multi-source
aggregation.

#### TODO 5.1: Create listing fingerprint utility

Create `astro-app/src/lib/services/listing-fingerprint.ts`:

```typescript
import { createHash } from 'node:crypto';

export interface FingerprintFields {
  title?: string;
  price_float?: number;
  address_string?: string;
  latitude?: number;
  longitude?: number;
}

/**
 * Generate a content-based fingerprint for deduplication.
 * Uses SHA-256 of normalized (title + price + address).
 */
export function computeFingerprint(fields: FingerprintFields): string {
  const parts = [
    (fields.title || '').toLowerCase().trim(),
    String(fields.price_float || 0),
    (fields.address_string || '').toLowerCase().trim(),
  ];
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 16);
}
```

**Files to create:**
- `astro-app/src/lib/services/listing-fingerprint.ts`

#### TODO 5.2: Include fingerprint in extraction result

Compute and attach the fingerprint in `html-extractor.ts` after all fields are
extracted. Add it to the `propertyHash` as `_fingerprint`.

**Files to change:**
- `astro-app/src/lib/extractor/html-extractor.ts`

#### TODO 5.3: Add tests

**Files to create:**
- `astro-app/test/lib/listing-fingerprint.test.ts`

---

## 6. Anti-Bot Defense Layering

### What Fredy Does

Multi-layered approach:

1. **Layer 1 — Stealth Puppeteer**: `puppeteer-extra-plugin-stealth`, navigator
   spoofing, WebGL fingerprint masking
2. **Layer 2 — Human behavior simulation**: random mouse movements, scroll
   events, delays (200-600ms)
3. **Layer 3 — Request-level evasion**: rotating User-Agent pool, realistic
   headers (`Sec-Fetch-*`), exponential backoff with jitter on 401/403
4. **Layer 4 — Scheduling**: working-hours configuration to avoid 24/7 patterns
5. **Layer 5 — API bypass**: direct mobile API calls for heavily protected sites

### Current State

PropertyWebScraper uses basic HTTP fetch + Cheerio. The `contentAnalysis` in
`html-extractor.ts` detects bot blocks after the fact but doesn't prevent them.
The `portal-registry.ts` has a `requiresJsRendering` flag but no rendering
implementation.

### Implementation Plan

#### TODO 6.1: Add a fetch service with retry and backoff

Create `astro-app/src/lib/services/resilient-fetch.ts`:

```typescript
export interface FetchOptions {
  maxRetries?: number;        // default 3
  baseDelay?: number;         // default 500ms
  maxDelay?: number;          // default 5000ms
  userAgentPool?: string[];   // rotating UAs
  timeout?: number;           // default 30000ms
}

export interface FetchResult {
  html: string;
  statusCode: number;
  blocked: boolean;
  retryCount: number;
}

export async function resilientFetch(
  url: string,
  options?: FetchOptions
): Promise<FetchResult> {
  // 1. Select random User-Agent from pool
  // 2. Set realistic headers (Accept, Sec-Fetch-*, Accept-Language)
  // 3. Retry with exponential backoff + jitter on 429/403
  // 4. Detect bot blocks in response body
  // 5. Return result with metadata
}
```

**Files to create:**
- `astro-app/src/lib/services/resilient-fetch.ts`

#### TODO 6.2: Add User-Agent rotation pool

Define a pool of realistic, current User-Agent strings. Rotate per request.

```typescript
const UA_POOL = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ...',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ...',
  'Mozilla/5.0 (X11; Linux x86_64) ...',
  // ... 5-10 entries
];
```

This can live in `resilient-fetch.ts` or a separate `user-agents.ts`.

#### TODO 6.3: Integrate bot-block detection from contentAnalysis

The existing `analyzeContent()` in `html-extractor.ts` already detects blocks.
Wire this into the fetch layer so that a detected block triggers a retry with a
different User-Agent.

**Files to change:**
- `astro-app/src/lib/services/resilient-fetch.ts` — check response body
- `astro-app/src/lib/extractor/html-extractor.ts` — export block detection logic

#### TODO 6.4: (Future) Add Puppeteer fallback path

When `requiresJsRendering: true` in portal config and basic fetch returns a
JS-only shell, fall back to headless browser rendering. This is a larger effort
— document the approach but defer implementation.

**Dependencies:**
- `puppeteer` or `playwright` npm package
- Container/serverless considerations for deployment

#### TODO 6.5: Add tests for retry behavior

**Files to create:**
- `astro-app/test/lib/resilient-fetch.test.ts`

---

## 7. API Bypass Strategy

### What Fredy Does

For ImmoScout24, Fredy reverse-engineered the mobile API and calls it directly.
An `immoscout-web-translator.js` converts user-provided web URLs into mobile API
parameters. This avoids HTML scraping entirely for that site.

### Current State

All PropertyWebScraper extraction is HTML-based. No API-based extractors exist.

### Implementation Plan

This is an ongoing opportunity rather than a single task. When a site's HTML
selectors break frequently, investigate whether it has a mobile/internal API.

#### TODO 7.1: Document the API investigation process

Add a section to `scraper-maintenance-guide.md` describing how to:

1. Use browser DevTools Network tab to observe XHR/fetch requests when a listing
   page loads
2. Look for JSON responses containing listing data
3. Test if the API endpoint works without authentication
4. Create an API-based extractor that bypasses HTML

**Files to change:**
- `astro-app/docs/scraper-maintenance-guide.md` — add "API bypass" section

#### TODO 7.2: Add an `apiEndpoint` strategy to the mapping format

Extend `FieldMapping` with an optional `apiEndpoint` strategy:

```typescript
export interface FieldMapping {
  // ... existing fields ...
  apiEndpoint?: string;       // URL template with {id} placeholder
  apiJsonPath?: string;       // dot-path into API response
}
```

This allows a mapping to specify: "fetch this API URL, then extract this JSON
path" instead of CSS selectors.

**Files to change:**
- `astro-app/src/lib/extractor/mapping-loader.ts`
- `astro-app/src/lib/extractor/strategies.ts` — add API strategy

#### TODO 7.3: Add URL-to-API translator pattern

When a mapping has `apiEndpoint`, the extractor needs to derive API parameters
from the user-provided web URL (e.g., extract listing ID from
`rightmove.co.uk/properties/12345`).

The existing `urlPathPart` strategy can handle most ID extraction. The API
endpoint template would use the extracted ID.

**Files to change:**
- `astro-app/src/lib/extractor/strategies.ts`

---

## 8. Post-Extraction Filtering

### What Fredy Does

Every provider runs `applyBlacklist()` after extraction, checking title and
description against user-defined terms using case-insensitive substring matching.
One provider adds district-level blacklisting.

### Current State

PropertyWebScraper has no post-extraction filtering. Whatever the HTML yields is
returned as-is.

### Implementation Plan

#### TODO 8.1: Design filter configuration format

Support filters at the API level (query parameters or request body):

```typescript
export interface ExtractionFilter {
  excludeTerms?: string[];       // case-insensitive, matches title + description
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  requiredFields?: string[];     // reject results missing these fields
}
```

#### TODO 8.2: Implement post-extraction filter

Create `astro-app/src/lib/extractor/result-filter.ts`:

```typescript
export function applyFilters(
  result: ExtractionResult,
  filters: ExtractionFilter
): ExtractionResult {
  // 1. Check excludeTerms against title, description
  // 2. Check price range
  // 3. Check bedroom count
  // 4. Check required fields
  // 5. Return filtered result (or result with filtered=true flag)
}
```

**Files to create:**
- `astro-app/src/lib/extractor/result-filter.ts`

#### TODO 8.3: Wire into API endpoints

Accept filter parameters in the extraction API and apply them before returning.

**Files to change:**
- Relevant Astro API endpoint files in `astro-app/src/pages/`

#### TODO 8.4: Add tests

**Files to create:**
- `astro-app/test/lib/result-filter.test.ts`

---

## 9. Notification / Webhook Adapter System

### What Fredy Does

13 notification adapters all implement a `send()` interface. Per-adapter rate
limiting (e.g., Telegram throttled to 1 req/sec). Adapters auto-discovered from
a directory. Graceful fallback (photo send fails → text-only).

### Current State

PropertyWebScraper is a stateless extraction engine — it processes HTML and
returns data. No notification system exists.

### Implementation Plan

This is a **future feature** for when the project supports monitoring/watching
listings. Document the architecture now, implement later.

#### TODO 9.1: Document webhook adapter architecture

Create `astro-app/docs/webhook-architecture.md` describing:

- Adapter interface: `send(payload: ListingPayload): Promise<void>`
- Config schema per adapter (fields, required secrets)
- Rate limiting strategy (per-channel throttle)
- Retry on failure with backoff
- Auto-discovery pattern (glob adapter directory)

**Files to create:**
- `astro-app/docs/webhook-architecture.md`

#### TODO 9.2: (Future) Implement generic webhook adapter

When needed, implement a single HTTP webhook adapter as the first adapter. This
covers most use cases (Zapier, n8n, custom backends).

---

## 10. Cross-Source Listing Merging

### What Fredy Does

The `similarityCache` operates above individual providers. It hashes
`(title, price, address)` across all sources, so the same apartment on two
platforms is detected as a duplicate.

### Current State

PropertyWebScraper processes one URL at a time. No cross-source merging exists.

### Implementation Plan

This builds on the deduplication work in section 5.

#### TODO 10.1: Add batch extraction endpoint

Create an API endpoint that accepts multiple URLs and returns deduplicated
results:

```
POST /api/extract-batch
{
  "urls": ["https://rightmove.co.uk/...", "https://zoopla.co.uk/..."],
  "deduplicate": true
}
```

**Files to create:**
- `astro-app/src/pages/api/extract-batch.ts`

#### TODO 10.2: Implement merge logic

When deduplication is enabled, group results by fingerprint and merge fields from
multiple sources (prefer the source with the most populated fields).

**Files to create:**
- `astro-app/src/lib/services/listing-merger.ts`

#### TODO 10.3: Add tests

**Files to create:**
- `astro-app/test/lib/listing-merger.test.ts`

---

## Priority Summary

| Phase | Section | Effort | Impact |
|-------|---------|--------|--------|
| **Phase 1** | 1. Auto-discovery of mappings | Medium | High — reduces friction for adding scrapers |
| **Phase 1** | 3. Image URL normalization | Small | High — fixes real extraction bugs |
| **Phase 1** | 4. Graceful degradation | Small | High — better API consumer experience |
| **Phase 2** | 2. Modifier pipeline | Medium | Medium — more composable field processing |
| **Phase 2** | 6. Anti-bot defense | Medium | Medium — unblocks scraping of protected sites |
| **Phase 2** | 8. Post-extraction filtering | Small | Medium — useful API feature |
| **Phase 3** | 5. Content deduplication | Small | Low — needed for batch/aggregation |
| **Phase 3** | 7. API bypass strategy | Varies | Low — per-site investigation |
| **Phase 3** | 10. Cross-source merging | Medium | Low — depends on dedup |
| **Future** | 9. Webhook adapters | Large | Low — only when monitoring is needed |

---

## Appendix: Fredy Patterns Reference

### Provider interface contract (Fredy)

```javascript
export const init = (sourceConfig, blacklist) => { ... };
export const metaInformation = { name, baseUrl, id };
export const config = {
  url: null,
  crawlContainer: '.listing-card',
  sortByDateParam: 'sort=newest',
  waitForSelector: '.results-container',
  crawlFields: { /* selector DSL */ },
  normalize: (listings) => { /* map to common schema */ },
  filter: (listings) => { /* apply blacklist */ },
};
```

### Selector DSL (Fredy)

```
'.css-selector'              → text content
'.css-selector@attr'         → HTML attribute value
'.selector | trim'           → text + trim modifier
'.selector | removeNewline | trim | int'  → chained modifiers
```

### Error handling (Fredy)

```javascript
// One provider failure doesn't abort others
const results = await Promise.allSettled(
  providers.map(p => executePipeline(p))
);

// Warnings vs errors
if (error instanceof NoNewListingsWarning) {
  log.debug(error.message);  // not an error
} else {
  log.warn(error.message);   // real problem
}
```

### Exponential backoff with jitter (Fredy)

```javascript
const BASE_DELAY = 500;
const MAX_DELAY = 2000;

for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
  const delay = Math.min(BASE_DELAY * Math.pow(2, attempt), MAX_DELAY);
  const jitter = Math.random() * 1000;
  await sleep(delay + jitter);
}
```
