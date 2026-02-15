# PropertyWebScraper — Project Review

## Overview

PropertyWebScraper is a Ruby on Rails engine for scraping real estate property listings from various websites. It uses configurable JSON mappings with CSS selectors, XPath expressions, and regex patterns to extract property data. The engine is mountable into any Rails app and was used in production by homestocompare.com.

**Tech stack:** Rails 7.2 engine, Cloud Firestore, Nokogiri, Faraday, ActiveHash, Turbo + Stimulus, Bootstrap 5
**Test suite:** 87+ examples across 23 spec files, VCR cassettes for HTTP mocking
**License:** MIT

---

## What It Does Well

### 1. Configurable Scraper Architecture
The use of `ActiveHash` with JSON config files (`config/scraper_mappings/*.json`) means adding support for a new website requires only a new JSON file — no Ruby code changes. This is a clean separation of configuration from logic.

### 2. Flexible Data Extraction
The `Scraper` service supports multiple extraction strategies:
- CSS selectors
- XPath expressions
- Regex patterns
- URL path extraction
- Custom evaluator methods

This covers the vast majority of real-world scraping scenarios.

### 3. Rails Engine Design
The mountable engine pattern (`PropertyWebScraper::Engine`) allows clean integration into any host Rails app via a single `mount` in routes and standard migration installation.

### 4. VCR-Based Test Suite
HTTP interactions are recorded as YAML cassettes (`spec/fixtures/vcr/`), making tests deterministic and fast. 14 cassettes cover 12+ real estate websites across multiple countries.

### 5. Modern Frontend Stack
Legacy theme variants were replaced with a single Bootstrap 5 layout using Turbo and Stimulus for interactivity.

### 6. Decent Test Coverage Foundations
87 test examples covering models, services, controllers, and individual scraper implementations. Good use of FactoryBot traits for different listing types.

---

## What It Does Badly

### Security

#### ~~XSS Vulnerabilities~~ — FIXED (b3278cb9)
Unescaped ERB output (`<%==`, `.html_safe`) was replaced with safe rendering across all views.

#### ~~Exposed API Key~~ — FIXED (3263ef6f, removed in 8910e5dc)
The hardcoded Google Maps API key was replaced with `ENV.fetch('GOOGLE_MAPS_API_KEY', '')`. The `spp_modern` layout that contained it was later removed entirely.

#### CSRF Protection Disabled (High)
Both `ScraperController` and `SinglePropertyViewController` disable CSRF protection (`protect_from_forgery with: :null_session` or commented out entirely) with no alternative authentication mechanism.

#### ~~JSON Injection~~ — FIXED (8910e5dc)
The Vuetify layout with unescaped `<%==` in script tags was removed as part of the frontend modernization.

### Error Handling

#### ~~Overly Broad Exception Catching~~ — FIXED (b3278cb9)
All `rescue Exception` blocks were changed to `rescue StandardError`.

#### ~~Silent Error Swallowing~~ — FIXED (ef2e32a0)
Rescue blocks now log exceptions via `Rails.logger`.

#### ~~No Logging~~ — FIXED (ef2e32a0)
`Rails.logger` calls added for scraping attempts, results, and failures.

### Data Integrity

#### ~~Zero as Sentinel Value~~ — FIXED (cd329df0)
`Listing#update_from_hash` now uses `.presence` to leave blank numeric fields as `nil` instead of defaulting to `0`.

#### Empty Array Bug
`scraper.rb` uses `property_hash['image_urls'].presence || []`. Since `.presence` on an empty array `[]` returns `nil`, empty image arrays are silently lost and re-defaulted.

#### ~~Redundant Pricing Columns~~ — FIXED (cd329df0)
The Firestore migration removed the money-rails monetized columns. Pricing now uses `price_string` and `price_float` only.

### Bugs

#### ~~XPath Method Bug~~ — FIXED (b3278cb9)
`doc.css(mapping['xpath'])` was changed to `doc.xpath(mapping['xpath'])`.

#### Missing Nil Checks
- `ScraperController#config_as_json` looks up `scraper_mapping` but never checks for nil before calling `.attributes`
- `SinglePropertyViewController` duplicates URL parsing logic instead of using the shared `uri_from_url` method from `ApplicationController`

### Code Quality

#### ~~Massive Commented-Out Code~~ — FIXED (b3278cb9, 8910e5dc)
Dead commented-out code was removed across controllers, models, and views. Legacy theme layouts (`spp_lite`, `spp_modern`, `spp_vuetify`) were deleted entirely.

