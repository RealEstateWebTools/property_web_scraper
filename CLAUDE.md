# CLAUDE.md

Project context for Claude Code sessions.

## What this project is

PropertyWebScraper is a real estate listing extraction engine. Given a property
listing URL (or pre-rendered HTML), it returns structured data: title, price,
coordinates, images, and 70+ fields. It has two implementations:

- **Rails engine** (`app/`, `lib/`) — the original Ruby gem, uses Nokogiri
- **Astro app** (`astro-app/`) — a TypeScript SSR rewrite, uses Cheerio

Both share the same scraper mapping JSON files in `config/scraper_mappings/`.

## Project layout

```
property_web_scraper/
├── app/                    # Rails engine (models, controllers, services)
├── astro-app/              # Astro 5 SSR rewrite (active development)
│   ├── src/lib/extractor/  # Core extraction pipeline
│   ├── src/lib/services/   # URL validation, auth, rate limiting
│   ├── src/pages/          # Astro pages and API endpoints
│   ├── test/fixtures/      # HTML fixtures + manifest.ts
│   ├── test/lib/           # Vitest unit tests
│   ├── scripts/            # CLI utilities (capture-fixture)
│   └── docs/               # Maintenance guides
├── chrome-extensions/       # Chrome extensions
│   └── property-scraper/   # Main extension (WebSocket bridge to MCP server)
├── config/scraper_mappings/ # JSON mapping files (shared by both)
├── spec/                   # Rails RSpec tests
├── DESIGN.md               # Architecture and API reference
└── CHANGELOG.md            # Version history
```

## Key concepts

### Extraction pipeline (astro-app)

The extraction engine in `astro-app/src/lib/extractor/html-extractor.ts` processes
fields in a strict order. Each section overwrites prior values for the same key:

1. `defaultValues` — static strings
2. `images` — image URL arrays
3. `features` — feature string arrays
4. `intFields` — `parseInt(text, 10) || 0`
5. `floatFields` — `parseFloat(text) || 0`
6. `textFields` — `text.trim()`
7. `booleanFields` — evaluator function (true/false)

### Scraper mappings

JSON files in `config/scraper_mappings/<name>.json` define CSS selectors, regex
patterns, and post-processing rules for each website. These are parsed with JSON5
(comments allowed).

### Test fixtures

HTML fixtures in `astro-app/test/fixtures/` with expected values in `manifest.ts`.
The `scraper-validation.test.ts` runs each fixture through the pipeline and
checks output against the manifest.

## Common tasks

### Run tests (astro-app)

```bash
cd astro-app && npx vitest run
```

### Add a new scraper

Use the `/add-scraper` skill or follow the manual workflow:

1. Capture HTML fixture: `cd astro-app && npm run capture-fixture -- <url>`
2. Create mapping: `config/scraper_mappings/<name>.json`
3. Add hostname to `url-validator.ts` and `capture-fixture.ts`
4. Add manifest entry: `astro-app/test/fixtures/manifest.ts`
5. Run tests: `cd astro-app && npx vitest run`

### Fix a broken scraper

See `astro-app/docs/scraper-maintenance-guide.md` for the full diagnosis workflow.

### Capture a test fixture

```bash
cd astro-app
npm run capture-fixture -- <url>                              # fetch from URL
npm run capture-fixture -- --file page.html --url <url>       # from local file
npm run capture-fixture -- --help                             # all options
```

## Code style and conventions

- Astro app uses TypeScript with ES modules (`"type": "module"`)
- Imports use `.js` extensions (TypeScript with ESM)
- Tests use Vitest
- Mapping files are JSON (parsed with JSON5)
- Commit messages: imperative mood, concise first line
