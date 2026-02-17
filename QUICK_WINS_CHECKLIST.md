# Quick Wins Checklist - PropertyWebScraper

**High-impact improvements that can be done in 1 day or less**

---

## Security (4 hours)

### ✅ Fix Timing Attack Vulnerability
**File:** `astro-app/src/lib/services/auth.ts`

```typescript
// Replace line 20
import { timingSafeEqual } from 'crypto';

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return timingSafeEqual(bufA, bufB);
}

// Use in authenticateApiKey:
if (!providedKey || !constantTimeCompare(providedKey, expectedKey)) {
```

**Impact:** Prevents API key brute-forcing  
**Effort:** 30 minutes

---

### ✅ Add Security Headers
**File:** `astro-app/src/middleware.ts` (create new)

```typescript
export function onRequest({ request }, next) {
  const response = await next();
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  return response;
}
```

**Impact:** Prevents common web attacks  
**Effort:** 1 hour

---

### ✅ Add Request Size Limits
**File:** `astro-app/src/lib/services/auth.ts`

```typescript
const MAX_HTML_SIZE = 10 * 1024 * 1024; // 10MB

export async function extractHtmlInput(request: Request): Promise<string | null> {
  // ... existing code ...
  const html = await htmlFile.text();
  if (html.length > MAX_HTML_SIZE) {
    throw new Error('HTML exceeds 10MB limit');
  }
  return html;
}
```

**Impact:** Prevents DoS attacks  
**Effort:** 30 minutes

---

## Monitoring (3 hours)

### ✅ Add Health Check Endpoint
**File:** `astro-app/src/pages/health.ts` (create new)

```typescript
import type { APIRoute } from 'astro';
import { allMappingNames } from '@lib/extractor/mapping-loader.js';

export const GET: APIRoute = async () => {
  const checks = {
    mappings: allMappingNames().length > 0,
    timestamp: new Date().toISOString(),
  };
  
  const healthy = checks.mappings;
  
  return new Response(JSON.stringify({ 
    status: healthy ? 'healthy' : 'unhealthy',
    checks 
  }), {
    status: healthy ? 200 : 503,
    headers: { 'Content-Type': 'application/json' },
  });
};
```

**Impact:** Load balancer integration  
**Effort:** 1 hour

---

### ✅ Add Console Logging for Production
**File:** `astro-app/src/lib/services/activity-logger.ts`

```typescript
export function logActivity(input: LogInput): void {
  // Existing buffer logic...
  
  // Also log to console in production
  if (import.meta.env.PROD) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      ...input,
    }));
  }
}
```

**Impact:** Logs visible in Cloudflare dashboard  
**Effort:** 30 minutes

---

## Performance (2 hours)

### ✅ Add Selector Caching
**File:** `astro-app/src/lib/extractor/strategies.ts`

```typescript
const selectorCache = new Map<string, ReturnType<typeof cheerio.compile>>();

function getCachedSelector(css: string) {
  if (!selectorCache.has(css)) {
    selectorCache.set(css, cheerio.compile(css));
  }
  return selectorCache.get(css)!;
}

// Use in getTextFromCss:
const elements = getCachedSelector(cssLocator)($);
```

**Impact:** 10-20% faster extraction  
**Effort:** 1 hour

---

### ✅ Lazy Script Parsing
**File:** `astro-app/src/lib/extractor/html-extractor.ts`

```typescript
// Only parse scripts if needed
let scriptText: string | null = null;

function getScriptText($: cheerio.CheerioAPI): string {
  if (scriptText === null) {
    scriptText = $('script').text();
  }
  return scriptText;
}

// Use in extractFromHtml when processing scriptRegEx fields
```

**Impact:** 20-30% faster for non-script extractions  
**Effort:** 1 hour

---

## Documentation (2 hours)

### ✅ Add Deployment Checklist
**File:** `docs/deployment-checklist.md` (create new)

```markdown
# Deployment Checklist

## Pre-Deployment
- [ ] All tests passing (`npm test`)
- [ ] E2E tests passing (`npm run test:e2e`)
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] Environment variables configured
- [ ] API keys rotated (if needed)

## Deployment
- [ ] Run `npm run build`
- [ ] Deploy to staging first
- [ ] Verify health check: `curl https://staging.example.com/health`
- [ ] Test key endpoints
- [ ] Deploy to production
- [ ] Verify health check: `curl https://example.com/health`

