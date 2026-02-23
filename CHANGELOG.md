# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Unit test suite for critical services: `html-analysis.ts` (48 tests), `api-guard.ts` (7 tests), `resilient-fetch.ts` (13 tests), `scraper-health-trends.ts` (16 tests), `retention-cleanup.ts` (11 tests), `scrape-handler.ts` (13 tests) — total suite now 2254 tests across 79 files
- `DevKV.list()` — implements KV key listing with prefix, limit, and cursor support, mirroring the Cloudflare Workers KV API
- `ApiErrorCode.INTERNAL_ERROR` — adds a 500 error code for unhandled server errors
- `'debug'` log level in `LogLevel` union alongside info/warn/error
- `'api_key'`, `'stripe'`, `'webhook'` categories added to `LogCategory` for billing and auth events

### Changed
- `docs/property-context.md` renamed and restructured as `docs/property_data_enhancer.md`; clarifies the enrichment service is standalone (no shared code or database), takes a haul URL as input, and supports per-country modules via `COUNTRY_CODE` env var

### Fixed
- TypeScript type-safety across 21 files: `ExtractionDiagnostics` fields made optional (`extractableFields`, `extractionRate`, `qualityGrade`, `confidenceScore`, `visibility`); all Firestore `doc.data()` casts updated to `as unknown as T`; `AnyNode` imported from `domhandler` instead of `cheerio` to match cheerio v1 re-exports; `weightedRate` renamed to `weightedExtractionRate` in scraper-health admin API
- Test suite sync after type changes: awaited `OPTIONS()` responses in api-endpoints tests, added missing diagnostic fields to `storeDiagnostics` fixtures, added `"vitest/globals"` to `tsconfig.json` types

### Security
- XSS fixes: `escapeHtml()` applied to all dynamic `innerHTML` assignments across 14 Astro pages and admin pages (`dashboard.astro`, `hauls.astro`, `privacy.astro`, `haul/[id].astro`, `extract/results/[id].astro`, and all admin pages)

### Changed
- Admin scraper-health page replaces hardcoded 13-entry `FIXTURE_MAP` with auto-discovery via `resolveFixtureName()` — checks `<scraper_name>.html` first, falling back to a minimal legacy map for 5 non-standard names
- `WhereChain` antipattern removed from `listing-retriever.ts` and `public_api/v1/listings.ts`; replaced with proper `Listing.where()` API

### Added
- Webhook delivery retry with exponential backoff (500ms, 1s) — retries on network errors, 429, and 5xx; max 2 retries (3 total attempts)
- KV-backed dead-letter queue (`dead-letter.ts`) — captures fire-and-forget failures from webhooks, Firestore writes, price history, scrape metadata, and usage recording; 30-day TTL, FIFO eviction at 500 entries
- Dead-letter count exposed in health endpoint (`/public_api/v1/health` → `checks.dead_letters.count`)
- `'quality'` added to `LogCategory` type union to match existing usage in `scrape-metadata.ts`

### Security
- XSS fix: `description_html` output is now sanitized to prevent script injection
- Admin query-parameter authentication removed in favour of `apiGuard()` middleware
- Content-Security-Policy header added to all responses

### Added
- `apiGuard()` helper for consistent API authentication and authorization
- `KVNamespace` type interface (`kv-types.ts`) for portable KV abstraction
- `html-analysis.ts` content provenance extraction (JSON-LD, script vars, bot detection)
- Exporter test suite (200 tests) covering Kyero XML, Schema.org JSON-LD, CSV, and JSON outputs
- API endpoint test suite (49 tests) for public API, haul, and admin routes
- MCP bridge exponential backoff with jitter for reconnection reliability
- Scraper mapping `version` and `last_checked` metadata fields
- Health endpoint now probes KV and Firestore connectivity (`/public_api/v1/health`)

### Changed
- Catch blocks in service layer now use structured `logActivity()` instead of raw `console.error`

### Fixed
- Duplicate Firestore documents on manual extraction — `retrieveListing()` no longer saves internally; extract pages use `generateStableId(url)` for idempotent, URL-based document IDs

