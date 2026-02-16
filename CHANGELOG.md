# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Portal configuration registry (`portal-registry.ts`) — centralized config for all 11 supported portals with country, currency, locale, content source, and JS rendering requirements
- Weighted quality scoring — fields classified as critical/important/optional with 3/2/1 weights; grade capped at C when critical fields (title, price) are missing
- Fallback strategy chains — `FieldMapping.fallbacks` array allows multiple extraction strategies per field, tried in order until one succeeds
- URL canonicalization and deduplication (`url-canonicalizer.ts`) — strips tracking params (utm_*, fbclid, gclid), normalizes protocol/host; listing store indexes by canonical URL to prevent duplicates
- Price normalization (`price-normalizer.ts`) — locale-aware parsing (EU `1.250.000,50` vs US `1,250,000.50`), currency detection from symbols, output as integer cents + ISO 4217 code
- `price_cents` and `price_currency` fields on Listing model
- Content provenance tracking — `analyzeContent()` detects HTML size, JSON-LD blocks, known script variables (PAGE_MODEL, __NEXT_DATA__), bot-blocked pages, and JS-only shells
- Schema splitting (`schema-splitter.ts`) — separates extraction output into asset data (physical property) and listing data (commercial/pricing) for downstream integration
- Admin UI: portal metadata badges on scraper detail page, weighted rate display, critical fields warnings, content analysis card, fallback indicators in field traces
- `HtmlExtractor` service — pure-function HTML extraction with zero network I/O; accepts raw HTML + source URL and returns structured property data
- HTML-first input across all endpoints — `html` (string) and `html_file` (upload) parameters on `/scrapers/submit`, `/retriever/as_json`, `/api/v1/listings`, and `/single_property_view`
- `POST /api/v1/listings` route for submitting HTML via API
- Redesigned landing page with dark gradient hero, tabbed input form (URL / Paste HTML / Upload File), inline AJAX results, and "How It Works" walkthrough
- Stimulus `scraper-form` controller — handles tab switching and fetch-based form submission with loading spinner
- Styled result cards for both success (property card with stat pills, expandable fields, image thumbnails) and error (unsupported-site list, tips for JS-rendered sites)
- `DESIGN.md` documenting architecture, API reference, mapping schema, and migration guide
- `UrlValidator` service — single entry point for URL validation across all controllers
- `ScrapedContentSanitizer` service — strips HTML tags, blocks dangerous URI schemes (`javascript:`, `data:`), and normalises protocol-relative URLs before persistence
- API key authentication via `authenticate_api_key!` in `ApplicationController`; supports `X-Api-Key` header and `api_key` query parameter
- `Listing#import_host` association method with memoisation and cache-clearing on slug change
- `Rails.logger` calls for scraping attempts, results, and failures
- Error-path specs for network timeouts, malformed HTML, missing fields, and unsupported URLs
- `.env.development` template with Firestore emulator defaults

### Changed
- `Scraper` refactored to thin orchestration layer delegating extraction to `HtmlExtractor`; direct HTTP fetch now logs a deprecation warning
- `ListingRetriever` accepts `html:` keyword parameter, passed through to `Scraper`
- Landing page layout uses full-width hero; stash and error views wrap content in their own containers
- `Listing.update_from_hash` now calls `ScrapedContentSanitizer.call` before persisting data
- All controllers delegate URL parsing to `UrlValidator` instead of inline `URI.parse` calls

### Fixed
- `Listing` super call for `FirestoreModel` compatibility (3096316f)
- CI emulator startup reliability (3096316f)

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
