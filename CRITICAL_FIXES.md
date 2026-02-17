# Critical Security & Reliability Fixes

**These fixes should be implemented immediately before any production deployment.**

---

## 1. Fix Timing Attack Vulnerability (CRITICAL)

### Current Code (Vulnerable)
**File:** `astro-app/src/lib/services/auth.ts:20`

```typescript
if (!providedKey || providedKey !== expectedKey) {
  // Timing attack: string comparison time varies with match position
  return { authorized: false, errorResponse: ... };
}
```

### Fixed Code
```typescript
import { timingSafeEqual } from 'crypto';

function constantTimeCompare(a: string, b: string): boolean {
  // Ensure both strings are same length to prevent length-based timing attacks
  if (a.length !== b.length) {
    return false;
  }
  
  // Convert to buffers for constant-time comparison
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  
  try {
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export function authenticateApiKey(request: Request): { authorized: boolean; errorResponse?: Response } {
  const expectedKey = import.meta.env.PWS_API_KEY || '';
  if (!expectedKey) {
    return { authorized: true };
  }

  const providedKey =
    request.headers.get('X-Api-Key') ||
    new URL(request.url).searchParams.get('api_key') ||
    '';

  // Use constant-time comparison
  if (!providedKey || !constantTimeCompare(providedKey, expectedKey)) {
    logActivity({
      level: 'warn',
      category: 'auth',
      message: `Auth failed: ${providedKey ? 'invalid key' : 'no key provided'}`,
      path: new URL(request.url).pathname,
      method: request.method,
      statusCode: 401,
      errorCode: ApiErrorCode.UNAUTHORIZED,
    });
    return {
      authorized: false,
      errorResponse: errorResponse(ApiErrorCode.UNAUTHORIZED, 'Unauthorized'),
    };
  }

  return { authorized: true };
}
```

**Also fix in:** `astro-app/src/lib/services/admin-auth.ts:39`

---

## 2. Add Input Sanitization (CRITICAL)

### Create New File
**File:** `astro-app/src/lib/services/content-sanitizer.ts`

```typescript
import sanitizeHtml from 'sanitize-html';

const TEXT_FIELDS = [
  'title', 'description', 'reference', 'price_string', 'currency',
  'address_string', 'street_address', 'street_number', 'street_name',
  'city', 'province', 'region', 'country', 'postal_code', 'locale_code',
  'area_unit', 'title_es', 'description_es', 'title_de', 'description_de',
  'title_fr', 'description_fr', 'title_it', 'description_it',
];

const URL_FIELDS = ['main_image_url'];
const URL_ARRAY_FIELDS = ['image_urls', 'related_urls'];
const SAFE_SCHEMES = ['http:', 'https:'];

/**
 * Sanitize a single URL string.
 * - Rejects dangerous schemes (javascript:, data:, etc.)
 * - Fixes protocol-relative URLs (//example.com → https://example.com)
 * - Returns null for invalid URLs
 */
function sanitizeUrl(url: string): string | null {
  if (!url || url.trim() === '') return null;

  let stripped = url.trim();

  // Fix protocol-relative URLs
  if (stripped.startsWith('//')) {
    stripped = `https:${stripped}`;
  }

  try {
    const parsed = new URL(stripped);
    if (!SAFE_SCHEMES.includes(parsed.protocol)) {
      return null;
    }
    return stripped;
  } catch {
    return null;
  }
}

/**
 * Sanitize scraped property data before persistence.
 * Strips HTML tags, rejects dangerous URLs, filters invalid URLs from arrays.
 */
export function sanitizePropertyHash(propertyHash: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...propertyHash };

  // Sanitize text fields (strip HTML)
  for (const field of TEXT_FIELDS) {
    const value = sanitized[field];
    if (typeof value === 'string') {
      sanitized[field] = sanitizeHtml(value, {
        allowedTags: [],
        allowedAttributes: {},
      }).trim();
    }
  }

  // Sanitize URL fields
  for (const field of URL_FIELDS) {
    const value = sanitized[field];
    if (typeof value === 'string') {
      sanitized[field] = sanitizeUrl(value);
    }
  }

  // Sanitize URL array fields
  for (const field of URL_ARRAY_FIELDS) {
    const value = sanitized[field];
    if (Array.isArray(value)) {
      sanitized[field] = value
        .filter((url): url is string => typeof url === 'string')
        .map(sanitizeUrl)
        .filter((url): url is string => url !== null);
    }
  }

  // Sanitize features array
  if (Array.isArray(sanitized.features)) {
    sanitized.features = sanitized.features.map((feature) => {
      if (typeof feature === 'string') {
        return sanitizeHtml(feature, {
          allowedTags: [],
          allowedAttributes: {},
        }).trim();
      }
      return feature;
    });
  }

  return sanitized;
}
```

### Use in Extraction Pipeline
**File:** `astro-app/src/lib/extractor/html-extractor.ts`

```typescript
import { sanitizePropertyHash } from '../services/content-sanitizer.js';

export function extractFromHtml(params: ExtractParams): ExtractionResult {
  // ... existing extraction logic ...
  
  // Sanitize before returning
  const sanitizedHash = sanitizePropertyHash(propertyHash);
  
  return {
    success: true,
    status: determineStatus(contentAnalysis, populatedFields, extractableFields),
    properties: [sanitizedHash],
    warnings,
    diagnostics,
    splitSchema,
    fingerprint,
  };
}
```

---

## 3. Add Health Check Endpoint (HIGH PRIORITY)

### Create New File
**File:** `astro-app/src/pages/health.ts`

