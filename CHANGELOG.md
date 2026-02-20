# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- `description_html` field on `Listing` and `HaulScrape` — preserves the original HTML markup from scrapers (e.g. `<b>`, `<br />`, `<p>`) before tag-stripping; plain-text `description` is unchanged for all exporters and downstream consumers; listing detail page now renders the HTML version when available; haul endpoints include `description_html` capped at 1000 chars
- `locale_code` now included in `Listing#asJson()` output — signals the language of `description` and `title` to API consumers
- Non-English content strategy: single `description` field in the portal's native language, tagged with `locale_code` (e.g. `'es'`, `'de'`); per-locale duplicate fields (`description_es`, `title_de`, etc.) removed as dead code
- Kyero XML exporter updated to use `locale_code` for the language slot in `<title>` and `<desc>` elements rather than hardcoding `<en>`
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
