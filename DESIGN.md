# PropertyWebScraper — Architecture Reference

## Overview

PropertyWebScraper is an HTML-first extraction engine built with **Astro 5 SSR** and deployed on **Cloudflare Pages**. Given fully-rendered HTML and a source URL, it applies configurable JSON mappings to extract structured property data — title, price, coordinates, images, and 70+ fields across 22 portals.

No browser automation or JS rendering happens inside the engine. Callers (Chrome extension, Puppeteer, curl) provide the HTML.

```
  External caller (Chrome extension, headless browser, curl)
       |
       | provides rendered HTML + source URL
       v
  +-----------------+        +--------------------+
  |  API Endpoints  | -----> | Extraction Runner  |
  | (Astro pages)   |        | (orchestration)    |
  +-----------------+        +--------------------+
                                    |
                     +--------------+--------------+
                     |                             |
               html: provided?               html: nil?
                     |                             |
                     v                             v
            +----------------+          resilient-fetch HTTP
            | HtmlExtractor  |          (fallback, static sites)
            | (pure function)|                 |
            +----------------+                 v
                     |                  +----------------+
                     |                  | HtmlExtractor  |
                     v                  +----------------+
            { properties: [...] }              |
                                               v
                                      { properties: [...] }
```

## Extraction Pipeline

The extraction engine (`astro-app/src/lib/extractor/html-extractor.ts`) processes field sections in a strict, fixed order. Each section overwrites prior values for the same key:

| Step | Section | Output type | Coercion |
|------|---------|-------------|----------|
| 1 | `defaultValues` | string | `fieldMapping.value` (static) |
| 2 | `images` | string[] | Image URL arrays |
| 3 | `features` | string[] | Feature string arrays |
| 4 | `intFields` | number | `parseInt(text, 10) \|\| 0` |
| 5 | `floatFields` | number | `parseFloat(text) \|\| 0` (with optional `stripPunct`, `stripFirstChar`) |
| 6 | `textFields` | string | `text.trim()` |
| 7 | `booleanFields` | boolean | Evaluator function (true/false) |

**Key rule**: if a field appears in multiple sections, the last one wins. For example, `count_bedrooms` in both `intFields` and `textFields` becomes a string.

## Extraction Strategies

Each field mapping selects a text retrieval strategy. The engine tries strategies in order; the last one that produces a result wins.

### Strategy reference

| Strategy | Properties | Description |
|----------|-----------|-------------|
| `cssLocator` | `cssLocator`, optional `cssAttr`/`xmlAttr`, `cssCountId` | CSS selector via Cheerio. Most common strategy. Without `cssCountId`, concatenates all matched elements. |
| `scriptJsonVar` + `scriptJsonPath` | `scriptJsonVar`, `scriptJsonPath` | Named JSON variable in `<script>` tags. Handles `window.VAR = {...}` and `<script id="VAR">` patterns. Cached per document. |
| `flightDataPath` | `flightDataPath` | Dot-path into Next.js RSC flight data (`self.__next_f.push`). Parses all chunks, resolves `$N` back-references. |
| `jsonLdPath` | `jsonLdPath`, optional `jsonLdType` | Dot-path into `<script type="application/ld+json">` structured data. `jsonLdType` filters by `@type`. |
| `scriptRegEx` | `scriptRegEx` | Regex pattern on concatenated `<script>` tag text. First capture group is returned. |
| `urlPathPart` | `urlPathPart` | Extract URL path segment by index (1-based). |
| `value` | `value` | Static default string (used in `defaultValues`). |
| `apiEndpoint` + `apiJsonPath` | `apiEndpoint`, `apiJsonPath` | Fetch JSON from an API endpoint and navigate via dot-path. `{id}` placeholder in URL is replaced with the property ID. |
| `fallbacks` | `fallbacks` (array of FieldMapping) | Array of alternative mappings tried in order when the primary strategy returns empty. |

### Post-processing options

Applied after text retrieval, before type coercion:

| Property | Description |
|----------|-------------|
| `cssAttr` / `xmlAttr` | Extract an HTML attribute instead of text content |
| `cssCountId` | Pick element at index (0-based). Without this, Cheerio concatenates all matches. |
| `splitTextCharacter` | Split extracted text by this character |
| `splitTextArrayId` | Pick element at index after splitting (0-based) |
| `stripString` | Remove first occurrence of this exact substring (runs after split) |
| `stripPunct` | Remove `.` and `,` characters (for number parsing) |
| `stripFirstChar` | Trim whitespace then remove first character (for currency symbols) |
| `imagePathPrefix` | Prefix for relative image paths |
| `modifiers` | Composable normalization pipeline |
| `caseInsensitive` | Lowercase before boolean evaluation |