#### ~~Duplicated Logic~~ — FIXED (ef2e32a0)
URL validation and parsing was reimplemented in four places (now consolidated in `UrlValidator`):
1. `ApplicationController#uri_from_url`
2. `ScraperController#retrieve_as_json`
3. `SinglePropertyViewController#show`
4. `Api::V1::ListingsController#index`

Each has slightly different error handling behavior.

#### Hardcoded Values
- `SinglePropertyViewController` hardcodes `theme_name = "spp_vuetify"` despite having 4 themes
- `ScraperController#config_as_json` hardcodes `"www.realtor.com"` as the only supported host
- `ImportHost#stale_age_duration` hardcodes `"1.day"` despite having a database column for it
- `ScraperController#ajax_submit` uses magic number `5` for client_id length validation
- Placeholder image URL `https://placeholdit.co//i/500x250` (likely defunct service)

### ~~Frontend~~ — FIXED (8910e5dc)

The legacy frontend (Bootstrap 4 alpha, jQuery, Tether, Vue/Vuetify, Font Awesome 4) was replaced with Bootstrap 5, Turbo, and Stimulus. All dead UI components, placeholder content, and unpinned CDN dependencies were removed.

### Tests

#### ~~VCR Allows Real HTTP Calls~~ — FIXED (ef2e32a0)
`allow_http_connections_when_no_cassette` is now `false` in `spec/support/vcr_setup.rb`.

#### Stale Cassettes
Some cassettes date from 2018 (e.g., `idealista_2018_01.yml`). The websites have certainly changed their HTML structure since then, meaning tests pass against old HTML but live scraping likely fails.

#### Wildly Inconsistent Coverage
| Scraper | Assertions | Quality |
|---------|-----------|---------|
| Idealista | 26+ | Excellent |
| Rightmove | 9+ | Excellent |
| Realtor | 10+ | Excellent |
| WyomingMLS | 9 | Good |
| MLSListings | 8 | Good |
| Zoopla | 6 | Good |
| Fotocasa | 3 | Minimal |
| PWB | 5 | Minimal |
| Pisos.com | 1 | Marked TODO |
| RealEstateIndia | 0 | Zero assertions |

#### ~~No Error Path Testing~~ — FIXED (ef2e32a0)
Error-path specs now cover network timeouts, malformed HTML, missing fields, unsupported URLs, and HTTP error responses.

### Configuration

#### Gemspec Issues
- **Email typo:** `etewiah@hotmail.cim` should be `etewiah@hotmail.com`
- **Overly broad version constraints:** `rails >= 7.1` allows any future Rails version; `nokogiri` has no constraint at all
- **Capybara declared but unused:** Listed as dev dependency but no feature/system specs exist
- **`ostruct` as explicit dependency** is unusual — it's part of Ruby's standard library

#### CI/CD Gaps
The GitHub Actions workflow (`ci.yml`) only runs `rspec`. Missing:
- Rubocop linting (gem is in Gemfile but not run in CI)
- SimpleCov coverage enforcement (gem is in Gemfile but not configured)
- Bundler audit for security vulnerabilities
- Multi-Ruby version matrix (only tests Ruby 3.2)

#### ~~Unused Database Columns / Missing Indexes~~ — N/A (cd329df0)
The migration to Firestore removed the PostgreSQL schema. Firestore models declare only the attributes they use. Indexes are managed via Firestore's composite index configuration.

---

## What It Doesn't Do At All

| Feature | Notes |
|---------|-------|
| ~~**Authentication / Authorization**~~ | ~~DONE (ef2e32a0). API key authentication via `authenticate_api_key!`.~~ |
| **Rate Limiting** | No throttling on scraping requests or API endpoints. `pause_between_calls` column exists but is never read. |
| ~~**Logging / Monitoring**~~ | ~~DONE (ef2e32a0). `Rails.logger` calls for scraping attempts, results, and failures.~~ |
| **Effective Caching** | `stale_age_duration` is hardcoded to `1.day` despite a configurable DB column. No HTTP caching headers on API responses. |
| ~~**Input Sanitization**~~ | ~~DONE (ef2e32a0). `ScrapedContentSanitizer` strips HTML and blocks dangerous URI schemes.~~ |
| **Pagination** | API returns unbounded results. No limit/offset support. |
| **Search / Filtering** | No way to query listings by location, price, type, bedrooms, etc. |
| **Background Processing** | All scraping is synchronous in the request cycle. No ActiveJob/Sidekiq integration. Long scrapes block the web server. |
| **Retry / Resilience** | No exponential backoff, circuit breakers, or graceful degradation for unreachable sites. |
| **API Documentation** | No Swagger/OpenAPI spec despite having a versioned API endpoint. |
| ~~**Proper Model Associations**~~ | ~~DONE (ef2e32a0). `Listing#import_host` provides memoised lookup by slug.~~ |
| **Soft Delete** | `deleted_at` column exists in schema but no soft-delete logic implemented. |
| **Internationalization** | Translation columns exist (`title_es`, `title_de`, etc.) and `I18n.t` is used in one view, but no locale files are provided. |

