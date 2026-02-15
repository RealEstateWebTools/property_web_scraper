# PropertyWebScraper

[![CI](https://github.com/RealEstateWebTools/property_web_scraper/actions/workflows/ci.yml/badge.svg)](https://github.com/RealEstateWebTools/property_web_scraper/actions/workflows/ci.yml)

Web based UI to make scraping data from real estate websites super simple.

## Requirements

- Ruby >= 3.1
- Rails >= 7.1
- Google Cloud Firestore (or local emulator)

## Installation

Install into an existing Rails project by adding this line to your application's Gemfile:

```ruby
gem 'property_web_scraper', git: 'https://github.com/RealEstateWebTools/property_web_scraper', branch: 'master'
```

Then execute:
```bash
$ bundle
```

Set the required Firestore environment variables:

```bash
export FIRESTORE_PROJECT_ID=your-gcp-project-id
# Production: path to your service account JSON key
export FIRESTORE_CREDENTIALS=/path/to/service-account.json
# Development/test: use the Firestore emulator instead
export FIRESTORE_EMULATOR_HOST=localhost:8080
```

Mount PropertyWebScraper by adding the following to your routes.rb file:
```ruby
mount PropertyWebScraper::Engine => '/'
```

Seed the initial scraper host data:
```bash
rails property_web_scraper:db:seed
```

## Development Setup

Clone the repository and install dependencies:

```bash
git clone https://github.com/RealEstateWebTools/property_web_scraper.git
cd property_web_scraper
bundle install
```

Start the Firestore emulator and seed data:

```bash
firebase emulators:start --only firestore --project test-project &
sleep 5
export FIRESTORE_EMULATOR_HOST=localhost:8080
export FIRESTORE_PROJECT_ID=test-project
bundle exec rails runner "load 'db/seeds/import_hosts.rb'"
```

Run the test suite:

```bash
firebase emulators:start --only firestore --project test-project &
sleep 5
FIRESTORE_EMULATOR_HOST=localhost:8080 FIRESTORE_PROJECT_ID=test-project bundle exec rspec
```

## Architecture Overview

**Models:**

- `Listing` -- core model storing scraped property data (price, location, images, features)
- `ImportHost` -- maps a website hostname to its scraper configuration
- `PwbListing` -- extends Listing with PropertyWebBuilder-compatible JSON serialization
- `ScraperMapping` -- loads JSON scraper configs from `config/scraper_mappings/` via ActiveHash

**Services:**

- `Scraper` -- fetches an HTML page and extracts property fields using a ScraperMapping
- `ListingRetriever` -- validates a URL, resolves the ImportHost, and delegates to Scraper

**Controllers:**

- `ScraperController` -- welcome page, config endpoint, JSON retrieval, AJAX form handler
- `SinglePropertyViewController` -- renders a single property page with map
- `Api::V1::ListingsController` -- REST JSON endpoint returning PwbListing data

**Config Mappings:**

JSON files in `config/scraper_mappings/` define CSS selectors, XPath expressions, and regex patterns for each supported website.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/config/as_json` | Returns scraper field configuration for realtor.com |
| GET/POST | `/retriever/as_json` | Scrapes a property URL and returns listing JSON |
| GET | `/api/v1/listings?url=...` | Returns a PwbListing-formatted JSON array |

All endpoints accept a `url` parameter and return JSON with a `success` boolean and either the listing data or an `error_message`.

## Running Tests

Start the Firestore emulator before running any tests:

```bash
firebase emulators:start --only firestore --project test-project &
sleep 5
```

Then run specs with the emulator environment variables:

```bash
# Full suite
FIRESTORE_EMULATOR_HOST=localhost:8080 FIRESTORE_PROJECT_ID=test-project bundle exec rspec

# Models only
FIRESTORE_EMULATOR_HOST=localhost:8080 FIRESTORE_PROJECT_ID=test-project bundle exec rspec spec/models

# Services only
FIRESTORE_EMULATOR_HOST=localhost:8080 FIRESTORE_PROJECT_ID=test-project bundle exec rspec spec/services

# Firestore library specs
FIRESTORE_EMULATOR_HOST=localhost:8080 FIRESTORE_PROJECT_ID=test-project bundle exec rspec spec/lib

# A single spec file
FIRESTORE_EMULATOR_HOST=localhost:8080 FIRESTORE_PROJECT_ID=test-project bundle exec rspec spec/models/property_web_scraper/listing_spec.rb
```

## Contribute and spread the love

We encourage you to contribute to this project and file issues for any problems you encounter.

If you like it, please star it and spread the word on [Twitter](https://twitter.com/prptywebbuilder), [LinkedIn](https://www.linkedin.com/company/propertywebbuilder) and [Facebook](https://www.facebook.com/propertywebbuilder). You can also subscribe to GitHub notifications on this project.

Please consider making a contribution to the development of PropertyWebScraper. If you wish to pay for specific enhancements, please email me directly (opensource at propertywebbuilder.com).

---

## License

The gem is available as open source under the terms of the [MIT License](http://opensource.org/licenses/MIT).

## Disclaimer

While scraping can sometimes be used as a legitimate way to access all kinds of data on the internet, it's also important to consider the legal implications. There are cases where scraping data may be considered illegal, or open you to the possibility of being sued.

I created this tool in part as a learning exercise and am sharing it in case others find it useful. If you do decide to use this tool to scrape a website it is your responsibility to ensure that what you are doing is legal.
