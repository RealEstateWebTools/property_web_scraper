---
name: diagnose-extraction
description: Deep-dive diagnostics on a low-quality or failed extraction. Analyzes field traces, content provenance, fallback usage, and suggests mapping improvements.
argument-hint: [scraper-name-or-url]
---

# Deep Extraction Diagnostics

Perform a thorough analysis of an extraction result to understand why quality is low or fields are missing. Goes beyond `/extract` by analyzing each field's extraction strategy, suggesting fixes, and identifying structural issues.

## Inputs

`$ARGUMENTS` can be:
- A scraper name (runs against existing fixture)
- A URL (fetches and analyzes)
- A file path to HTML

## Workflow

### Step 1: Run extraction with full diagnostics

Write and execute an inline script to get the complete diagnostic output:

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
const d = result.diagnostics;
console.log(JSON.stringify({
  grade: d?.qualityGrade,
  label: d?.qualityLabel,
  extractionRate: d?.extractionRate,
  weightedRate: d?.weightedExtractionRate,
  totalFields: d?.totalFields,
  populated: d?.populatedFields,
  extractable: d?.extractableFields,
  populatedExtractable: d?.populatedExtractableFields,
  criticalMissing: d?.criticalFieldsMissing,
  emptyFields: d?.emptyFields,
  contentAnalysis: d?.contentAnalysis,
  fieldTraces: d?.fieldTraces,
  splitSchema: result.splitSchema,
}, null, 2));
"
```

### Step 2: Analyze content provenance

Check the `contentAnalysis` section:

- **`appearsBlocked: true`** — The page was likely bot-blocked (captcha/verify page). The user needs to provide HTML from a real browser session.
- **`appearsJsOnly: true`** — The page is a JS-only shell. The user needs to capture the rendered HTML (browser "Save As" after rendering).
- **`jsonLdCount > 0`** — JSON-LD structured data is available. Consider adding `jsonLdPath` strategies.
- **`scriptJsonVarsFound`** — Known script variables detected (PAGE_MODEL, __NEXT_DATA__, etc). Consider adding `scriptJsonPath` strategies.

### Step 3: Analyze field traces

For each empty or problematic field:

1. **Read the field trace** — what strategy was attempted?
2. **Read the mapping** — is the CSS selector still valid?
3. **Search the HTML fixture** — where does the data actually live?
4. **Check for fallbacks** — does the field have fallback strategies?
5. **Check the field importance** — is it critical (title, price), important (coords, address), or optional?

### Step 4: Analyze the HTML structure

Look at the fixture HTML for:
- **JSON-LD blocks** (`<script type="application/ld+json">`) — often contain title, price, address, coordinates
- **Open Graph meta tags** (`og:title`, `og:image`, `og:description`) — good fallback sources
- **Script variables** (`__NEXT_DATA__`, `PAGE_MODEL`, `__INITIAL_STATE__`, `dataLayer`) — rich structured data
- **Microdata attributes** (`itemprop`, `itemtype`) — semantic HTML markers
- **Twitter card meta tags** (`twitter:title`, `twitter:image`) — another fallback source

### Step 5: Generate recommendations

Based on the analysis, provide specific recommendations:

1. **Selector updates** — new CSS selectors for fields with broken selectors
2. **Fallback chains** — add `fallbacks` arrays using alternative strategies
3. **Strategy switches** — switch from fragile cssLocator to robust scriptJsonPath/jsonLdPath
4. **New fields** — data available in HTML that isn't being extracted
5. **Mapping structural issues** — fields in wrong sections, missing cssCountId, etc.

### Step 6: Offer to apply fixes

Present the specific JSON changes needed and offer to:
1. Edit the mapping file
2. Update manifest expected values if needed
3. Run validation tests
4. Commit the changes

## Key analysis patterns

| Content Signal | Recommendation |
|---|---|
| JSON-LD present, not used | Add `jsonLdPath` strategies (most robust) |
| `__NEXT_DATA__` present | Add `scriptJsonPath` with `scriptJsonVar: "__NEXT_DATA__"` |
| `PAGE_MODEL` present | Add `scriptJsonPath` with `scriptJsonVar: "PAGE_MODEL"` |
| Multiple CSS matches | Add `cssCountId: "0"` to pick first element |
| CSS selector fails | Check if classes changed, try ID-based or microdata selectors |
| Critical fields missing | Priority fix — grade capped at C until resolved |
| Fallback used | Primary strategy is broken, should be updated |
