# Public API Improvements — Design Notes

## Current State (as of Feb 2026)

### Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/public_api/v1/listings?url=...` | Look up property by URL |
| POST | `/public_api/v1/listings` | Extract property data from URL + optional HTML |
| GET | `/public_api/v1/listings/:id` | Retrieve listing by in-memory store ID |

### Extraction Engine

- 16 scrapers (idealista, rightmove, zoopla, realtor, fotocasa, pisos, etc.)
- 69 listing fields (pricing, dimensions, features, images, GPS, multi-language descriptions)
- 4 extraction strategies: CSS selector, XPath, script regex, URL path
- Cheerio + JSDOM for HTML parsing
- Post-processing: split, strip, type coercion, HTML sanitization

### Persistence

- Firestore with graceful in-memory fallback
- `GET /:id` uses separate in-memory Map (lost on restart)
- Silent Firestore failures — client gets `success: true` with empty data

### Auth

- Optional API key via `X-Api-Key` header or `api_key` query param
- Single shared key (env var `PWS_API_KEY`)
- If env var not set, all requests pass through

### Test Coverage

- Unit tests (Vitest): extractor, models, mapping loader, strategies, api-response, url-validator
- E2E tests (Playwright): 8 API tests covering all error codes and HTTP status codes
- Gaps: auth paths, POST body variants, sanitization

---

## Weaknesses

### Error Handling

- ~~All errors return HTTP 200 with `{ success: false, error_message: "..." }`~~ **Fixed**: errors now return proper HTTP status codes with `{ success: false, error: { code, message } }`
- ~~No error codes — clients must string-match to distinguish error types~~ **Fixed**: 6 machine-readable error codes (`MISSING_URL`, `INVALID_URL`, `UNSUPPORTED_HOST`, `MISSING_SCRAPER`, `UNAUTHORIZED`, `LISTING_NOT_FOUND`)
- Firestore failures silently swallowed (client sees stale/empty data as success)
- ~~No distinction between missing URL, bad format, unsupported host, scraper failure~~ **Fixed**: each error type has its own code and HTTP status

### Input Protection

- No HTML payload size limit (can pass arbitrarily large HTML to cheerio)
- No rate limiting
- No Content-Type enforcement on POST
- Single shared API key, no per-client tracking

### Response Quality

- GET without HTML returns near-empty listing as `success: true`
- No metadata about what was extracted vs. what wasn't
- No indication of Firestore persistence status

### Docs

- Static HTML with curl examples only
- ~~No error response examples~~ **Fixed**: error codes reference table and example error response added to docs page
- No field descriptions
- No supported sites list
- No interactive try-it-out

---

## Proposed Improvements

### 1. Structured Error Responses with Error Codes ✅ DONE

Implemented in `api-response.ts`. Errors now return `{ success: false, error: { code, message } }` with proper HTTP status codes.

Implemented codes:

| Code | HTTP Status | When |
|------|-------------|------|
| `MISSING_URL` | 400 | No `url` parameter provided |
| `INVALID_URL` | 400 | URL cannot be parsed or uses non-HTTP protocol |
| `UNSUPPORTED_HOST` | 400 | Host not in supported sites list |
| `MISSING_SCRAPER` | 500 | Host recognized but scraper mapping file missing |
| `UNAUTHORIZED` | 401 | Missing or invalid API key |
| `LISTING_NOT_FOUND` | 404 | ID not found in store |

Future codes (not yet implemented):

| Code | HTTP Status | When |
|------|-------------|------|
| `EXTRACTION_FAILED` | 422 | HTML provided but extraction returned no data |
| `RATE_LIMITED` | 429 | Too many requests |
| `PAYLOAD_TOO_LARGE` | 413 | HTML body exceeds size limit |

### 2. Proper HTTP Status Codes ✅ DONE

All endpoints now return correct HTTP status codes (400, 401, 404, 500) instead of 200 for errors.

### 3. New Endpoint: `GET /public_api/v1/supported_sites`

Returns list of supported hosts and scraper info. Data already exists in
`LOCAL_HOST_MAP` (url-validator.ts) and the scraper mapping files.

```json
{
  "success": true,
  "sites": [
    { "host": "www.idealista.com", "scraper": "idealista", "country": "Spain" },
    { "host": "www.rightmove.co.uk", "scraper": "rightmove", "country": "UK" }
  ]
}
```

### 4. New Endpoint: `GET /public_api/v1/health`

Health check for monitoring.

```json
{
  "success": true,
  "status": "ok",
  "firestore": "connected",
  "scrapers_loaded": 16,
  "version": "1.0.0"
}
```

### 5. Input Validation

- Max HTML body size: 10MB (return 413 if exceeded)
- URL format validation before host lookup
- Content-Type enforcement on POST (reject unsupported types)

### 6. Richer Extraction Response

POST response includes extraction metadata:

```json
{
  "success": true,
  "extraction": {
    "fields_extracted": 12,
    "fields_available": 25,
    "scraper_used": "idealista",
    "persisted": true
  },
  "listing": { }
}
```

### 7. CORS Headers

Add `Access-Control-*` headers for browser extension / SPA consumers.

### 8. Rate Limiting (Lightweight)

In-memory sliding window per API key or IP. Return `429` with `Retry-After` header.

### 9. Expanded API Docs Page

- Expandable request/response examples for each endpoint
- Error code reference table with example responses
- Supported sites list (pulled from data, not hardcoded)
- Field descriptions for listing response
- Optional: "Try it" form for live API calls

### 10. Comprehensive Test Suite

Tests to add:

**Auth:**
- Missing API key when `PWS_API_KEY` set -> 401
- Wrong API key -> 401
- Valid API key in header -> 200
- Valid API key in query param -> 200
- No `PWS_API_KEY` env var -> all requests pass

**POST variants:**
- JSON body with url + html -> extraction succeeds
- JSON body with url only, no html -> returns listing without extraction
- Multipart form with html_file upload -> extraction succeeds
- Missing url in POST body -> 400 with `MISSING_URL`
- Empty html string -> returns listing without extraction
- Unsupported Content-Type -> 400

**Status codes:**
- Each error code maps to correct HTTP status
- Successful GET -> 200
- Successful POST -> 200 (or 201)

**New endpoints:**
- Supported sites returns all hosts
- Health endpoint returns ok status

**Error codes:**
- Each error scenario returns correct `error.code`

---

## Suggested Implementation Order

1. ~~Structured errors + proper HTTP status codes (foundation for everything else)~~ ✅ DONE
2. New endpoints: `supported_sites` and `health`
3. Input validation (size limits, Content-Type)
4. ~~Expanded test suite covering all the above~~ ✅ DONE (unit + E2E tests for error codes)
5. ~~Updated docs page with error reference and supported sites~~ ✅ DONE (error codes section added)
6. CORS headers
7. Richer extraction response metadata
8. Rate limiting
