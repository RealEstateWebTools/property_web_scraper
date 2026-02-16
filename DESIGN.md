# PropertyWebScraper Design Document

## Architecture Overview

PropertyWebScraper uses an **HTML-first extraction** architecture with
**fetch-as-fallback**. The core extraction logic lives in `HtmlExtractor`, a
pure-function service that takes raw HTML and returns structured property data.
No network I/O happens inside the extractor.

```
  External caller (Chrome extension, headless browser, curl)
       |
       | provides rendered HTML + source URL
       v
  +-----------------+        +------------------+
  |  Controllers    | -----> |  Scraper         |
  | (API / Web UI)  |        | (orchestration)  |
  +-----------------+        +------------------+
                                   |
                    +--------------+--------------+
                    |                             |
              html: provided?               html: nil?
                    |                             |
                    v                             v
           +----------------+          open-uri HTTP fetch
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

## Why This Change

Most modern real estate websites use client-side rendering (React, Vue, etc.).
The original `open-uri` + Nokogiri pipeline cannot execute JavaScript, so live
scraping silently returns empty or incorrect data on these sites.

By pushing the responsibility for obtaining fully-rendered HTML to the caller,
the engine focuses on what it does well: extracting structured property data
from HTML using configurable mappings. A Chrome extension, Puppeteer script, or
any other tool can handle JS rendering, cookies, and anti-bot measures, then
pass the result to this engine.

Direct HTTP fetching remains available as a fallback for static sites, with a
deprecation warning logged on each use.

## Component Reference

### `HtmlExtractor` (new)

Location: `app/services/property_web_scraper/html_extractor.rb`

Pure-function service. Zero network I/O.

```ruby
HtmlExtractor.call(
  html: "<html>...</html>",             # required
  source_url: "https://example.com/...", # required
  scraper_mapping_name: "idealista",     # optional (auto-detects from URL host)
  scraper_mapping: mapping_object        # optional (takes precedence)
)
# => { success: true, properties: [{ "title" => "...", ... }] }
```

**Mapping resolution order:**
1. `scraper_mapping:` parameter (pre-loaded object)
2. `scraper_mapping_name:` parameter (looked up via `ScraperMapping.find_by_name`)
3. Auto-detect from `source_url` host via `ImportHost`

### `Scraper` (refactored)

Location: `app/services/property_web_scraper/scraper.rb`

Thin orchestration layer. Delegates extraction to `HtmlExtractor`.

```ruby
scraper = Scraper.new('idealista')

# With pre-rendered HTML (no HTTP fetch):
listing = scraper.process_url(url, import_host, html: rendered_html)

# Without HTML (legacy fallback, fetches via open-uri):
listing = scraper.process_url(url, import_host)
```

Key methods:
- `process_url(url, import_host, html: nil)` - main entry point
- `retrieve_and_save(listing, slug, html: nil)` - extract + persist
- `retrieve_from_webpage(url)` - legacy method, fetches then extracts

### `ListingRetriever` (updated)

Location: `app/services/property_web_scraper/listing_retriever.rb`

```ruby
# With HTML:
result = ListingRetriever.new(url, html: rendered_html).retrieve