---

## Recommendations

### Immediate Fixes (Security / Correctness)

1. ~~**Fix XSS vulnerabilities**~~ — DONE (b3278cb9)
2. ~~**Remove hardcoded Google Maps API key**~~ — DONE (3263ef6f, removed in 8910e5dc)
3. ~~**Fix `rescue Exception`**~~ — DONE (b3278cb9)
4. ~~**Fix XPath bug**~~ — DONE (b3278cb9)
5. ~~**Disable real HTTP in tests**~~ — DONE (ef2e32a0). `allow_http_connections_when_no_cassette` is already `false` in `spec/support/vcr_setup.rb`.
6. **Fix gemspec email** — `etewiah@hotmail.cim` → `etewiah@hotmail.com`.

### Architectural Improvements (High Priority)

7. ~~**Add a sanitization layer**~~ — DONE (ef2e32a0). `ScrapedContentSanitizer` strips HTML and blocks dangerous URI schemes before persistence.

8. **Move scraping to background jobs** — Wrap `ListingRetriever#retrieve` in an ActiveJob. Return a job ID to the client and let them poll for results. This prevents long HTTP requests from blocking the server.

9. ~~**Add logging throughout**~~ — DONE (ef2e32a0). `Rails.logger` calls added for scraping attempts, results, and failures.

10. ~~**Extract shared URL validation**~~ — DONE (ef2e32a0). `UrlValidator` service returns a result object with URI, ImportHost, and error info.

11. ~~**Consolidate pricing**~~ — DONE (cd329df0). Firestore migration removed money-rails columns; now uses `price_string` + `price_float` only.

12. ~~**Add proper associations**~~ — DONE (ef2e32a0). `Listing#import_host` method provides memoised lookup by `import_host_slug`.

13. ~~**Add API authentication**~~ — DONE (ef2e32a0). `authenticate_api_key!` supports `X-Api-Key` header and `api_key` query parameter with backwards-compatible skip.

### Code Quality (Medium Priority)

14. ~~**Delete all commented-out code**~~ — DONE (b3278cb9, 8910e5dc)
15. ~~**Use `nil` instead of `0` for missing numeric data**~~ — DONE (cd329df0)
16. ~~**Make themes configurable**~~ — N/A. Legacy themes removed; single Bootstrap 5 layout now.
17. ~~**Remove unused database columns**~~ — N/A. Firestore migration removed the PostgreSQL schema entirely.
18. ~~**Add missing database indexes**~~ — N/A. Now managed via Firestore composite index configuration.
19. ~~**Pin frontend dependency versions**~~ — DONE (8910e5dc). Legacy CDN dependencies replaced with bundled assets.

### Testing (Medium Priority)

20. **Regenerate stale VCR cassettes** — Especially the 2018-era ones. Document the regeneration process.

21. ~~**Add error path tests**~~ — DONE (ef2e32a0). Specs cover network timeouts, malformed HTML, missing fields, unsupported URLs, and HTTP error responses.

22. **Complete incomplete scraper specs** — Add assertions to RealEstateIndia and Pisos.com specs or remove them.

23. **Add CI quality checks** — Run rubocop, enforce simplecov minimum (e.g., 80%), add bundler-audit, test against multiple Ruby versions.

### Modernization (Lower Priority)

24. ~~**Update frontend stack**~~ — DONE (8910e5dc). Upgraded to Bootstrap 5, Turbo, Stimulus. jQuery and Vue/Vuetify removed.

25. **Add pagination to API** — Support `page` and `per_page` params with sensible defaults.

26. **Add background job infrastructure** — Integrate ActiveJob with a backend (Sidekiq, GoodJob) for async scraping.

27. **Add API documentation** — Generate OpenAPI/Swagger spec for the `/api/v1/` endpoints.

28. **Implement the unused features** — Either implement `pause_between_calls`, `valid_url_regex`, `stale_age` from the database, or remove the columns entirely.

---

*Review conducted: February 2026*
*Last updated: February 2026 — marked items fixed in commits b3278cb9, 8910e5dc, cd329df0, 5bde3fa6, ef2e32a0*