### Strategy decision tree

| Site pattern | Strategy | Examples |
|---|---|---|
| Server-rendered HTML | `cssLocator` | Pisos.com, Fotocasa, ForSaleByOwner |
| `window.VAR = {...}` in script | `scriptJsonVar` + `scriptJsonPath` | Rightmove (`PAGE_MODEL`), Idealista (`__INITIAL_STATE__`) |
| Next.js `<script id="__NEXT_DATA__">` | `scriptJsonVar: "__NEXT_DATA__"` + `scriptJsonPath` | OnTheMarket, Daft.ie |
| Next.js RSC `self.__next_f.push` | `flightDataPath` | Realtor.com |
| Schema.org JSON-LD | `jsonLdPath` + optional `jsonLdType` | Zoopla, Domain, RealEstate.com.au |
| Inline JS variables | `scriptRegEx` | Legacy scrapers |
| Data in URL path | `urlPathPart` | Reference from URL slug |

## Scraper Mapping Schema

Mappings are JSON files in `config/scraper_mappings/<cc>_<portal>.json` (parsed with JSON5, so comments are allowed).

### Top-level structure

```json
[{
  "name": "uk_rightmove",
  "expectedExtractionRate": 0.85,
  "portal": {
    "hosts": ["www.rightmove.co.uk", "rightmove.co.uk"],
    "country": "GB",
    "currency": "GBP",
    "localeCode": "en-GB",
    "areaUnit": "sqft",
    "contentSource": "script-json",
    "stripTrailingSlash": false,
    "requiresJsRendering": false
  },
  "defaultValues": { ... },
  "textFields": { ... },
  "intFields": { ... },
  "floatFields": { ... },
  "booleanFields": { ... },
  "images": [ ... ],
  "features": [ ... ]
}]
```

### FieldMapping interface

```typescript
interface FieldMapping {
  // Strategy (pick one)
  cssLocator?: string;
  scriptRegEx?: string;
  flightDataPath?: string;
  scriptJsonPath?: string;
  scriptJsonVar?: string;
  jsonLdPath?: string;
  jsonLdType?: string;
  urlPathPart?: string;
  value?: string;
  apiEndpoint?: string;
  apiJsonPath?: string;

  // CSS modifiers
  cssAttr?: string;
  xmlAttr?: string;
  cssCountId?: string;

  // Post-processing
  splitTextCharacter?: string;
  splitTextArrayId?: string;
  stripString?: string;
  stripPunct?: string;
  stripFirstChar?: string;
  imagePathPrefix?: string;
  modifiers?: string[];

  // Boolean evaluation
  evaluator?: string;
  evaluatorParam?: string;
  caseInsensitive?: boolean;

  // Fallbacks
  fallbacks?: FieldMapping[];
}
```

### Boolean evaluators

`include?`, `start_with?`, `end_with?`, `present?`, `to_i_gt_0`, `==`

## API Endpoints

### Public API (`/public_api/v1/`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/public_api/v1/health` | None | Health check |
| GET | `/public_api/v1/supported_sites` | None | List supported portals |
| GET/POST | `/public_api/v1/listings?url=...` | API key | Extract listing from URL |
| GET | `/public_api/v1/listings/:id` | API key | Retrieve stored listing |
| GET | `/public_api/v1/listings/:id/scrapes` | API key | Scrape history for listing |
| POST | `/public_api/v1/listings/:id/enrich-images` | API key | Enrich listing images |
| GET/POST | `/public_api/v1/listings/:id/export` | API key | Export single listing |
| GET | `/public_api/v1/listings/history` | API key | Listing history |
| GET/POST | `/public_api/v1/export` | API key | Bulk export (JSON/CSV/GeoJSON) |
| POST | `/public_api/v1/webhooks` | API key | Register webhook |
| GET | `/public_api/v1/usage` | API key | API usage stats |
| POST | `/public_api/v1/auth/keys` | API key | Manage API keys |
| POST | `/public_api/v1/billing/checkout` | API key | Create Stripe checkout session |
| POST | `/public_api/v1/billing/portal` | API key | Stripe billing portal |
| POST | `/public_api/v1/stripe-webhook` | Stripe sig | Stripe webhook handler |

