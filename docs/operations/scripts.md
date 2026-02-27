# CLI Scripts Reference

All scripts live in `astro-app/scripts/`. Run them from the `astro-app/` directory unless noted otherwise.

---

## Data Cleanup

### `cleanup-test-data.mjs`

Scans Firestore and deletes listings and hauls that look like test data.

**Detection rules — listings:**
- `env` field set to `development` or `test`
- Document ID starts with `auto_`
- URL contains `localhost`, `example.com`, `test.`, `demo.`, `127.0.0.1`, or `staging`
- Created < 1 hour ago and missing `title`
- Created < 24 hours ago and title/description contains `test`, `demo`, `sample`, `placeholder`, `xxx`, `zzz`, etc.
- Created < 24 hours ago and `extraction_rate < 0.1`

**Detection rules — hauls:**
- `env` field set to `development` or `test`
- Name contains `My London Search`, `Test Search`, `Demo Haul`, `Test Haul`, `Search`, or `untitled`

```bash
node scripts/cleanup-test-data.mjs           # Preview — no changes
node scripts/cleanup-test-data.mjs --confirm # Delete
```

Requires `FIRESTORE_PROJECT_ID` and `GOOGLE_SERVICE_ACCOUNT_JSON` in `.env`.

---

### `cleanup-empty-hauls.mjs`

Deletes hauls that have fewer listings than a configurable threshold. Useful after heavy testing leaves many abandoned hauls.

```bash
node scripts/cleanup-empty-hauls.mjs                          # Preview (threshold: 1)
node scripts/cleanup-empty-hauls.mjs --min-listings 2         # Preview (threshold: 2)
node scripts/cleanup-empty-hauls.mjs --confirm                # Delete (threshold: 1)
node scripts/cleanup-empty-hauls.mjs --min-listings 3 --confirm
```

Expired hauls are excluded from deletion (they will expire on their own).

---

### `cleanup-low-quality-listings.mjs`

Deletes listings whose extraction quality falls below a configurable threshold. Filters by grade, extraction rate, confidence score, or any combination (all conditions must match).

```bash
node scripts/cleanup-low-quality-listings.mjs                         # Preview grade F (default)
node scripts/cleanup-low-quality-listings.mjs --grade F,C             # Preview grade F or C
node scripts/cleanup-low-quality-listings.mjs --max-rate 0.1          # Preview rate < 10%
node scripts/cleanup-low-quality-listings.mjs --max-confidence 0.2    # Preview confidence < 20%
node scripts/cleanup-low-quality-listings.mjs --grade F --max-rate 0.15  # Combine filters (AND)
node scripts/cleanup-low-quality-listings.mjs --grade F --confirm     # Execute deletion
node scripts/cleanup-low-quality-listings.mjs --help                  # Show all options
```

Always runs as a dry-run preview unless `--confirm` is passed. Shows a breakdown by grade, visibility, and a sample of affected listings before deleting.

---

### `cleanup-env-data.mjs`

Deletes listings and hauls tagged with a specific `env` field value. More targeted than `cleanup-test-data` — only matches documents that have an explicit environment tag set.

```bash
node scripts/cleanup-env-data.mjs                         # Preview dev + test (both collections)
node scripts/cleanup-env-data.mjs --env development       # Preview 'development' only
node scripts/cleanup-env-data.mjs --env test              # Preview 'test' only
node scripts/cleanup-env-data.mjs --confirm               # Execute deletion
node scripts/cleanup-env-data.mjs --env development --confirm
```

---

### `deduplicate-listings.ts`

Removes duplicate Firestore listing documents. Two documents are duplicates when they share the same canonical URL (hostname + pathname, trailing-slash-normalised). The most recently updated document is kept.

```bash
npx tsx scripts/deduplicate-listings.ts             # Dry run (safe — no changes)
npx tsx scripts/deduplicate-listings.ts --execute   # Delete duplicates
npx tsx scripts/deduplicate-listings.ts --verbose   # Show every document processed
```

---

## Quality & Testing

### `smoke-test.sh`

Quick sanity check that the server is up and key endpoints respond. Exits non-zero on the first failure.

```bash
bash scripts/smoke-test.sh                        # Test http://localhost:4321
bash scripts/smoke-test.sh https://your-domain.com  # Test a deployed URL
```

Checks: `/health`, `/public_api/v1/health`, `/public_api/v1/supported_sites`.

---

### `contract-test.ts`

Runs live extraction against each scraper's known URL and verifies the quality grade meets a minimum threshold. Detects when a real site has changed its HTML structure.

```bash
npx tsx scripts/contract-test.ts                         # Test all scrapers
npx tsx scripts/contract-test.ts --scraper=uk_rightmove  # Test one scraper
npx tsx scripts/contract-test.ts --min-grade=B           # Require grade B or better
npx tsx scripts/contract-test.ts --json                  # JSON output
```

Exit codes: `0` = all pass, non-zero = one or more failures.

> **Note:** Makes real HTTP requests to live property sites. Do not run in CI on every push — use sparingly or in a scheduled job.

---

### `stale-check.ts`

Detects scrapers whose extraction quality has degraded since a saved baseline. Delegates to Vitest internally.

```bash
npx tsx scripts/stale-check.ts --save          # Save current grades as baseline
npx tsx scripts/stale-check.ts                 # Compare against baseline
npx tsx scripts/stale-check.ts --threshold=15  # Flag drops > 15% (default: 10%)
```

Baseline is stored locally. Run `--save` after confirming current quality is acceptable, then run without `--save` in future to detect regressions.

---

## Fixture Capture

### `capture-fixture.ts`

Fetches a property listing URL (or reads a local HTML file) and saves it as a test fixture. The main tool for adding new scrapers.

```bash
npm run capture-fixture -- <url>
npm run capture-fixture -- --file page.html --url <url>
npm run capture-fixture -- --help
```

See `docs/scrapers/scraper-maintenance-guide.md` for the full workflow.

---

### `capture-browser-fixtures.ts`

Batch captures browser-rendered HTML using Puppeteer. Needed for sites that render content via JavaScript (where a plain HTTP fetch gives an empty shell).

Requires `puppeteer` installed (`npm install puppeteer` — it is an optional dev dependency).

```bash
npx tsx scripts/capture-browser-fixtures.ts                  # All scrapers
npx tsx scripts/capture-browser-fixtures.ts uk_rightmove     # Single scraper
npx tsx scripts/capture-browser-fixtures.ts --server-only    # Only server-fetched (no browser)
```

---

### `fixture-receiver.mjs`

A tiny local HTTP server (port 9876) that accepts HTML POSTed from a browser and saves it as a fixture file. Useful for capturing rendered HTML from sites with strict CSP that block Puppeteer automation.

```bash
node scripts/fixture-receiver.mjs
# Then from browser devtools console on the target page:
# fetch('http://localhost:9876/save/uk_zoopla', { method: 'POST', body: document.documentElement.outerHTML })
```

The saved file lands in `test/fixtures/<name>.html`.