## Post-Deployment
- [ ] Monitor error rates for 1 hour
- [ ] Check extraction success rates
- [ ] Verify no performance regression

## Rollback
If issues detected:
1. Revert to previous deployment
2. Investigate in staging
3. Fix and redeploy
```

**Impact:** Safer deployments  
**Effort:** 1 hour

---

### ✅ Add API Error Code Reference
**File:** `docs/api-errors.md` (create new)

```markdown
# API Error Codes

| Code | HTTP Status | Description | Resolution |
|------|-------------|-------------|------------|
| `INVALID_URL` | 400 | URL is malformed | Check URL format |
| `UNSUPPORTED_URL` | 400 | Portal not supported | See supported sites |
| `UNAUTHORIZED` | 401 | Invalid API key | Check X-Api-Key header |
| `RATE_LIMITED` | 429 | Too many requests | Wait and retry |
| `EXTRACTION_FAILED` | 500 | Extraction error | Check HTML validity |
| `INTERNAL_ERROR` | 500 | Server error | Contact support |
```

**Impact:** Better developer experience  
**Effort:** 30 minutes

---

## Testing (2 hours)

### ✅ Add Smoke Test Script
**File:** `scripts/smoke-test.sh` (create new)

```bash
#!/bin/bash
set -e

BASE_URL="${1:-http://localhost:4321}"

echo "Running smoke tests against $BASE_URL"

# Health check
curl -f "$BASE_URL/health" || exit 1
echo "✅ Health check passed"

# API endpoint
curl -f "$BASE_URL/public_api/v1/supported_sites" || exit 1
echo "✅ Supported sites endpoint passed"

echo "✅ All smoke tests passed"
```

**Impact:** Quick deployment verification  
**Effort:** 30 minutes

---

### ✅ Add Pre-commit Hook
**File:** `.husky/pre-commit` (create new)

```bash
#!/bin/sh
cd astro-app
npm test
npx tsc --noEmit
```

**Impact:** Catch errors before commit  
**Effort:** 30 minutes

---

## Configuration (1 hour)

### ✅ Add Environment Variable Validation
**File:** `astro-app/src/lib/services/env-validator.ts` (create new)

```typescript
export function validateEnv(): void {
  const warnings: string[] = [];
  
  if (!import.meta.env.PWS_API_KEY) {
    warnings.push('PWS_API_KEY not set - API authentication disabled');
  }
  
  if (!import.meta.env.GOOGLE_MAPS_API_KEY) {
    warnings.push('GOOGLE_MAPS_API_KEY not set - maps disabled');
  }
  
  if (warnings.length > 0) {
    console.warn('Environment configuration warnings:');
    warnings.forEach(w => console.warn(`  - ${w}`));
  }
}

// Call in astro.config.mjs
```

**Impact:** Catch config issues early  
**Effort:** 1 hour

---

## Dependency Management (30 minutes)

### ✅ Enable Dependabot
**File:** `.github/dependabot.yml` (create new)

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/astro-app"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5
```

**Impact:** Automated security updates  
**Effort:** 15 minutes

---

### ✅ Add npm audit to CI
**File:** `.github/workflows/ci.yml`

```yaml
# Add after "Install dependencies"
- name: Security audit
  working-directory: astro-app
  run: npm audit --audit-level=high
```

**Impact:** Catch vulnerabilities in CI  
**Effort:** 15 minutes

---

## Total Quick Wins

**Total Effort:** ~15 hours (2 days)  
**Total Impact:** HIGH

### Checklist Summary

- [ ] Fix timing attack (30 min)
- [ ] Add security headers (1 hour)
- [ ] Add request size limits (30 min)
- [ ] Add health check endpoint (1 hour)
- [ ] Add console logging (30 min)
- [ ] Add selector caching (1 hour)
- [ ] Add lazy script parsing (1 hour)
- [ ] Create deployment checklist (1 hour)
- [ ] Create API error reference (30 min)
- [ ] Add smoke test script (30 min)
- [ ] Add pre-commit hook (30 min)
- [ ] Add env validation (1 hour)
- [ ] Enable Dependabot (15 min)
- [ ] Add npm audit to CI (15 min)

---

**Next:** After completing these quick wins, proceed to Phase 1 of the full roadmap (see PROJECT_AUDIT_2026.md)