### Chrome Extension API (`/ext/v1/`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/ext/v1/hauls` | None | Create anonymous haul collection |
| GET | `/ext/v1/hauls/:id` | None | Get haul summary |
| POST | `/ext/v1/hauls/:id/scrapes` | None | Add scrape to haul |

### Extract Pages

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/` | None | Home page with extraction form |
| POST | `/scrapers/submit` | None | Form submission (returns HTML partial) |
| GET | `/single_property_view?url=...` | None | Property detail page |
| GET | `/extract/results/:id/update-html` | None | Update extraction HTML |
| GET | `/listings/:id.json` | None | Listing as JSON |
| GET | `/health` | None | Simple health check |

### Admin API (`/admin/`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/admin/logout` | Admin key | Logout |
| GET | `/admin/api/logs` | Admin key | Activity logs |
| GET | `/admin/api/config` | Admin key | Runtime config |
| POST | `/admin/api/actions` | Admin key | Admin actions |
| GET | `/admin/api/stats` | Admin key | System stats |
| GET | `/admin/api/scraper-health` | Admin key | Scraper health dashboard |
| POST | `/admin/api/ai-map` | Admin key | AI mapping suggestions |
| POST | `/admin/api/ai-map-save` | Admin key | Save AI mapping |
| GET | `/admin/api/extractions` | Admin key | Extraction history |
| GET | `/admin/api/extractions/:id` | Admin key | Extraction detail |
| GET | `/admin/api/scrapers/:name` | Admin key | Scraper detail |
| GET | `/admin/scrapers/list` | Admin key | Scraper list page |
| GET | `/admin/scrapers/test` | Admin key | Scraper test page |

API key is passed via `X-Api-Key` header or `api_key` query parameter.

## Services

### Portal Registry (`portal-registry.ts`)

Centralized config for all 22 supported portals. Each entry defines country, currency, locale, area unit, content source type (html/script-json/json-ld/flight-data), and JS rendering requirements. The URL validator derives its host map from this registry.

### Quality Scoring (`quality-scorer.ts`)

Fields are classified by importance:
- **Critical** (weight 3): title, price_string, price_float
- **Important** (weight 2): lat/lng, address, bedrooms, bathrooms, description, images, reference
- **Optional** (weight 1): all other fields

Grade is capped at C if any critical field is missing.

### Price Normalization (`price-normalizer.ts`)

Locale-aware parsing supporting EU format (1.250.000,50) and US format (1,250,000.50). Detects currency from symbols ($, £, €, ₹) with portal fallback. Outputs `NormalizedPrice` with integer cents and ISO 4217 currency code.

### URL Canonicalization (`url-canonicalizer.ts`)

Normalizes URLs: lowercase hosts, HTTPS upgrade, strips tracking params (utm_*, fbclid, gclid, ref, source, channel), removes fragments. `deduplicationKey()` extracts hostname + pathname for duplicate detection.

### Haul Store (`haul-store.ts`)

KV-backed persistence for anonymous haul collections created by the Chrome extension. Hauls hold up to 20 scrapes and expire after 30 days. Falls back to in-memory Map when KV is unavailable.

### Rate Limiter (`rate-limiter.ts`)

In-memory sliding window per API key or IP. 60 requests/minute default (configurable via `PWS_RATE_LIMIT`).

### Content Sanitizer (`field-processors.ts` — `sanitizePropertyHash`)

Strips HTML tags from text fields, rejects `javascript:` and `data:` URI schemes, normalizes protocol-relative URLs.

For `description`, the original HTML is first captured into `description_html` before stripping — only when the value contains HTML tags. This lets the listing detail page render formatted HTML while exporters and downstream consumers receive guaranteed plain text.

### Non-English content

The engine uses a **single-field + locale tag** model rather than per-locale field duplicates:

- `description` and `title` hold content in whatever language the portal uses
- `locale_code` follows **BCP-47** format (e.g. `'es'`, `'de'`, `'en-AU'`, `'de-DE'`) — signals the language to consumers
- Scraper mappings set `locale_code` via `defaultValues` for their portal
- `primaryLanguage(localeCode)` in `src/lib/utils/locale.ts` extracts the base language subtag: `"de-DE"` → `"de"`, `"en-AU"` → `"en"`, `"zh-Hant-TW"` → `"zh"`
- The **Kyero XML exporter** uses `primaryLanguage(locale_code)` to place content in the correct `<title lang>` / `<desc lang>` slot — falls back to `<en>` for languages outside Kyero's supported set (`en`, `es`, `de`, `fr`, `it`)
- The **Schema.org exporter** emits `inLanguage` using `primaryLanguage(locale_code)` so search engines can identify the content language
- `locale_code` is persisted through haul collections (`HaulScrape.locale_code`) and restored via the haul-export-adapter

