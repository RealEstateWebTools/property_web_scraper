---
name: extract
description: Run a quick extraction test against a URL or HTML file. Shows extracted fields, quality grade, and diagnostics.
argument-hint: [url-or-file-path]
---

# Quick Extraction Test

Run the extraction pipeline against a URL or HTML file and display the results. This is the fastest way to test whether a scraper is working.

## Inputs

`$ARGUMENTS` should be one of:
- A property listing URL (e.g. `https://www.rightmove.co.uk/properties/123456`)
- A path to a local HTML file
- A scraper name to test against its existing fixture

If nothing is provided, ask the user what they want to extract.

## Workflow

### Option A: Extract from a URL (uses capture-fixture)

1. Run the capture-fixture utility which fetches, extracts, and previews:
   ```bash
   cd astro-app && npm run capture-fixture -- <url>
   ```

2. Show the user the extraction results including:
   - Quality grade and extraction rate
   - All extracted fields with values
   - Any empty fields or warnings
   - Content analysis (blocked page detection, JS-only detection)

### Option B: Extract from a local HTML file

1. Run capture-fixture with `--file`:
   ```bash
   cd astro-app && npm run capture-fixture -- --file <path> --url <source_url> --no-extract
   ```
   Note: `--url` is required to identify the scraper mapping. If the user didn't provide a URL, ask for the source website.

2. Then run the extraction test:
   ```bash
   cd astro-app && npx vitest run test/lib/scraper-validation.test.ts -t "<scraper_name>"
   ```

### Option C: Test an existing fixture

1. Run the validation test for the specified scraper:
   ```bash
   cd astro-app && npx vitest run test/lib/scraper-validation.test.ts -t "<scraper_name>"
   ```

2. Read the test output to show extraction results.

### Option D: Programmatic extraction (for debugging)

If the user wants to see the raw extraction result, write a small inline script:

```bash
cd astro-app && npx tsx -e "
import { readFileSync } from 'fs';
import { extractFromHtml } from './src/lib/extractor/html-extractor.js';
const html = readFileSync('<fixture_path>', 'utf-8');
const result = extractFromHtml({
  html,
  sourceUrl: '<url>',
  scraperMappingName: '<name>',
});
console.log(JSON.stringify({
  success: result.success,
  grade: result.diagnostics?.qualityGrade,
  rate: result.diagnostics?.extractionRate,
  weightedRate: result.diagnostics?.weightedExtractionRate,
  criticalMissing: result.diagnostics?.criticalFieldsMissing,
  fields: result.properties[0],
}, null, 2));
"
```

## Output format

Present results in a clear format:
- **Quality**: Grade (A/B/C/F), extraction rate, weighted rate
- **Critical fields**: title, price_string, price_float — highlight if missing
- **All fields**: grouped by section (text, int, float, boolean, images, features, defaults)
- **Warnings**: empty fields, blocked page detection, JS-only detection
