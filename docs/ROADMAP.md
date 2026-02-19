# PropertyWebScraper — Roadmap

**Last updated:** 2026-02-18
**Current state:** 17 portals, 8 countries, Astro 5 SSR on Cloudflare Pages

Historical planning documents that informed this roadmap have been archived to `docs/archive/`.

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

### 4.1 ✅ URL Canonicalization & Dedup
**File:** `url-canonicalizer.ts`
Normalizes URLs, strips tracking params, prevents duplicate listings in the store.

### 4.2 ✅ Asset/Listing Schema Split
**File:** `schema-splitter.ts`
Splits flat property hash into `assetData` (physical) and `listingData` (commercial).

### 4.3 ✅ Portal Configuration Registry Consolidation
**File:** `portal-registry.ts`
Single source of truth for all 17 portal configurations with `contentSource`, `requiresJsRendering`, `stripTrailingSlash`.

### 4.4 ✅ Comprehensive Strategy Documentation
**File:** `DESIGN.md`, `.claude/skills/add-scraper/reference.md`
All 9 extraction strategies documented with decision tree.

### 4.5 ✅ Anonymous Haul Collections
**Files:** `haul-store.ts`, `haul-id.ts`, `/ext/v1/hauls` endpoints
KV-backed anonymous collections for Chrome extension. No login required. 30-day expiry, max 20 scrapes per haul.

**Phase 4 total: ✅ Complete**

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
| **4** | Architecture | ✅ Complete | 🟢 Medium — maintainability + dedup |
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