Per-locale duplicate fields (`description_es`, `title_de`, etc.) are not used — they added complexity without real-world coverage since no portal delivers a listing in two languages simultaneously.

### HTML Change Detection

Every time a URL is submitted for scraping, the engine fingerprints the raw HTML and compares it against the stored hash for that URL. If the content is unchanged and the cached listing still exists, extraction is skipped and the cached result is returned immediately.

**Why:** Avoids redundant Cheerio parsing, CSS selector evaluation, and KV/Firestore writes when the Chrome extension (or any caller) resubmits a page that hasn't changed since the last scrape.

**How it works:**

1. `computeHtmlHash(html)` — SHA-256 of raw HTML, truncated to 16 hex chars (same Web Crypto pattern as `api-key-service.ts`), in `src/lib/utils/html-hash.ts`
2. **Size pre-check** — `html.length` is compared against `HtmlHashEntry.size` (free synchronous gate). A different size means the page definitely changed; hash computation is skipped and extraction proceeds immediately. A matching size triggers the full hash comparison.
3. `getHtmlHash(url)` — KV read at `html-hash:{stableId}` returns `{ hash, size }` or `null`
4. On hash match + live cached listing → return early with `wasUnchanged: true`
5. On miss, mismatch, or expired listing → run full extraction, then `storeHtmlHash(url, hash, size)` (fire-and-forget, 30-day TTL)

**KV key:** `html-hash:{stableId}` where `stableId = generateStableId(url)` (same 12-char SHA-256 hex already used for listings)

**TTL:** 30 days — intentionally longer than the listing's 24-hour KV TTL so the hash survives listing expiry. If the hash matches but the listing is gone, extraction runs normally.

**`wasUnchanged` flag:** Exposed as `wasUnchanged: boolean` on `ExtractionResult` and as `was_unchanged` in the `/ext/v1/hauls/:id/scrapes` API response — lets callers know whether the page content changed since the last seen scrape.

**Bypass:** When `sourceType === 'result_html_update'` (explicit user-initiated re-extraction), the hash check is skipped and extraction always runs.

**`html_hash` in `ScrapeRecord`:** The computed hash is stored as `html_hash` in the scrape record for per-URL content change observability in scrape history.

### Activity Logger (`activity-logger.ts`)

Structured JSON logging of extraction events (error/warn/info levels).

## Chrome Extensions

### Property Scraper (`chrome-extensions/property-scraper/`)

Public Manifest V3 extension for one-click extraction. Workflow:

1. User navigates to a supported listing page (green badge appears)
2. Clicks extension icon — popup opens
3. Content script captures `document.documentElement.outerHTML`
4. Background service worker creates a haul (if needed) via `POST /ext/v1/hauls`
5. Sends HTML + URL to `POST /ext/v1/hauls/:id/scrapes`
6. Popup renders property card with results
7. User can continue browsing and adding more listings to the same haul
8. Results page link shows all collected listings

### MCP Bridge (`chrome-extensions/mcp-bridge/`)

Dev-only extension that bridges Chrome to the MCP server via WebSocket (port 17824), enabling Claude Code to capture rendered HTML from the browser's active tab for fixture creation.

Protocol: JSON messages over `ws://localhost:17824`
- `tab_update` (ext → server): current tab URL/title
- `capture_request` (server → ext): request HTML capture
- `capture_response` (ext → server): captured HTML or error

## Known Limitations

1. **Single property per page** — Multi-property pages (search results) are not supported.
2. **Stale mappings** — When a site changes its HTML, the mapping must be manually updated.
3. **Boolean evaluators** — `evaluator` calls string methods by name. Safe for built-in mappings but should be validated for user-supplied mappings.
4. **No JS execution** — The extractor parses static HTML with Cheerio. Callers must provide fully-rendered HTML for JS-heavy sites.

## Legacy Rails Engine

The original Ruby/Nokogiri implementation lives in `app/` and `lib/`. It is no longer under active development. See [RAILS_README.md](RAILS_README.md) for details.
