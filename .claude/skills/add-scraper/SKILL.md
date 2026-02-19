---
name: add-scraper
description: Add support for scraping property listings from a new website. Use when the user wants to add a new scraper, create a new mapping, or support a new property listing site.
argument-hint: [url-of-listing-page]
---

# Add Scraper for a New Website

You are helping the user add support for scraping property listings from a new website. This is a multi-step process that requires creating a mapping file, capturing a test fixture, and wiring everything up.

## Inputs

The user will provide `$ARGUMENTS` which should be a URL of a sample listing page from the target website, or just the website name. If no URL is provided, ask for one.

## Step-by-step workflow

### Phase 1: Gather information

1. **Get a sample URL** if the user didn't provide one
2. **Determine the scraper name** — derive from the hostname (e.g. `www.example-realty.com` → `example_realty`). Use lowercase, underscores for separators, keep it short. Ask the user to confirm the name.
3. **Get the HTML** — Ask the user how they want to provide the HTML:
   - If the site is static (no JS rendering needed), we can fetch it directly
   - If the site is JS-heavy (React/Vue/Angular SPA), the user should save the page from their browser ("Save As" → "Web Page, HTML Only") and provide the file path
   - They can also pipe it: `curl ... | npm run capture-fixture -- --stdin --url <url>`

### Phase 2: Analyze the HTML and create the mapping

4. **Capture the fixture** using the capture-fixture utility:
   ```bash
   cd astro-app
   # For URL fetch:
   npm run capture-fixture -- <url> --name <scraper_name>
   # For local file:
   npm run capture-fixture -- --file <path> --url <url> --name <scraper_name> --no-extract
   ```

5. **Analyze the saved HTML fixture** at `astro-app/test/fixtures/<name>.html`. Look for:
   - **Title**: Usually in `<h1>`, `<title>`, or `og:title` meta tag
   - **Price**: Look for price elements, currency symbols, `itemprop="price"` microdata
   - **Address/Location**: Address strings, postal codes, `og:` meta tags, or structured data
   - **Coordinates**: Often in `<script>` tags as JSON (lat/lng), or in meta tags
   - **Bedrooms/Bathrooms**: Usually near icons or labels like "bed", "bath", "BR"
   - **Images**: `<img>` tags in gallery sections, or `og:image` meta tags
   - **Reference/ID**: Property ID in URL path, hidden inputs, or `data-` attributes
   - **For sale/rent**: Status indicators, URL patterns (`/to-rent/`, `/for-sale/`)
   - **Description**: `meta[name=description]` or content sections
   - **Area/Size**: Square footage/meters, usually near bed/bath counts

6. **Create the mapping JSON** at `config/scraper_mappings/<name>.json`. Follow the format described in the reference file at `.claude/skills/add-scraper/reference.md`.

   Key rules:
   - Each field must appear in exactly ONE section. If the same field appears in multiple sections, the last one processed wins (processing order: defaultValues → images → features → intFields → floatFields → textFields → booleanFields)
   - Always add `cssCountId: "0"` when a CSS selector might match multiple elements
   - Use `cssAttr` to read attribute values (e.g. `content` from meta tags)
   - Use `scriptRegEx` for data embedded in `<script>` tags
   - Use `urlPathPart` to extract segments from the URL path
   - Prefer class-based or ID-based selectors over `nth-child` chains

### Phase 3: Validate and register

7. **Run the capture-fixture utility again** with extraction enabled to preview results:
   ```bash
   cd astro-app
   npm run capture-fixture -- --file test/fixtures/<name>.html --url <source_url> --name <name> --force
   ```

8. **Review the extraction preview**. If fields are wrong:
   - Check selectors against the actual HTML
   - Fix the mapping JSON
   - Re-run capture-fixture to verify

9. **Add to the hostname map** — Add entries for the new hostname to:
   - `astro-app/scripts/capture-fixture.ts` in the `HOSTNAME_MAP` constant
   - `astro-app/src/lib/services/url-validator.ts` in the `LOCAL_HOST_MAP` constant

10. **Add to the test manifest** — Copy the manifest stub from capture-fixture output into `astro-app/test/fixtures/manifest.ts`. Review and adjust expected values — remove fields that are zero/empty and not meaningful, ensure types are correct (integers vs strings vs booleans).

11. **Run the test suite** to verify everything passes:
    ```bash
    cd astro-app && npx vitest run
    ```

### Phase 4: Summary

12. Present a summary of all files created/modified and offer to commit the changes.

## Important notes

- The mapping file format is JSON but parsed with JSON5 (comments are allowed)
- The `name` field in the mapping must match the scraper name used everywhere else
- `defaultValues` always produce strings (e.g. `"true"` not `true`)
- `stripPunct` removes `.` and `,` only — not currency symbols
- `stripString` removes the first occurrence of an exact substring, runs after split
- Cheerio converts `<br>` to `\n`, never `\r`
- `parseFloat`/`parseInt` return `0` on failure, not an error

## Existing scrapers for reference

These scrapers are already configured: uk_rightmove, uk_zoopla, uk_onthemarket, uk_jitty, es_idealista, es_fotocasa, es_pisos, pt_idealista, ie_daft, us_realtor, us_forsalebyowner, us_mlslistings, us_wyomingmls, in_realestateindia, de_immoscout, au_domain, au_realestate.

See `config/scraper_mappings/` for their mapping files and `astro-app/test/fixtures/manifest.ts` for expected values.
