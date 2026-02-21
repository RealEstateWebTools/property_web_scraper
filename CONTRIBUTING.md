# Contributing to PropertyWebScraper

Thanks for your interest in contributing! The most valuable contribution you can make is **adding a scraper for a property portal in your country**. The more portals we support, the more useful this project becomes for the real estate developer community.

## Adding a New Scraper

Adding a scraper requires no deep knowledge of the codebase. You just need to create a JSON mapping file that tells the extraction engine which CSS selectors to use for each field.

### Prerequisites

```bash
cd astro-app
npm install
```

### Step 1: Capture an HTML Fixture

Save a real listing page as a test fixture:

```bash
# From a URL (works for static/server-rendered pages)
npm run capture-fixture -- https://www.example-portal.com/listing/12345

# From a local file (for JavaScript-rendered pages — save the page from your browser first)
npm run capture-fixture -- --file saved-page.html --url https://www.example-portal.com/listing/12345

# Override the scraper name for a new portal
npm run capture-fixture -- --name cc_portalname https://www.example-portal.com/listing/12345
```

This saves the HTML to `test/fixtures/<name>.html` and prints a manifest stub you'll use in Step 4.

### Step 2: Create the Mapping File

Create `config/scraper_mappings/<cc>_<portal>.json` where `<cc>` is a two-letter country code (e.g. `uk`, `es`, `us`, `de`, `fr`).

Here's a minimal example:

```json
[{
  "name": "de_immoscout",
  "expectedExtractionRate": 0.70,
  "portal": {
    "hosts": ["www.immobilienscout24.de", "immobilienscout24.de"],
    "country": "DE",
    "currency": "EUR",
    "localeCode": "de-DE",
    "areaUnit": "sqmt",
    "contentSource": "html",
    "stripTrailingSlash": false,
    "requiresJsRendering": false
  },
  "defaultValues": {
    "country": { "value": "Germany" },
    "currency": { "value": "EUR" },
    "area_unit": { "value": "sqmt" }
  },
  "textFields": {
    "title": {
      "cssLocator": "h1.listing-title"
    },
    "price_string": {
      "cssLocator": ".price-value"
    },
    "address_string": {
      "cssLocator": ".address-block"
    }
  },
  "floatFields": {
    "price_float": {
      "cssLocator": ".price-value",
      "stripPunct": true
    },
    "latitude": {
      "scriptRegEx": "\"latitude\":([-\\d.]+)"
    },
    "longitude": {
      "scriptRegEx": "\"longitude\":([-\\d.]+)"
    }
  },
  "intFields": {
    "count_bedrooms": {
      "cssLocator": ".bedrooms-count"
    },
    "count_bathrooms": {
      "cssLocator": ".bathrooms-count"
    }
  },
  "booleanFields": {
    "for_sale": {
      "cssLocator": "meta[name='description']",
      "cssAttr": "content",
      "evaluator": "include?",
      "evaluatorParam": "kaufen",
      "caseInsensitive": true
    }
  },
  "images": [{
    "cssLocator": "img.gallery-image",
    "cssAttr": "src"
  }]
}]
```

### How Field Extraction Works

The engine processes fields in this order (later sections overwrite earlier ones for the same key):

1. **`defaultValues`** — static values (country, currency, area unit)
2. **`images`** — image URL arrays from `<img>` tags
3. **`features`** — feature/amenity string arrays
4. **`intFields`** — integers via `parseInt(text, 10)`
5. **`floatFields`** — decimals via `parseFloat(text)`
6. **`textFields`** — trimmed text strings
7. **`booleanFields`** — true/false via evaluator functions

### Extraction Strategies

Each field selects a text retrieval strategy. The engine tries strategies in order; use the one that best fits the site's data format.

| Strategy | Description |
|----------|-------------|
| `cssLocator` | CSS selector (Cheerio/jQuery syntax). Most common. |
| `scriptJsonVar` + `scriptJsonPath` | Extract from a named JSON variable in a `<script>` tag (e.g. `PAGE_MODEL`, `__NEXT_DATA__`, `__INITIAL_STATE__`) |
| `flightDataPath` | Dot-path into Next.js RSC flight data (`self.__next_f.push`) |
| `jsonLdPath` | Dot-path into `<script type="application/ld+json">` structured data |
| `jsonLdType` | Filter JSON-LD by `@type` before path lookup (used with `jsonLdPath`) |
| `scriptRegEx` | Regex on concatenated `<script>` tag text. First capture group is returned. |
| `urlPathPart` | Extract a URL path segment by index (1-based) |
| `fallbacks` | Array of alternative FieldMapping objects tried in order if the primary returns empty |

### Post-processing Options