### Added
- HTML content hash change detection: incoming HTML is fingerprinted (SHA-256, 16-char hex) and compared against the stored hash for the URL; unchanged pages short-circuit extraction and return the cached listing with `was_unchanged: true` in the API response
- `html_hash` field added to `ScrapeRecord` for per-URL content change observability in scrape history
- `html-hash:{stableId}` KV key stores hash + size per URL (30-day TTL)
- `description_html` field on `Listing` and `HaulScrape` — preserves the original HTML markup from scrapers (e.g. `<b>`, `<br />`, `<p>`) before tag-stripping; plain-text `description` is unchanged for all exporters and downstream consumers; listing detail page now renders the HTML version when available; haul endpoints include `description_html` capped at 1000 chars
- `locale_code` now included in `Listing#asJson()` output — signals the language of `description` and `title` to API consumers
- Non-English content strategy: single `description` field in the portal's native language, tagged with `locale_code` (e.g. `'es'`, `'de'`); per-locale duplicate fields (`description_es`, `title_de`, etc.) removed as dead code
- Kyero XML exporter updated to use `locale_code` for the language slot in `<title>` and `<desc>` elements rather than hardcoding `<en>`
- **BCP-47 locale normalization** — new `primaryLanguage()` utility (`src/lib/utils/locale.ts`) extracts the base language subtag from any BCP-47 locale code (`"de-DE"` → `"de"`, `"en-AU"` → `"en"`, `"zh-Hant-TW"` → `"zh"`); Kyero and Schema.org exporters now use this so regional variants (`de-DE`, `en-AU`) map to the correct language slot instead of silently falling back to `<en>`
- **Schema.org `inLanguage`** — the Schema.org / JSON-LD exporter now emits `inLanguage` on each `RealEstateListing` node using `primaryLanguage(locale_code)`, enabling search engines to identify content language for all locales
- **`locale_code` in haul persistence** — `HaulScrape` interface gains `locale_code?`; the field is now round-tripped through `/ext/v1/hauls/:id/scrapes`, `/ext/v1/hauls/:id/add-result`, and the haul-export-adapter so locale context is never lost when listings are stored and re-exported
- Anonymous haul collections for Chrome extension — browse multiple listings, collect them into a shareable results page without login or API key
- `POST /ext/v1/hauls`, `GET /ext/v1/hauls/:id`, `POST /ext/v1/hauls/:id/scrapes` endpoints
- KV-backed haul store with in-memory fallback (`haul-store.ts`)
- Keep-alive alarm in MCP bridge to prevent service worker termination

### Changed
- Chrome extension simplified to summary + results page link (haul-based workflow)

## [1.0.0] — 2026-02-15

Astro 5 SSR rewrite of the extraction engine, replacing the Rails implementation. All Phase 1-2 roadmap items complete.