```typescript
import type { APIRoute } from 'astro';
import { allMappingNames } from '@lib/extractor/mapping-loader.js';

interface HealthCheck {
  name: string;
  healthy: boolean;
  message?: string;
  duration_ms?: number;
}

async function checkMappings(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const names = allMappingNames();
    return {
      name: 'mappings',
      healthy: names.length > 0,
      message: `${names.length} scrapers loaded`,
      duration_ms: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'mappings',
      healthy: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      duration_ms: Date.now() - start,
    };
  }
}

async function checkMemory(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    // Cloudflare Workers don't have process.memoryUsage()
    // Just return healthy for now
    return {
      name: 'memory',
      healthy: true,
      message: 'Memory check not available in Workers',
      duration_ms: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'memory',
      healthy: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      duration_ms: Date.now() - start,
    };
  }
}

export const GET: APIRoute = async () => {
  const checks = await Promise.all([
    checkMappings(),
    checkMemory(),
  ]);

  const allHealthy = checks.every((check) => check.healthy);

  const response = {
    status: allHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    checks,
  };

  return new Response(JSON.stringify(response, null, 2), {
    status: allHealthy ? 200 : 503,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
};
```

---

## 4. Add Request Size Limits (HIGH PRIORITY)

### Update Auth Service
**File:** `astro-app/src/lib/services/auth.ts`

```typescript
const MAX_HTML_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_URL_LENGTH = 2048; // Standard browser limit

export async function extractHtmlInput(request: Request): Promise<string | null> {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const htmlFile = formData.get('html_file');
    if (htmlFile && htmlFile instanceof File) {
      // Check file size
      if (htmlFile.size > MAX_HTML_SIZE) {
        throw new Error(`HTML file exceeds maximum size of ${MAX_HTML_SIZE / 1024 / 1024}MB`);
      }
      return await htmlFile.text();
    }
    const html = formData.get('html');
    if (html && typeof html === 'string') {
      if (html.length > MAX_HTML_SIZE) {
        throw new Error(`HTML exceeds maximum size of ${MAX_HTML_SIZE / 1024 / 1024}MB`);
      }
      return html;
    }
    return null;
  }

  if (contentType.includes('application/json')) {
    const body = await request.json();
    const html = body.html;
    if (html && typeof html === 'string') {
      if (html.length > MAX_HTML_SIZE) {
        throw new Error(`HTML exceeds maximum size of ${MAX_HTML_SIZE / 1024 / 1024}MB`);
      }
      return html;
    }
    return null;
  }

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const formData = await request.formData();
    const html = formData.get('html');
    if (html && typeof html === 'string') {
      if (html.length > MAX_HTML_SIZE) {
        throw new Error(`HTML exceeds maximum size of ${MAX_HTML_SIZE / 1024 / 1024}MB`);
      }
      return html;
    }
    return null;
  }

  return null;
}

export function validateUrlLength(url: string): void {
  if (url.length > MAX_URL_LENGTH) {
    throw new Error(`URL exceeds maximum length of ${MAX_URL_LENGTH} characters`);
  }
}
```

### Use in API Endpoints
**File:** `astro-app/src/pages/public_api/v1/listings.ts`

```typescript
import { validateUrlLength } from '@lib/services/auth.js';

export const POST: APIRoute = async ({ request }) => {
  // ... auth checks ...
  
  const url = body.url;
  
  // Validate URL length
  try {
    validateUrlLength(url);
  } catch (error) {
    return errorResponse(
      ApiErrorCode.INVALID_URL,
      error instanceof Error ? error.message : 'Invalid URL'
    );
  }
  
  // ... rest of handler ...
};
```

---

## Testing These Fixes

### Test Timing Attack Fix
```bash
# Should take same time regardless of key similarity
time curl -H "X-Api-Key: aaaaaaaaaa" http://localhost:4321/public_api/v1/listings
time curl -H "X-Api-Key: correct_ke" http://localhost:4321/public_api/v1/listings
time curl -H "X-Api-Key: zzzzzzzzzz" http://localhost:4321/public_api/v1/listings
```

### Test Input Sanitization
```bash
curl -X POST http://localhost:4321/public_api/v1/listings \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.idealista.com/test",
    "html": "<script>alert(\"xss\")</script><p>Safe content</p>"
  }'
# Should return sanitized content without <script> tags
```

### Test Health Check
```bash
curl http://localhost:4321/health
# Should return 200 with JSON health status
```

### Test Size Limits
```bash
# Generate 11MB file
dd if=/dev/zero of=large.html bs=1M count=11

curl -X POST http://localhost:4321/public_api/v1/listings \
  -F "url=https://www.idealista.com/test" \
  -F "html_file=@large.html"
# Should return 400 error
```

---

## Deployment Checklist

Before deploying these fixes:

1. ✅ Run all tests: `cd astro-app && npm test`
2. ✅ Run E2E tests: `npm run test:e2e`
3. ✅ Test locally with real data
4. ✅ Deploy to staging first
5. ✅ Verify health check: `curl https://staging.example.com/health`
6. ✅ Test authentication with real API keys
7. ✅ Monitor error rates for 1 hour
8. ✅ Deploy to production
9. ✅ Verify production health check
10. ✅ Monitor for 24 hours

---

## Rollback Plan

If issues are detected after deployment:

1. Immediately revert to previous deployment
2. Check Cloudflare Workers logs for errors
3. Test fixes in staging environment
4. Identify root cause
5. Fix and redeploy

---

**Priority:** Implement all 4 fixes before next production deployment  
**Estimated Time:** 1 day  
**Risk Level:** Low (all changes are additive or defensive)

