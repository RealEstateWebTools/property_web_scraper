# PropertyWebScraper — Legacy Rails Engine

> **Note:** The Rails engine is kept for legacy purposes only. Active development has moved to the Astro app in `astro-app/`. See the main [README.md](README.md) for current documentation.

## Overview

The original implementation of PropertyWebScraper was a Ruby on Rails engine that used Nokogiri for HTML parsing and ActiveHash for loading scraper mappings. It can still be mounted in a Rails application, but the Astro rewrite is the recommended path for new projects.

## Requirements

- Ruby >= 3.1
- Rails >= 7.1
- Google Cloud Firestore (or local emulator)

## Installation

Add to your Rails application's Gemfile:

```ruby
gem 'property_web_scraper', git: 'https://github.com/RealEstateWebTools/property_web_scraper', branch: 'master'
```

Then execute:

```bash
bundle install
```

Set the required environment variables:

```bash
export FIRESTORE_PROJECT_ID=your-gcp-project-id
export FIRESTORE_CREDENTIALS=/path/to/service-account.json
# Or use the emulator for development:
export FIRESTORE_EMULATOR_HOST=localhost:8080
```

Mount the engine in `config/routes.rb`:

```ruby
mount PropertyWebScraper::Engine => '/'
```

Seed the initial scraper host data:

```bash
rails property_web_scraper:db:seed
```

## Architecture

**Models:**

- `Listing` — core model storing scraped property data
- `ImportHost` — maps a website hostname to its scraper configuration
- `PwbListing` — extends Listing with PropertyWebBuilder-compatible JSON serialization
- `ScraperMapping` — loads JSON scraper configs from `config/scraper_mappings/` via ActiveHash

**Services:**

- `Scraper` — fetches an HTML page and extracts property fields using a ScraperMapping
- `ListingRetriever` — validates a URL, resolves the ImportHost, and delegates to Scraper
- `UrlValidator` — shared URL validation
- `ScrapedContentSanitizer` — strips HTML tags and blocks dangerous URI schemes

**API Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/config/as_json` | Returns scraper field configuration |
| GET/POST | `/retriever/as_json` | Scrapes a property URL and returns listing JSON |
| GET | `/api/v1/listings?url=...` | Returns a PwbListing-formatted JSON array |

## Rails Tests (Archived)

The Rails RSpec tests have been moved to `spec-archive/` and are no longer run in CI. They are kept for reference only. The project's CI now runs the Astro Vitest suite exclusively.

## Shared Config

Both the Rails engine and the Astro app read from the same `config/scraper_mappings/` directory. Changes to mapping files affect both implementations.