# Without HTML (legacy):
result = ListingRetriever.new(url).retrieve
```

## API Reference

All endpoints that accept `url` now also accept optional `html` (as a POST
body parameter) or `html_file` (as a multipart file upload). When either is
present, no HTTP fetch occurs.

### `POST /retriever/as_json`

Retrieves a property listing and returns JSON.

| Parameter   | Type   | Required | Description                              |
|-------------|--------|----------|------------------------------------------|
| `url`       | string | yes      | Property page URL                        |
| `html`      | string | no       | Pre-rendered HTML string                 |
| `html_file` | file   | no       | Uploaded HTML file (takes precedence)    |
| `client_id` | string | no       | Client identifier                        |

### `POST /scrapers/submit`

AJAX form submission handler.

| Parameter    | Type   | Required | Description                              |
|--------------|--------|----------|------------------------------------------|
| `import_url` | string | yes      | Property page URL                        |
| `html`       | string | no       | Pre-rendered HTML string                 |
| `html_file`  | file   | no       | Uploaded HTML file                       |

### `GET|POST /api/v1/listings`

REST API endpoint returning PwbListing-formatted JSON.

| Parameter   | Type   | Required | Description                              |
|-------------|--------|----------|------------------------------------------|
| `url`       | string | yes      | Property page URL                        |
| `html`      | string | no       | Pre-rendered HTML string                 |
| `html_file` | file   | no       | Uploaded HTML file                       |

### `GET /single_property_view`

Renders a single property page.

| Parameter   | Type   | Required | Description                              |
|-------------|--------|----------|------------------------------------------|
| `url`       | string | yes      | Property page URL                        |
| `html`      | string | no       | Pre-rendered HTML string                 |
| `html_file` | file   | no       | Uploaded HTML file                       |

## Scraper Mapping Schema

Mappings are JSON files in `config/scraper_mappings/`. Each file defines how to
extract property fields from HTML for a specific website.

### Top-level structure

```json
[{
  "name": "site_name",
  "defaultValues": { ... },
  "textFields": { ... },
  "intFields": { ... },
  "floatFields": { ... },
  "booleanFields": { ... },
  "images": [ ... ],
  "features": [ ... ]
}]
```

### Field types

**`defaultValues`** - Static values, no extraction needed:
```json
{ "country": { "value": "Spain" }, "currency": { "value": "EUR" } }
```

**`textFields`** - Extracted as strings:
```json
{ "title": { "cssLocator": "title" } }
```

**`intFields`** - Extracted as integers (`.to_i`):
```json
{ "count_bedrooms": { "cssLocator": ".bedrooms span" } }
```

**`floatFields`** - Extracted as floats (`.to_f`):
```json
{ "price_float": { "cssLocator": ".price", "stripPunct": "true" } }
```

**`booleanFields`** - Extracted via evaluator method:
```json
{
  "for_sale": {
    "cssLocator": ".sale-indicator",
    "evaluator": "include?",
    "evaluatorParam": "for sale"
  }
}
```

**`images`** - Array extraction:
```json
[{ "cssLocator": "img.gallery", "xmlAttr": "data-src" }]
```

**`features`** - Array extraction:
```json
[{ "cssLocator": ".feature-list li" }]
```

### Extraction strategies

Each field mapping can use one or more of these strategies:

| Key              | Description                                         |
|------------------|-----------------------------------------------------|
| `cssLocator`     | CSS selector (Nokogiri/Cheerio)                     |
| `xpath`          | XPath expression (deprecated — use CSS)             |
| `scriptRegEx`    | Regex applied to all `<script>` tag text            |
| `urlPathPart`    | Extract from URL path segments (1-indexed)          |
| `flightDataPath` | Dot-path into Next.js RSC flight data               |
| `scriptJsonPath` | Dot-path into a parsed script JSON variable         |
| `scriptJsonVar`  | Variable name for scriptJsonPath (e.g. PAGE_MODEL)  |
| `jsonLdPath`     | Dot-path into JSON-LD structured data               |
| `jsonLdType`     | Filter JSON-LD by `@type` before path lookup        |
| `fallbacks`      | Array of alternative FieldMapping objects tried in order if the primary strategy returns empty |

### Post-processing options

| Key                  | Description                                       |
|----------------------|---------------------------------------------------|
| `cssAttr`            | Extract an HTML attribute instead of text content  |
| `xmlAttr`            | Extract an XML-style attribute                     |
| `cssCountId`         | Select Nth element from matched set (0-indexed)    |
| `splitTextCharacter` | Split extracted text by this character              |
| `splitTextArrayId`   | Select Nth element from split result (0-indexed)   |
| `stripString`        | Remove first occurrence of this substring          |
| `stripPunct`         | Remove dots and commas (for number parsing)        |
| `stripFirstChar`     | Remove first character (e.g., currency symbol)     |
| `imagePathPrefix`    | Prefix for relative image paths                    |
| `caseInsensitive`    | Downcase before boolean evaluation                 |

## Usage Examples

### Chrome extension

```javascript
// Content script captures rendered HTML
const html = document.documentElement.outerHTML;
const url = window.location.href;

fetch('https://your-app.com/retriever/as_json', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: `url=${encodeURIComponent(url)}&html=${encodeURIComponent(html)}`
});
```

### Headless browser (Puppeteer/Playwright)

```javascript
const page = await browser.newPage();
await page.goto(url, { waitUntil: 'networkidle0' });
const html = await page.content();

const response = await fetch('https://your-app.com/api/v1/listings', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url, html })
});
```

### curl with HTML file

```bash
curl -X POST https://your-app.com/retriever/as_json \
  -F "url=https://www.idealista.com/inmueble/123/" \
  -F "html_file=@saved_page.html"
```

### curl with inline HTML

```bash
curl -X POST https://your-app.com/retriever/as_json \
  -d "url=https://www.idealista.com/inmueble/123/" \
  -d "html=$(cat saved_page.html)"
