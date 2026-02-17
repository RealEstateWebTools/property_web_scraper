---
name: fix-scraper
description: Diagnose and fix a broken scraper mapping. Use when extraction tests fail, a scraper returns wrong data, or a website has changed its HTML structure.
argument-hint: [scraper-name]
---

# Fix a Broken Scraper Mapping

You are helping the user diagnose and fix a broken scraper mapping. This follows the workflow in `astro-app/docs/scraper-maintenance-guide.md`.

## Inputs

`$ARGUMENTS` should be a scraper name (e.g. `rightmove`, `idealista`). If not provided, ask the user which scraper is broken, or run the full test suite to find failures.

## Step-by-step workflow

### Phase 1: Identify the problem

1. **Run the scraper's validation tests** to see which fields are failing:
   ```bash
   cd astro-app && npx vitest run test/lib/scraper-validation.test.ts -t "<scraper_name>"
   ```

2. **If no scraper name was given**, run the full validation suite and identify which scrapers have failures:
   ```bash
   cd astro-app && npx vitest run test/lib/scraper-validation.test.ts
   ```

3. **Read the test output** and identify the specific fields that are failing. Note the expected vs actual values.

### Phase 2: Diagnose root cause

4. **Read the scraper mapping** at `config/scraper_mappings/<name>.json`. For each failing field, identify the extraction strategy (cssLocator, scriptRegEx, urlPathPart, scriptJsonPath, jsonLdPath).

5. **Read the HTML fixture** at `astro-app/test/fixtures/<name>.html`. Search for the DOM elements the mapping targets.

6. **Check the manifest** at `astro-app/test/fixtures/manifest.ts` to understand expected values.

7. **Identify the root cause** using this checklist:

   | Symptom | Likely cause |
   |---|---|
   | Field returns `0` or empty string | CSS selector doesn't match any element |
   | Field returns concatenated garbage | Selector matches multiple elements, missing `cssCountId` |
   | Field is wrong type (string vs int) | Field defined in two sections, last one wins |
   | `splitTextCharacter` produces wrong result | Cheerio normalizes `<br>` to `\n`, not `\r` |
   | `scriptRegEx` returns empty | Pattern doesn't match any script tag content |
   | `stripString` doesn't strip enough | Only removes one exact substring occurrence |
   | JSON-LD / scriptJsonPath returns empty | Structure changed or variable name changed |

### Phase 3: Fix

8. **Edit the mapping JSON** at `config/scraper_mappings/<name>.json`. Only change the specific fields that are broken. Common fixes:
   - Update CSS selectors to match current DOM structure
   - Add `cssCountId` when selector matches multiple elements
   - Fix `splitTextCharacter` (use `\n` not `\r`)
   - Update `scriptRegEx` pattern
   - Add fallback strategies via `fallbacks` array
   - Move field to correct section if type is wrong

9. **Update expected values** in `astro-app/test/fixtures/manifest.ts` if the site content has legitimately changed.

10. **If the fixture HTML is outdated**, offer to recapture it:
    ```bash
    cd astro-app
    npm run capture-fixture -- --file <new_html_file> --url <source_url> --name <scraper_name> --force
    ```

### Phase 4: Verify

11. **Run the specific scraper's tests**:
    ```bash
    cd astro-app && npx vitest run test/lib/scraper-validation.test.ts -t "<scraper_name>"
    ```

12. **Run the full test suite** to check for regressions:
    ```bash
    cd astro-app && npx vitest run
    ```

13. **Present a summary** of changes made and offer to commit.

## Key references

- Mapping format: `DESIGN.md` (Scraper Mapping Schema section)
- Extraction pipeline order: defaultValues -> images -> features -> intFields -> floatFields -> textFields -> booleanFields
- Maintenance guide: `astro-app/docs/scraper-maintenance-guide.md`
- All strategies: cssLocator, scriptRegEx, urlPathPart, scriptJsonPath, scriptJsonVar, jsonLdPath, jsonLdType, flightDataPath
- Post-processing: cssAttr, xmlAttr, cssCountId, splitTextCharacter, splitTextArrayId, stripString, stripPunct, stripFirstChar
- Fallback chains: `fallbacks` array on any field mapping
