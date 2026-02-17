# PropertyWebScraper — Roadmap

**Last updated:** February 2026  
**Current state:** 13 portals, 5 countries, 710 tests passing

This roadmap consolidates ideas from `AUDIT_SUMMARY.md`, `CRITICAL_FIXES.md`, `QUICK_WINS_CHECKLIST.md`, `TODO-pwb-pro-learnings.md`, and `pasarela-inspired-improvements.md` into a single prioritized plan.

---

## Phase 1: Security & Operations Hardening

> [!CAUTION]
> These should be done before any production deployment if not already in place.

### 1.1 ✅ Fix Timing Attack in API Key Comparison
**Files:** `auth.ts`, `admin-auth.ts`  
Already uses `constantTimeCompare` from `constant-time.ts`.  

### 1.2 ✅ Add Input Sanitization *(newly implemented)*
**File:** [NEW] `content-sanitizer.ts`  
Strips HTML tags from text fields, rejects `javascript:` URLs, sanitizes image URL arrays. Decodes HTML entities post-strip. Integrated into `html-extractor.ts` pipeline.

### 1.3 ✅ Add Security Headers Middleware
**File:** `middleware.ts`  
Already sets `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `X-XSS-Protection`, `Permissions-Policy`.  

### 1.4 ✅ Structured Console Logging
**File:** `activity-logger.ts`  
Already outputs structured JSON to console in production (error/warn/info levels).  

### 1.5 ✅ Environment Variable Validation
**File:** `env-validator.ts`  
Already called from middleware on every request.  

### 1.6 ✅ CI Audit + Dependabot
**Files:** `.github/dependabot.yml`, `.github/workflows/ci.yml`  
Already configured.  

**Phase 1 total: ✅ Complete**

---

## Phase 2: Extraction Engine Improvements

These improve data quality and enable new portals.

### 2.1 ✅ `__NEXT_DATA__` Strategy Support
**File:** `strategies.ts`  
Already implemented in `getOrParseScriptJson` — looks for `<script id="VAR">` tag, then falls back to `window.VAR = {...}` regex.  

### 2.2 ✅ JSON-LD Extraction Strategy
**Files:** `strategies.ts`, `mapping-loader.ts`  
Already has `getOrParseJsonLd`, `searchJsonLd`, and `jsonLdPath`/`jsonLdType` in field mappings.  

### 2.3 ✅ Fallback Strategy Chains
**Files:** `mapping-loader.ts`, `strategies.ts`  
Already supports `fallbacks?: FieldMapping[]` with fallback chain iteration in `retrieveTargetText`.  

### 2.4 ✅ Weighted Quality Scoring
**File:** `quality-scorer.ts`  
Already has `assessQualityWeighted` with critical/important/optional field tiers and grade capping.  

### 2.5 ✅ Selector Caching + Lazy Script Parsing
**Files:** `strategies.ts`  
Already has `selectorCache` and `scriptTextCache` WeakMaps for per-document caching.  

**Phase 2 total: ✅ Complete**

---

## Phase 3: New & Upgraded Scrapers

### 3.1 Zoopla v2 (Next.js `__NEXT_DATA__`) ⭐
**Depends on:** 2.1  
Rich data in `props.pageProps.listingDetails.*`. Replace current CSS-based scraper.  
**Effort:** 4 hours

### 3.2 OnTheMarket v2 (Next.js `__NEXT_DATA__`)
**Depends on:** 2.1  
Data in `props.pageProps.property` or `props.initialReduxState.property`.  
**Effort:** 4 hours

### 3.3 Daft.ie v2 (Next.js `__NEXT_DATA__`)
**Depends on:** 2.1  
Data in `props.pageProps.*`. Already has a mapping; upgrade to script-based extraction.  
**Effort:** 4 hours

### 3.4 Idealista v2 (`__INITIAL_STATE__`)
Uses `window.__INITIAL_STATE__` — current `scriptJsonVar` already handles this. Needs fresh fixture capture (anti-bot challenges).  
**Effort:** 4 hours

### 3.5 Enrich Rightmove v2
Add fields from `PAGE_MODEL`: `tenure`, `features`, `constructed_area`, `epc_rating`, additional images.  
**Effort:** 2 hours

### 3.6 Add Missing Fixtures
Capture `forsalebyowner` fixture. Use browser-based capture if direct fetch is blocked.  
**Effort:** 2 hours

**Phase 3 total: ~3 days**

---

## Phase 4: Architecture & Data Quality

### 4.1 URL Canonicalization & Dedup
**File:** [NEW] `url-canonicalizer.ts`  
Normalize URLs (strip tracking params, trailing slashes, lowercase host). Prevent duplicate listings in the store.  
**Effort:** 4 hours

### 4.2 Asset/Listing Schema Split
**File:** [NEW] `schema-splitter.ts`  
Split flat property hash into `assetData` (physical: coords, rooms) and `listingData` (sale-specific: price, status). Useful for downstream consumers that only care about price changes.  
**Effort:** 3 hours

### 4.3 Portal Configuration Registry Consolidation
**File:** `portal-registry.ts` (already partially implemented)  
Enrich with `contentSource`, `requiresJsRendering`, `stripTrailingSlash`. Make it the single source of truth for all portal metadata.  
**Effort:** 4 hours

### 4.4 Comprehensive Strategy Documentation
**File:** `.claude/skills/add-scraper/reference.md`  
Document all strategies with decision tree: HTML→`cssLocator`, `window.VAR`→`scriptJsonVar`, Next.js→`__NEXT_DATA__`, RSC→`flightDataPath`, Schema.org→`jsonLdPath`.  
**Effort:** 2 hours

**Phase 4 total: ~2 days**

---

## Phase 5: Observability & Performance (Future)

### 5.1 OpenTelemetry Metrics
Track extraction time, cache hit rate, error rate, quality grade distribution per portal.  
**Effort:** 4 days

### 5.2 Result Caching
Cache extraction results for repeated URLs. LRU in-memory with optional KV persistence.  
**Effort:** 3 days

### 5.3 Automated Scraper Health Monitoring
Periodic fixture re-extraction to detect when sites change their structure. Alert when extraction rate drops.  
**Effort:** 2 days

---

## Summary

| Phase | Focus | Effort | Impact |
|-------|-------|--------|--------|
| **1** | Security & Ops | 1 day | 🔴 Critical — production readiness |
| **2** | Extraction Engine | 3-4 days | 🟡 High — data quality + new strategies |
| **3** | New Scrapers | 3 days | 🟡 High — expand portal coverage |
| **4** | Architecture | 2 days | 🟢 Medium — maintainability + dedup |
| **5** | Observability | ~2 weeks | 🟢 Medium — operational maturity |

**Total phases 1-4:** ~10 working days  
**Full roadmap including phase 5:** ~4 weeks

---

## Already Completed ✅

These were previously identified as improvements and have been implemented:

- Structured error responses with error codes
- Proper HTTP status codes (400, 401, 404, 413, 429, 500)
- `GET /public_api/v1/supported_sites` endpoint
- `GET /public_api/v1/health` endpoint
- Input validation (size limits, Content-Type)
- CORS headers
- Richer extraction response metadata
- In-memory rate limiting
- Comprehensive E2E test suite
- Rightmove v2 scraper (`scriptJsonPath` for `PAGE_MODEL`)
- `flightDataPath` strategy for Next.js RSC
- `scriptJsonVar` + `scriptJsonPath` strategy
- Scraper cleanup: removed cerdfw, carusoimmobiliare, weebrix, inmo1