```

### Ruby (direct service call)

```ruby
result = PropertyWebScraper::HtmlExtractor.call(
  html: File.read('saved_page.html'),
  source_url: 'https://www.idealista.com/inmueble/123/',
  scraper_mapping_name: 'idealista'
)
puts result[:properties].first['title']
```

## Migration Guide

### For existing callers (no changes needed)

All existing endpoints and method signatures remain backward compatible.
When `html` is not provided, the system falls back to direct HTTP fetching
exactly as before. A deprecation warning is logged on each direct fetch.

### For new callers (recommended path)

1. Obtain fully-rendered HTML from your source (Chrome extension, headless
   browser, saved file, etc.)
2. POST to any endpoint with both `url` and `html` (or `html_file`) parameters
3. The `url` parameter is still required for:
   - Host/mapping auto-detection
   - Relative URL resolution in extracted data
   - URL-path-based field extraction

### For Ruby callers

Use `HtmlExtractor.call` directly for extraction without persistence:

```ruby
result = PropertyWebScraper::HtmlExtractor.call(
  html: html_string,
  source_url: url
)
```

Or use `Scraper` with the `html:` keyword for the full extract-and-persist flow:

```ruby
scraper = PropertyWebScraper::Scraper.new('idealista')
listing = scraper.process_url(url, import_host, html: html_string)
```

## Astro App Pipeline Enhancements

The Astro app (`astro-app/`) extends the core extraction pipeline with several
services for production-grade data quality:

### Portal Registry (`portal-registry.ts`)

Centralized configuration for all supported property portals. Each entry
defines the portal's country, default currency, locale, area unit, content
source type (html/script-json/json-ld/flight-data), and whether JS rendering
is required. The URL validator derives its host map from this registry.

### Weighted Quality Scoring (`quality-scorer.ts`)

Fields are classified by importance:
- **Critical** (weight 3): title, price_string, price_float
- **Important** (weight 2): lat/lng, address, bedrooms, bathrooms, description, images, reference
- **Optional** (weight 1): all other fields

`assessQualityWeighted()` computes a weighted extraction rate and caps the
quality grade at C if any critical field is missing.

### Fallback Strategy Chains (`strategies.ts`)

Field mappings can define a `fallbacks` array of alternative mappings. When the
primary strategy returns empty text, fallbacks are tried in order. The
`RetrievalResult` records which strategy (primary or fallback N) produced the
value.

### URL Canonicalization (`url-canonicalizer.ts`)

Normalizes URLs by lowercasing hosts, upgrading to HTTPS, removing tracking
parameters (utm_*, fbclid, gclid, ref, source, channel), and stripping
fragments. `deduplicationKey()` extracts hostname + pathname for duplicate
detection in the listing store.

### Price Normalization (`price-normalizer.ts`)

Locale-aware price parsing supporting EU format (1.250.000,50) and US format
(1,250,000.50). Detects currency from symbols ($, £, €, ₹) with portal
fallback. Outputs `NormalizedPrice` with integer cents and ISO 4217 currency
code.

### Content Provenance Tracking (`html-extractor.ts`)

`analyzeContent()` inspects the HTML to detect:
- Known script variables (PAGE_MODEL, __NEXT_DATA__, __INITIAL_STATE__, dataLayer)
- JSON-LD block count
- Bot-blocked pages (short body + captcha/verify keywords)
- JS-only shell pages (short body text + many scripts + few divs)

Results are included in `ExtractionDiagnostics.contentAnalysis`.

### Schema Splitting (`schema-splitter.ts`)

Separates the extraction property hash into three categories:
- **Asset data**: physical property attributes (title, address, rooms, coordinates, images)
- **Listing data**: commercial attributes (price, currency, sale/rent flags, furnished)
- **Unmapped**: fields not in either set

## Known Limitations

1. **Boolean field evaluation uses `send`** - The `evaluator` field in boolean
   mappings calls arbitrary string methods via `send`. This is safe for the
   built-in mappings (which use `include?`) but should be validated if
   user-supplied mappings are supported in the future.

2. **Stale mappings** - Scraper mappings are loaded from static JSON files.
   When a target site changes its HTML structure, the mapping must be manually
   updated.

3. **No retry/resilience** - The direct HTTP fetch path has basic redirect
   handling (3 attempts) but no retry logic for transient failures.

4. **Single property per page** - The extraction always returns a
   single-element array. Multi-property pages (e.g., search results) are not
   supported.

5. **No JavaScript execution** - `HtmlExtractor` parses static HTML with
   Nokogiri. It cannot execute JavaScript. Callers must provide fully-rendered
   HTML for JS-heavy sites.
