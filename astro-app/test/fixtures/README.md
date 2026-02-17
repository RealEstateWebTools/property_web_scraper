# Test Fixtures

HTML snapshots of real estate listing pages used to validate scraper mappings.

## File Structure

```
test/fixtures/
├── manifest.ts          # Central registry of all scrapers + expected values
├── README.md            # This file
├── *.html               # Saved HTML pages from listing portals
└── archive/             # Older fixtures kept for reference
```

## How It Works

Each scraper has an entry in [`manifest.ts`](./manifest.ts) that maps:

| Field | Description |
|-------|-------------|
| `scraper` | Mapping name (must match `config/scraper_mappings/{name}.json`) |
| `fixture` | HTML file basename (without `.html`), or `null` if not captured yet |
| `sourceUrl` | URL context used during extraction |
| `expected` | Key-value pairs that extraction **must** produce |

The test file [`test/lib/scraper-validation.test.ts`](../lib/scraper-validation.test.ts) iterates over every manifest entry and asserts each expected field.

## Workflow: Fixing a Broken Scraper

```
1. Run tests     →  npx vitest run test/lib/scraper-validation.test.ts
2. Inspect HTML  →  Open test/fixtures/{scraper}.html
3. Fix mapping   →  Edit config/scraper_mappings/{scraper}.json
4. Update expect →  Edit test/fixtures/manifest.ts
5. Verify        →  Re-run tests
```

## Workflow: Adding a New Scraper

1. Save a listing page HTML as `test/fixtures/{name}.html`
2. Add an entry to the `fixtures` array in `manifest.ts`
3. Manually confirm expected values from the HTML
4. Run `npx vitest run test/lib/scraper-validation.test.ts`

## Common Pitfalls

| Issue | Cause |
|-------|-------|
| Field value is wrong | Field defined in multiple mapping sections → last one wins |
| Field concatenates multiple elements | Missing `cssCountId` in mapping |
| Line breaks differ | Cheerio converts `<br>` → `\n` not `\r` |
| Boolean is a string | `defaultValues` always produces strings |
| Field extraction order matters | defaults → images → features → int → float → text → boolean |

## Current Coverage

| Status | Count | Scrapers |
|--------|-------|----------|
| ✅ With fixture | 13 | uk_rightmove, uk_zoopla, uk_onthemarket, uk_jitty, es_idealista, es_fotocasa, es_pisos, ie_daft, us_realtor, us_mlslistings, us_wyomingmls, us_forsalebyowner, in_realestateindia |
| ⏳ No fixture | 5 | de_immoscout, fr_seloger, fr_leboncoin, au_domain, au_realestate |
