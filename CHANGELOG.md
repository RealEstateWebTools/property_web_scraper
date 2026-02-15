# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- `UrlValidator` service — single entry point for URL validation across all controllers
- `ScrapedContentSanitizer` service — strips HTML tags, blocks dangerous URI schemes (`javascript:`, `data:`), and normalises protocol-relative URLs before persistence
- API key authentication via `authenticate_api_key!` in `ApplicationController`; supports `X-Api-Key` header and `api_key` query parameter
- `Listing#import_host` association method with memoisation and cache-clearing on slug change
- `Rails.logger` calls for scraping attempts, results, and failures
- Error-path specs for network timeouts, malformed HTML, missing fields, and unsupported URLs
- `.env.development` template with Firestore emulator defaults

### Changed
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
