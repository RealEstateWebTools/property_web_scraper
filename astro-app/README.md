# Property Web Scraper — Astro App

An Astro 5 SSR rewrite of the [Property Web Scraper](https://github.com/RealEstateWebTools/property_web_scraper) Rails extraction engine. Provide a real estate listing URL (or pre-rendered HTML) and get structured property data back — title, price, images, coordinates, and 70+ fields.

## Prerequisites

- **Node.js 18+**
- **npm 9+**
- **Google Cloud Firestore** (optional — the app falls back to in-memory storage when credentials are not configured)

## Quick Start

```bash
cd astro-app
npm install
npm run dev       # http://localhost:4321
npm test          # Vitest unit tests
npm run test:e2e  # Playwright end-to-end tests
```

## Environment Variables

Copy `.env.example` to `.env` and fill in the values you need:

| Variable | Required | Description |
|---|---|---|
| `FIRESTORE_PROJECT_ID` | No | Google Cloud project ID for Firestore |
| `GOOGLE_APPLICATION_CREDENTIALS` | No | Path to Firebase service account JSON |
| `FIRESTORE_COLLECTION_PREFIX` | No | Optional prefix for Firestore collection names |
| `PWS_API_KEY` | No | API key protecting `/retriever/as_json` and `/api/v1/listings`. When empty, auth is skipped |
| `GOOGLE_MAPS_API_KEY` | No | Enables the map on the single property view page |

## Project Structure

```
astro-app/
├── src/
│   ├── pages/
│   │   ├── index.astro                  # Home page with extraction form
│   │   ├── single_property_view.astro   # Property detail page
│   │   ├── scrapers/submit.ts           # POST form submission endpoint
│   │   ├── retriever/as_json.ts         # GET/POST JSON extraction API
│   │   └── api/v1/listings.ts           # GET/POST listings API
│   ├── lib/
│   │   ├── extractor/                   # HTML parsing & field extraction
│   │   ├── firestore/                   # Firestore client & in-memory fallback
│   │   ├── models/                      # Listing, ImportHost models
│   │   └── services/                    # URL validation, auth, retriever
│   ├── components/                      # PropertyCard, ErrorCard
│   └── layouts/BaseLayout.astro         # Nav + footer shell
├── test/
│   ├── fixtures/                        # HTML fixtures (idealista, rightmove, etc.)
│   ├── lib/                             # Vitest unit tests
│   └── e2e/                             # Playwright E2E tests
├── scraper_mappings -> ../config/scraper_mappings
└── public/                              # Static assets
```

## NPM Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start dev server on port 4321 |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm test` | Run Vitest unit tests |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run test:e2e` | Run Playwright E2E tests |

## API Endpoints

| Method | Route | Auth | Description |
|---|---|---|---|
| `GET` | `/` | None | Home page with URL / HTML / file upload form |
| `POST` | `/scrapers/submit` | None | Form submission — returns HTML partial |
| `GET` | `/single_property_view?url=...` | None | Property detail page |
| `GET` | `/retriever/as_json?url=...` | API key | JSON extraction |
| `POST` | `/retriever/as_json` | API key | JSON extraction with HTML body |
| `GET` | `/api/v1/listings?url=...` | API key | Listing metadata |
| `POST` | `/api/v1/listings` | API key | Extract and save listing |

API key can be passed as `?api_key=...` query param or `X-Api-Key` header.

## Supported Sites

The local fallback host map includes:

- idealista.com
- rightmove.co.uk
- zoopla.co.uk
- realtor.com
- fotocasa.es
- pisos.com
- realestateindia.com
- forsalebyowner.com

Additional sites can be configured via Firestore `import_hosts` collection and corresponding scraper mapping JSON files in `config/scraper_mappings/`.

## Architecture Notes

- **Astro 5 SSR** with `@astrojs/node` adapter (standalone mode)
- **Tailwind CSS v4** via `@tailwindcss/vite` plugin
- **Firestore lazy-loading** — the Firestore client initialises on first use; if credentials are missing the app switches to an in-memory backend transparently
- **Local host map fallback** — URL validation works without Firestore by using a hardcoded map of supported hostnames
- **Scraper mappings** — JSON config files (symlinked from `config/scraper_mappings/`) define CSS selectors and regex patterns for each site
- **Bootstrap Icons** served locally from `node_modules`