| Option | Description |
|--------|-------------|
| `cssCountId` | Pick element at index (without this, all matches concatenate) |
| `cssAttr` / `xmlAttr` | Extract an attribute value instead of text content |
| `stripFirstChar` | Remove leading character (useful for currency symbols like `$`) |
| `stripPunct` | Remove `.` and `,` characters (for parsing prices) |
| `stripString` | Remove a specific substring |
| `splitTextCharacter` | Split text by this character |
| `splitTextArrayId` | Pick element at index after splitting |

See [DESIGN.md](DESIGN.md) for the complete mapping schema and strategy decision tree.

### Step 3: Add a Manifest Entry

Edit `astro-app/test/fixtures/manifest.ts` and add an entry for your fixture. Only include fields that your scraper actually extracts (skip empty strings, zeros, and empty arrays):

```typescript
{
  scraper: 'de_immoscout',
  fixture: 'de_immoscout',
  sourceUrl: 'https://www.immobilienscout24.de/expose/12345',
  expected: {
    country: 'Germany',
    currency: 'EUR',
    title: 'Schöne 3-Zimmer-Wohnung in Berlin',
    price_float: 350000,
    price_string: '350.000 €',
    count_bedrooms: 3,
    latitude: 52.5200,
    longitude: 13.4050,
  },
},
```

### Step 4: Register the Hostname

Add your portal's hostname(s) to both:

1. `astro-app/src/lib/services/url-validator.ts` in `LOCAL_HOST_MAP`
2. `astro-app/scripts/capture-fixture.ts` in `HOSTNAME_MAP`

```typescript
'www.immobilienscout24.de': 'de_immoscout',
'immobilienscout24.de': 'de_immoscout',
```

### Step 5: Run Tests

```bash
# Run just your new scraper's validation test
npx vitest run test/lib/scraper-validation.test.ts -t "de_immoscout"

# Run the full test suite to check for regressions
npx vitest run
```

### Step 6: Submit a Pull Request

Push your branch and open a PR. Your PR should include:

- The mapping JSON file (`config/scraper_mappings/<name>.json`)
- The HTML fixture (`astro-app/test/fixtures/<name>.html`)
- The manifest entry in `manifest.ts`
- The hostname entry in `url-validator.ts`
- The hostname entry in `capture-fixture.ts`

## Tips for Writing Good Mappings

- **Start with the browser DevTools.** Inspect the listing page to find CSS selectors. Look for stable class names or semantic elements (`<h1>`, `meta` tags, `data-` attributes).
- **Check `<script>` tags.** Many portals embed structured data as JSON inside `<script>` tags (JSON-LD, `__NEXT_DATA__`, custom variables). Use `scriptRegEx` to extract from these — it's often more reliable than CSS selectors.
- **Use `meta` tags.** `og:title`, `og:image`, and `og:description` are usually stable across redesigns.
- **Set `expectedExtractionRate`** to a realistic value (0.70 - 0.95). This is the fraction of fields you expect your mapping to populate from a typical listing.
- **Test with multiple listings.** Your CSS selectors should work across different listing types (sale vs rent, house vs apartment) on the same portal.

## Common Pitfalls

| Pitfall | Fix |
|---------|-----|
| All matched elements concatenate into one string | Add `"cssCountId": "0"` to pick just the first match |
| Currency symbol breaks `parseFloat` | Use `"stripFirstChar": true` in `floatFields` |
| Price has thousands separators | Use `"stripPunct": true` to remove `.` and `,` |
| Page requires JavaScript to render | Save the rendered page from your browser and use `--file` with `capture-fixture` |
| Field appears in both `intFields` and `textFields` | Last section wins — `textFields` would override `intFields` |

**Alternative**: If you have Claude Code, you can use the `/add-scraper` skill which automates the entire workflow.

## Fixing a Broken Scraper

Portals change their HTML structure regularly. When a test fails:

1. Run `npx vitest run test/lib/scraper-validation.test.ts -t "<scraper_name>"` to see what's broken
2. Open the HTML fixture in a browser or editor to inspect the actual DOM
3. Update CSS selectors in `config/scraper_mappings/<name>.json`
4. If the fixture is outdated, capture a fresh one with `npm run capture-fixture`
5. Update expected values in `astro-app/test/fixtures/manifest.ts`
6. Run `npx vitest run` to verify no regressions

See `astro-app/docs/scraper-maintenance-guide.md` for detailed diagnosis steps and common pitfalls.

## Other Ways to Contribute

- **Improve extraction quality** — Add missing fields to existing mappings, or add `fallbacks` for fields that rely on fragile CSS selectors.
- **Report issues** — If you find a portal that doesn't extract correctly, [open an issue](https://github.com/RealEstateWebTools/property_web_scraper/issues) with the listing URL and we'll investigate.
- **Documentation** — Improve these docs, add examples, or translate into other languages.

## Questions?

Open an issue or start a discussion on the [GitHub repo](https://github.com/RealEstateWebTools/property_web_scraper). We're happy to help you get your first scraper working.
