# PropertyWebScraper

[![CI](https://github.com/RealEstateWebTools/property_web_scraper/actions/workflows/ci.yml/badge.svg)](https://github.com/RealEstateWebTools/property_web_scraper/actions/workflows/ci.yml)

**From the team behind [PropertyWebBuilder](https://github.com/etewiah/property_web_builder)** — the open-source real estate platform.

A real estate listing extraction API and Chrome extension. Given a property listing URL (or pre-rendered HTML), it returns structured data: title, price, coordinates, images, and 70+ fields across 17 supported portals in 8 countries.

Built with [Astro](https://astro.build/) (SSR mode), TypeScript, and [Cheerio](https://cheerio.js.org/).

## Supported Sites

| Country | Portals |
|---------|---------|
| 🇬🇧 UK | Rightmove, Zoopla, OnTheMarket, Jitty |
| 🇪🇸 Spain | Idealista, Fotocasa, Pisos.com |
| 🇵🇹 Portugal | Idealista PT |
| 🇮🇪 Ireland | Daft.ie |
| 🇺🇸 USA | Realtor.com, ForSaleByOwner, MLSListings, WyomingMLS |
| 🇮🇳 India | RealEstateIndia |
| 🇩🇪 Germany | ImmobilienScout24 |
| 🇦🇺 Australia | Domain, RealEstate.com.au |

Portal count is derived from the `PORTAL_REGISTRY` in `astro-app/src/lib/services/portal-registry.ts` (single source of truth).

## Chrome Extension

The project includes a **Manifest V3 Chrome extension** that makes extraction available with one click on any supported listing page.

- **Badge indicator** — green check on supported sites
- **Haul collections** — browse multiple listings, then view them all on a single results page
- **Property card popup** — image, price, stats, quality grade
- **Copy to clipboard** — JSON or listing URL
- **No API key required** — uses anonymous haul collections

**Install (dev mode):** Open `chrome://extensions/` → enable Developer mode → Load unpacked → select `chrome-extensions/property-scraper/` folder.

See the full [Chrome Extension documentation](chrome-extensions/property-scraper/README.md) for architecture details and configuration.

## How It Works

The extraction engine takes fully-rendered HTML and a source URL, then applies configurable JSON mappings (CSS selectors, script JSON paths, regex patterns, JSON-LD, flight data paths) to extract structured property data. No browser automation or JS rendering happens inside the engine itself — the caller provides the HTML.

### Haul workflow (Chrome extension)

1. User browses supported listing pages — extension badge turns green
2. Click the extension icon to extract the current listing
3. Results are collected into an anonymous **haul** — no login required
4. A shareable results page shows all collected listings with comparison data

## Quick Start

```bash
cd astro-app
npm install
npm run dev
```

The dev server starts at `http://localhost:4321`. You can extract a listing via the web UI or the API.

## API

### Extract from URL

```
POST /extract/url
Content-Type: application/x-www-form-urlencoded

url=https://www.rightmove.co.uk/properties/168908774
```

### Extract from HTML

```
POST /extract/html
Content-Type: application/x-www-form-urlencoded

url=https://www.rightmove.co.uk/properties/168908774&html=<html>...</html>
```

### Public API

```
GET /public_api/v1/listings?url=https://www.rightmove.co.uk/properties/168908774
GET /public_api/v1/supported_sites
GET /public_api/v1/health
```

### Chrome Extension (Haul) API

```
POST /ext/v1/hauls                    # Create anonymous haul
GET  /ext/v1/hauls/:id                # Get haul summary
POST /ext/v1/hauls/:id/scrapes        # Add extraction to haul
```

See [DESIGN.md](DESIGN.md) for the full API endpoint reference and architecture details.

## MCP Server

An MCP server (`astro-app/mcp-server.ts`) enables Claude Code to capture rendered HTML directly from Chrome via the [MCP Bridge extension](chrome-extensions/mcp-bridge/README.md). Start it with:

```bash
npx tsx astro-app/mcp-server.ts
```

## Running Tests

```bash
cd astro-app
npx vitest run
```

## Project Structure

```
property_web_scraper/
├── astro-app/                  # Astro 5 SSR application (active development)
│   ├── src/lib/extractor/      # Core extraction pipeline
│   ├── src/lib/services/       # URL validation, auth, rate limiting
│   ├── src/pages/              # Astro pages and API endpoints
│   ├── test/                   # Vitest tests and HTML fixtures
│   └── scripts/                # CLI utilities (capture-fixture)
├── chrome-extensions/          # Chrome extensions
│   ├── property-scraper/      # Public extension (one-click extraction popup)
│   └── mcp-bridge/            # Dev extension (WebSocket bridge to MCP server)
├── config/scraper_mappings/    # JSON mapping files per portal
│   └── archive/                # Legacy mappings (kept for reference)
├── app/                        # Legacy Rails engine (see RAILS_README.md)
└── spec-archive/               # Archived Rails RSpec tests (not run in CI)
```

## Scraper Mappings

Each supported site has a JSON mapping file in `config/scraper_mappings/` with a country-code prefix (e.g. `uk_rightmove.json`, `es_idealista.json`). These define CSS selectors, script JSON paths, regex patterns, and post-processing rules for extracting fields from that site's HTML.

## Projects Using This API

PropertyWebScraper is part of the [PropertyWebBuilder](https://github.com/etewiah/property_web_builder) ecosystem. These projects all use it as their extraction backend:

| Project | What it does | Stack |
|---------|-------------|-------|
| [HomesToCompare](https://homestocompare.com/) | AI-powered side-by-side property comparisons with 11 analysis sections and Firestore sync | Astro, React, Firestore |
| [HousePriceGuess](https://housepriceguess.com/) | Gamified property price guessing with AI dossiers, 18+ white-label brands, and embeddable widgets | Astro, React, Tailwind |
| [SinglePropertyPages](https://singlepropertypages.com/) | SaaS for dedicated property microsites with lead capture, analytics, and WYSIWYG editor | Astro, TypeScript |
| [PropertySquares](https://propertysquares.com/) | 48-step first-time buyer journey across multiple markets | Astro, TypeScript |

**Building a real estate project?** PropertyWebScraper gives you structured listing data from 17 portals in 8 countries via a simple API. [Open an issue](https://github.com/RealEstateWebTools/property_web_scraper/issues) to get your project listed here.

## Legacy Rails Engine

This project was originally a Ruby on Rails engine. The Rails code in `app/` is kept for legacy purposes but is no longer under active development. See [RAILS_README.md](RAILS_README.md) for details.

## Contributing

The easiest way to contribute is to **add a scraper for a property portal in your country**. We have a step-by-step guide in [CONTRIBUTING.md](CONTRIBUTING.md) that walks you through the process — no deep knowledge of the codebase required.

We also welcome bug fixes, test improvements, and documentation updates. See the [open issues](https://github.com/RealEstateWebTools/property_web_scraper/issues) for ideas.

If you like this project, please star it and spread the word on [Twitter](https://twitter.com/prptywebbuilder), [LinkedIn](https://www.linkedin.com/company/propertywebbuilder) and [Facebook](https://www.facebook.com/propertywebbuilder).

## License

Available as open source under the terms of the [MIT License](http://opensource.org/licenses/MIT).

## Disclaimer

While scraping can sometimes be used as a legitimate way to access all kinds of data on the internet, it's also important to consider the legal implications. There are cases where scraping data may be considered illegal, or open you to the possibility of being sued.

This tool was created in part as a learning exercise and is shared in case others find it useful. If you do decide to use this tool to scrape a website it is your responsibility to ensure that what you are doing is legal.