### Added
- **Astro 5 SSR application** (`astro-app/`) with Cloudflare Pages deployment
- Split Chrome extension into two: `chrome-extensions/property-scraper/` (public, one-click extraction) and `chrome-extensions/mcp-bridge/` (dev-only WebSocket bridge to MCP server)
- WebSocket bridge between Chrome extension and MCP server — `capture_page` and `extension_status` tools let Claude Code capture rendered HTML from the browser's active tab and save it as a test fixture
- Connection status indicator in extension popup — green/grey dot shows whether the MCP server bridge is active
- Portal configuration registry (`portal-registry.ts`) — centralized config for all 17 supported portals with country, currency, locale, content source, and JS rendering requirements
- Weighted quality scoring — fields classified as critical/important/optional with 3/2/1 weights; grade capped at C when critical fields (title, price) are missing
- Fallback strategy chains — `FieldMapping.fallbacks` array allows multiple extraction strategies per field, tried in order until one succeeds
- URL canonicalization and deduplication (`url-canonicalizer.ts`) — strips tracking params (utm_*, fbclid, gclid), normalizes protocol/host; listing store indexes by canonical URL to prevent duplicates
- Price normalization (`price-normalizer.ts`) — locale-aware parsing (EU `1.250.000,50` vs US `1,250,000.50`), currency detection from symbols, output as integer cents + ISO 4217 code
- `price_cents` and `price_currency` fields on Listing model
- Content provenance tracking — `analyzeContent()` detects HTML size, JSON-LD blocks, known script variables (PAGE_MODEL, __NEXT_DATA__), bot-blocked pages, and JS-only shells
- Schema splitting (`schema-splitter.ts`) — separates extraction output into asset data (physical property) and listing data (commercial/pricing) for downstream integration
- Admin UI: portal metadata badges on scraper detail page, weighted rate display, critical fields warnings, content analysis card, fallback indicators in field traces
- `HtmlExtractor` service — pure-function HTML extraction with zero network I/O; accepts raw HTML + source URL and returns structured property data
- HTML-first input across all endpoints — `html` (string) and `html_file` (upload) parameters
- Public API endpoints: `/public_api/v1/listings`, `/public_api/v1/supported_sites`, `/public_api/v1/health`
- Structured error responses with error codes (`MISSING_URL`, `INVALID_URL`, `UNSUPPORTED_HOST`, `UNAUTHORIZED`, `RATE_LIMITED`, etc.)
- Input validation (size limits, Content-Type enforcement)
- In-memory rate limiting (60 req/min default, configurable)
- CORS headers on all API responses
- Content sanitization — strips HTML tags, blocks dangerous URI schemes
- API key authentication via `X-Api-Key` header or `api_key` query parameter
- Redesigned landing page with dark gradient hero, tabbed input form, inline AJAX results
- `DESIGN.md` documenting architecture, API reference, mapping schema
- 17 scraper mappings across 8 countries
- Vitest unit tests and Playwright E2E tests
- `capture-fixture` CLI utility for creating HTML test fixtures

### Changed
- Full rewrite from Ruby/Rails/Nokogiri to TypeScript/Astro/Cheerio
- Extraction pipeline processes 7 strategy types: cssLocator, scriptJsonVar, scriptJsonPath, flightDataPath, jsonLdPath, scriptRegEx, urlPathPart
- Scraper mappings extended with `portal` metadata block, `expectedExtractionRate`, `fallbacks`

### Removed
- Stale scrapers: cerdfw, carusoimmobiliare, weebrix, inmo1, pwb

## [0.2.0] — 2026-02-01

### Added
- Cloud Firestore persistence layer replacing PostgreSQL (`FirestoreModel` base class)
- Firestore emulator support for development and CI
- Bootstrap 5 layout with Turbo and Stimulus
- `dotenv-rails` for environment configuration
- Seed data task (`property_web_scraper:db:seed`)
- Firestore model and integration specs

### Changed
- Migrated all models from ActiveRecord to Firestore document storage
- Replaced legacy frontend (Bootstrap 4 alpha, jQuery, Vue/Vuetify) with Turbo + Stimulus
- Upgraded Rails 7.1 to 7.2, money-rails 1 to 3, rack-cors 2 to 3, rspec-rails 6 to 8
- `Listing#update_from_hash` uses `.presence` and `nil` instead of defaulting missing numerics to `0`

### Fixed
- XSS vulnerabilities — replaced unescaped ERB output with safe rendering (b3278cb9)
- `rescue Exception` blocks narrowed to `rescue StandardError` (b3278cb9)
- XPath method bug — `doc.css` changed to `doc.xpath` where appropriate (b3278cb9)
- Stimulus controller loading and scraper HTTP error handling (ce0df6c5)

### Removed
- PostgreSQL schema, migrations, and ActiveRecord dependencies
- Legacy theme layouts (`spp_lite`, `spp_modern`, `spp_vuetify`) and associated assets
- Hardcoded Google Maps API key (replaced with `ENV.fetch`)
- All commented-out dead code

### Security
- Removed exposed Google Maps API key from source (3263ef6f)
- Eliminated stored XSS via unescaped ERB and `.html_safe` calls (b3278cb9)
