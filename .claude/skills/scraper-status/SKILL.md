---
name: scraper-status
description: Quick overview of all scrapers — quality grades, extraction rates, and coverage gaps.
---

# Scraper Status Overview

Show the health and quality of all supported scrapers by running the validation test suite and summarizing results.

## Workflow

### Step 1: Run the full validation suite

```bash
cd astro-app && npx vitest run test/lib/scraper-validation.test.ts 2>&1
```

### Step 2: Summarize results

Parse the test output and present a table showing for each scraper:

| Scraper | Grade | Extraction Rate | Weighted Rate | Critical Missing | Status |
|---------|-------|-----------------|---------------|------------------|--------|

### Step 3: Identify issues

Highlight:
- **Failing scrapers** (grade F or test failures)
- **Degraded scrapers** (grade C, or not meeting expected extraction rate)
- **Missing critical fields** (title, price_string, price_float)
- **Coverage gaps** (portals without test fixtures)

### Step 4: If MCP tools are available

When the `property-scraper` MCP server is running, you can also use:
- `list_supported_portals` to get the full list of supported portals
- `get_scraper_mapping` to inspect a specific scraper's selectors
- `extract_property` to re-run extraction on a fixture for detailed diagnostics

### Output format

Present a concise dashboard:
- Total scrapers, passing, failing
- Table of all scrapers with grades
- Action items for any scrapers needing attention
