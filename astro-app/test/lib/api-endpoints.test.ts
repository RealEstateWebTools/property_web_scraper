/**
 * Tests for public API endpoint handlers:
 * - GET  /public_api/v1/health
 * - GET  /public_api/v1/usage
 * - GET  /public_api/v1/supported_sites
 * - GET  /public_api/v1/export?formats
 * - POST /public_api/v1/export
 * - POST /public_api/v1/webhooks
 * - GET  /public_api/v1/webhooks
 * - DELETE /public_api/v1/webhooks?id=...
 *
 * Dependencies (apiGuard, services) are mocked so we test handler logic
 * without requiring the full Astro runtime or real auth/rate-limiting.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────

vi.mock('@lib/services/api-guard.js', () => ({
  apiGuard: vi.fn(),
}));

vi.mock('@lib/services/usage-meter.js', () => ({
  getUsageSummary: vi.fn(),
}));

vi.mock('@lib/services/activity-logger.js', () => ({
  logActivity: vi.fn(),
}));

vi.mock('@lib/services/webhook-service.js', () => ({
  registerWebhook: vi.fn(),
  removeWebhook: vi.fn(),
  listWebhooks: vi.fn(),
}));

vi.mock('@lib/services/listing-store.js', () => ({
  getListing: vi.fn(),
}));

vi.mock('@lib/services/export-service.js', () => ({
  getExportService: vi.fn(),
}));

vi.mock('@lib/exporters/exporter-registry.js', () => ({
  getAvailableExporters: vi.fn(() => [
    {
      format: 'json',
      label: 'JSON',
      description: 'JSON format',
      fileExtension: '.json',
      mimeType: 'application/json',
      isAvailable: true,
      requiresGeoLocation: false,
    },
    {
      format: 'csv',
      label: 'CSV',
      description: 'CSV format',
      fileExtension: '.csv',
      mimeType: 'text/csv',
      isAvailable: true,
      requiresGeoLocation: false,
    },
  ]),
  getAllExporters: vi.fn(() => [
    {
      format: 'json',
      label: 'JSON',
      description: 'JSON format',
      fileExtension: '.json',
      mimeType: 'application/json',
      isAvailable: true,
      requiresGeoLocation: false,
    },
    {
      format: 'csv',
      label: 'CSV',
      description: 'CSV format',
      fileExtension: '.csv',
      mimeType: 'text/csv',
      isAvailable: true,
      requiresGeoLocation: false,
    },
    {
      format: 'geojson',
      label: 'GeoJSON',
      description: 'GeoJSON format',
      fileExtension: '.geojson',
      mimeType: 'application/geo+json',
      isAvailable: false,
      requiresGeoLocation: true,
    },
  ]),
}));

vi.mock('@lib/extractor/mapping-loader.js', () => ({
  allMappingNames: vi.fn(() => ['uk_rightmove', 'es_idealista', 'us_realtor']),
}));

vi.mock('@lib/services/url-validator.js', () => ({
  LOCAL_HOST_MAP: {
    'www.rightmove.co.uk': { scraper_name: 'uk_rightmove', slug: 'uk_rightmove' },
    'www.zoopla.co.uk': { scraper_name: 'uk_zoopla', slug: 'uk_zoopla' },
    'www.idealista.com': { scraper_name: 'es_idealista', slug: 'es_idealista' },
  },
  MISSING: 'MISSING',
  INVALID: 'INVALID',
  UNSUPPORTED: 'UNSUPPORTED',
}));

// ─── Helpers ──────────────────────────────────────────────────────

function mockRequest(url: string, options: RequestInit = {}): Request {
  return new Request(`http://localhost:4321${url}`, options);
}

function guardPass(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    auth: {
      authorized: true,
      userId: 'test-user',
      tier: 'free',
      ...overrides,
    },
  };
}

function guardFail(status = 401) {
  return {
    ok: false,
    response: new Response(
      JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }),
      { status, headers: { 'Content-Type': 'application/json' } },
    ),
  };
}

async function parseJson(response: Response) {
  return response.json();
}

// ─── Tests ────────────────────────────────────────────────────────

describe('GET /public_api/v1/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns status with scraper count and subsystem checks', async () => {
    const { GET } = await import('../../src/pages/public_api/v1/health.js');

    const request = mockRequest('/public_api/v1/health');
    const response = await GET({ request, url: new URL(request.url), locals: {} } as any);

    expect(response.status).toBe(200);

    const body = await parseJson(response);
    expect(body.success).toBe(true);
    expect(['ok', 'degraded']).toContain(body.status);
    expect(body.scrapers_loaded).toBe(3);
    expect(body.checks).toBeDefined();
    expect(body.checks.kv).toHaveProperty('available');
    expect(body.checks.firestore).toHaveProperty('connected');
    expect(body.checks.firestore).toHaveProperty('backend');
  });

  it('does not require authentication', async () => {
    const { apiGuard } = await import('@lib/services/api-guard.js');
    const { GET } = await import('../../src/pages/public_api/v1/health.js');

    // health endpoint does not call apiGuard — verify by checking it was not called
    const request = mockRequest('/public_api/v1/health');
    await GET({ request, url: new URL(request.url), locals: {} } as any);

    expect(apiGuard).not.toHaveBeenCalled();
  });
});

describe('GET /public_api/v1/usage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when apiGuard rejects', async () => {
    const { apiGuard } = await import('@lib/services/api-guard.js');
    (apiGuard as any).mockResolvedValue(guardFail(401));

    const { GET } = await import('../../src/pages/public_api/v1/usage.js');
    const request = mockRequest('/public_api/v1/usage');
    const response = await GET({ request } as any);

    expect(response.status).toBe(401);
  });

  it('returns error for anonymous userId', async () => {
    const { apiGuard } = await import('@lib/services/api-guard.js');
    (apiGuard as any).mockResolvedValue(guardPass({ userId: 'anonymous' }));

    const { GET } = await import('../../src/pages/public_api/v1/usage.js');
    const request = mockRequest('/public_api/v1/usage');
    const response = await GET({ request } as any);

    expect(response.status).toBe(401);
    const body = await parseJson(response);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns error when userId is missing', async () => {
    const { apiGuard } = await import('@lib/services/api-guard.js');
    (apiGuard as any).mockResolvedValue(guardPass({ userId: undefined }));

    const { GET } = await import('../../src/pages/public_api/v1/usage.js');
    const request = mockRequest('/public_api/v1/usage');
    const response = await GET({ request } as any);

    expect(response.status).toBe(401);
  });

  it('returns usage summary for authenticated user', async () => {
    const { apiGuard } = await import('@lib/services/api-guard.js');
    const { getUsageSummary } = await import('@lib/services/usage-meter.js');

    (apiGuard as any).mockResolvedValue(guardPass({ userId: 'user-123', tier: 'free' }));

    const mockSummary = {
      userId: 'user-123',
      today: 5,
      thisMonth: 42,
      last30Days: [],
      quota: { limit: 500, used: 5, remaining: 495, tier: 'free' },
    };
    (getUsageSummary as any).mockResolvedValue(mockSummary);

    const { GET } = await import('../../src/pages/public_api/v1/usage.js');
    const request = mockRequest('/public_api/v1/usage');
    const response = await GET({ request } as any);

    expect(response.status).toBe(200);
    const body = await parseJson(response);
    expect(body.success).toBe(true);
    expect(body.usage).toEqual(mockSummary);
  });

  it('passes correct userId and tier to getUsageSummary', async () => {
    const { apiGuard } = await import('@lib/services/api-guard.js');
    const { getUsageSummary } = await import('@lib/services/usage-meter.js');

    (apiGuard as any).mockResolvedValue(guardPass({ userId: 'pro-user', tier: 'pro' }));
    (getUsageSummary as any).mockResolvedValue({});

    const { GET } = await import('../../src/pages/public_api/v1/usage.js');
    const request = mockRequest('/public_api/v1/usage');
    await GET({ request } as any);

    expect(getUsageSummary).toHaveBeenCalledWith('pro-user', 'pro');
  });

  it('defaults to free tier when auth.tier is undefined', async () => {
    const { apiGuard } = await import('@lib/services/api-guard.js');
    const { getUsageSummary } = await import('@lib/services/usage-meter.js');

    (apiGuard as any).mockResolvedValue(guardPass({ userId: 'user-x', tier: undefined }));
    (getUsageSummary as any).mockResolvedValue({});

    const { GET } = await import('../../src/pages/public_api/v1/usage.js');
    const request = mockRequest('/public_api/v1/usage');
    await GET({ request } as any);

    expect(getUsageSummary).toHaveBeenCalledWith('user-x', 'free');
  });
});

describe('GET /public_api/v1/supported_sites', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when apiGuard rejects', async () => {
    const { apiGuard } = await import('@lib/services/api-guard.js');
    (apiGuard as any).mockResolvedValue(guardFail(401));

    const { GET } = await import('../../src/pages/public_api/v1/supported_sites.js');
    const request = mockRequest('/public_api/v1/supported_sites');
    const response = await GET({ request } as any);

    expect(response.status).toBe(401);
  });

  it('returns deduplicated list of supported sites', async () => {
    const { apiGuard } = await import('@lib/services/api-guard.js');
    (apiGuard as any).mockResolvedValue(guardPass());

    const { GET } = await import('../../src/pages/public_api/v1/supported_sites.js');
    const request = mockRequest('/public_api/v1/supported_sites');
    const response = await GET({ request } as any);

    expect(response.status).toBe(200);
    const body = await parseJson(response);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.sites)).toBe(true);
    expect(body.sites.length).toBeGreaterThan(0);
  });

  it('each site entry has host and scraper fields', async () => {
    const { apiGuard } = await import('@lib/services/api-guard.js');
    (apiGuard as any).mockResolvedValue(guardPass());

    const { GET } = await import('../../src/pages/public_api/v1/supported_sites.js');
    const request = mockRequest('/public_api/v1/supported_sites');
    const response = await GET({ request } as any);

    const body = await parseJson(response);
    for (const site of body.sites) {
      expect(site).toHaveProperty('host');
      expect(site).toHaveProperty('scraper');
      expect(typeof site.host).toBe('string');
      expect(typeof site.scraper).toBe('string');
    }
  });
});

describe('GET /public_api/v1/export?formats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when apiGuard rejects', async () => {
    const { apiGuard } = await import('@lib/services/api-guard.js');
    (apiGuard as any).mockResolvedValue(guardFail(401));

    const { GET } = await import('../../src/pages/public_api/v1/export.js');
    const request = mockRequest('/public_api/v1/export?formats');
    const response = await GET({
      request,
      url: new URL(request.url),
    } as any);

    expect(response.status).toBe(401);
  });

  it('returns available export formats', async () => {
    const { apiGuard } = await import('@lib/services/api-guard.js');
    (apiGuard as any).mockResolvedValue(guardPass());

    const { GET } = await import('../../src/pages/public_api/v1/export.js');
    const request = mockRequest('/public_api/v1/export?formats');
    const response = await GET({
      request,
      url: new URL(request.url),
    } as any);

    expect(response.status).toBe(200);
    const body = await parseJson(response);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.formats)).toBe(true);
    expect(body.formats.length).toBe(2); // json + csv from mock
  });

  it('format entries include expected metadata fields', async () => {
    const { apiGuard } = await import('@lib/services/api-guard.js');
    (apiGuard as any).mockResolvedValue(guardPass());

    const { GET } = await import('../../src/pages/public_api/v1/export.js');
    const request = mockRequest('/public_api/v1/export?formats');
    const response = await GET({
      request,
      url: new URL(request.url),
    } as any);

    const body = await parseJson(response);
    const jsonFormat = body.formats.find((f: any) => f.format === 'json');
    expect(jsonFormat).toBeDefined();
    expect(jsonFormat.label).toBe('JSON');
    expect(jsonFormat.fileExtension).toBe('.json');
    expect(jsonFormat.mimeType).toBe('application/json');
    expect(jsonFormat.isAvailable).toBe(true);
    expect(jsonFormat.requiresGeoLocation).toBe(false);
  });

  it('returns all formats when ?all=true is set', async () => {
    const { apiGuard } = await import('@lib/services/api-guard.js');
    (apiGuard as any).mockResolvedValue(guardPass());

    const { GET } = await import('../../src/pages/public_api/v1/export.js');
    const request = mockRequest('/public_api/v1/export?formats&all=true');
    const response = await GET({
      request,
      url: new URL(request.url),
    } as any);

    const body = await parseJson(response);
    expect(body.formats.length).toBe(3); // json + csv + geojson from mock
  });

  it('returns 404 when ?formats param is not present', async () => {
    const { apiGuard } = await import('@lib/services/api-guard.js');
    (apiGuard as any).mockResolvedValue(guardPass());

    const { GET } = await import('../../src/pages/public_api/v1/export.js');
    const request = mockRequest('/public_api/v1/export');
    const response = await GET({
      request,
      url: new URL(request.url),
    } as any);

    expect(response.status).toBe(404);
  });
});

describe('POST /public_api/v1/export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when apiGuard rejects', async () => {
    const { apiGuard } = await import('@lib/services/api-guard.js');
    (apiGuard as any).mockResolvedValue(guardFail(401));

    const { POST } = await import('../../src/pages/public_api/v1/export.js');
    const request = mockRequest('/public_api/v1/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format: 'json', listings: [] }),
    });
    const response = await POST({ request } as any);

    expect(response.status).toBe(401);
  });

  it('returns error when format is missing', async () => {
    const { apiGuard } = await import('@lib/services/api-guard.js');
    (apiGuard as any).mockResolvedValue(guardPass());

    const { POST } = await import('../../src/pages/public_api/v1/export.js');
    const request = mockRequest('/public_api/v1/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listings: [{ title: 'Test' }] }),
    });
    const response = await POST({ request } as any);

    expect(response.status).toBe(400);
    const body = await parseJson(response);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INVALID_REQUEST');
  });

  it('returns error for unsupported format', async () => {
    const { apiGuard } = await import('@lib/services/api-guard.js');
    (apiGuard as any).mockResolvedValue(guardPass());

    const { POST } = await import('../../src/pages/public_api/v1/export.js');
    const request = mockRequest('/public_api/v1/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format: 'yaml', listings: [{ title: 'Test' }] }),
    });
    const response = await POST({ request } as any);

    expect(response.status).toBe(400);
    const body = await parseJson(response);
    expect(body.error.message).toContain('Invalid format');
    expect(body.error.message).toContain('yaml');
  });

  it('returns error when neither listings nor listingIds provided', async () => {
    const { apiGuard } = await import('@lib/services/api-guard.js');
    (apiGuard as any).mockResolvedValue(guardPass());

    const { POST } = await import('../../src/pages/public_api/v1/export.js');
    const request = mockRequest('/public_api/v1/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format: 'json' }),
    });
    const response = await POST({ request } as any);

    expect(response.status).toBe(400);
    const body = await parseJson(response);
    expect(body.error.message).toContain('listings array or listingIds array');
  });

  it('returns error when listings array is empty', async () => {
    const { apiGuard } = await import('@lib/services/api-guard.js');
    (apiGuard as any).mockResolvedValue(guardPass());

    const { POST } = await import('../../src/pages/public_api/v1/export.js');
    const request = mockRequest('/public_api/v1/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format: 'json', listings: [] }),
    });
    const response = await POST({ request } as any);

    expect(response.status).toBe(400);
    const body = await parseJson(response);
    expect(body.error.message).toContain('cannot be empty');
  });

  it('returns error when listingIds array is empty', async () => {
    const { apiGuard } = await import('@lib/services/api-guard.js');
    (apiGuard as any).mockResolvedValue(guardPass());

    const { POST } = await import('../../src/pages/public_api/v1/export.js');
    const request = mockRequest('/public_api/v1/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format: 'json', listingIds: [] }),
    });
    const response = await POST({ request } as any);

    expect(response.status).toBe(400);
    const body = await parseJson(response);
    expect(body.error.message).toContain('cannot be empty');
  });

  it('returns error when batch size exceeds 100 listings', async () => {
    const { apiGuard } = await import('@lib/services/api-guard.js');
    (apiGuard as any).mockResolvedValue(guardPass());

    const { POST } = await import('../../src/pages/public_api/v1/export.js');
    const tooManyListings = Array.from({ length: 101 }, (_, i) => ({ title: `Listing ${i}` }));
    const request = mockRequest('/public_api/v1/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format: 'json', listings: tooManyListings }),
    });
    const response = await POST({ request } as any);

    expect(response.status).toBe(400);
    const body = await parseJson(response);
    expect(body.error.message).toContain('Batch size exceeds limit');
  });

  it('returns error when listingIds batch size exceeds 100', async () => {
    const { apiGuard } = await import('@lib/services/api-guard.js');
    (apiGuard as any).mockResolvedValue(guardPass());

    const { POST } = await import('../../src/pages/public_api/v1/export.js');
    const tooManyIds = Array.from({ length: 101 }, (_, i) => `id-${i}`);
    const request = mockRequest('/public_api/v1/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format: 'json', listingIds: tooManyIds }),
    });
    const response = await POST({ request } as any);

    expect(response.status).toBe(400);
    const body = await parseJson(response);
    expect(body.error.message).toContain('Batch size exceeds limit');
  });

  it('exports successfully with inline listings', async () => {
    const { apiGuard } = await import('@lib/services/api-guard.js');
    const { getExportService } = await import('@lib/services/export-service.js');

    (apiGuard as any).mockResolvedValue(guardPass());

    const mockResult = {
      data: '{"listings":[]}',
      mimeType: 'application/json',
      filename: 'export-2025.json',
      listingCount: 1,
      format: 'json',
      timestamp: '2025-01-01T00:00:00Z',
    };
    const mockExport = vi.fn().mockResolvedValue(mockResult);
    (getExportService as any).mockReturnValue({ export: mockExport });

    const { POST } = await import('../../src/pages/public_api/v1/export.js');
    const request = mockRequest('/public_api/v1/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format: 'json', listings: [{ title: 'Test House', price_string: '500000' }] }),
    });
    const response = await POST({ request } as any);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/json');
    expect(response.headers.get('Content-Disposition')).toContain('export-2025.json');
    expect(response.headers.get('X-Export-Format')).toBe('json');
    expect(response.headers.get('X-Listing-Count')).toBe('1');
  });

  it('returns 400 when a listing ID is not found in the store', async () => {
    const { apiGuard } = await import('@lib/services/api-guard.js');
    const { getListing } = await import('@lib/services/listing-store.js');

    (apiGuard as any).mockResolvedValue(guardPass());
    (getListing as any).mockResolvedValue(undefined);

    const { POST } = await import('../../src/pages/public_api/v1/export.js');
    const request = mockRequest('/public_api/v1/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format: 'json', listingIds: ['nonexistent-id'] }),
    });
    const response = await POST({ request } as any);

    expect(response.status).toBe(400);
    const body = await parseJson(response);
    expect(body.error).toContain('Listing not found');
  });
});

describe('POST /public_api/v1/webhooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when apiGuard rejects', async () => {
    const { apiGuard } = await import('@lib/services/api-guard.js');
    (apiGuard as any).mockResolvedValue(guardFail(401));

    const { POST } = await import('../../src/pages/public_api/v1/webhooks.js');
    const request = mockRequest('/public_api/v1/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/hook', events: ['extraction.completed'] }),
    });
    const response = await POST({ request } as any);

    expect(response.status).toBe(401);
  });

  it('returns error when url is missing', async () => {
    const { apiGuard } = await import('@lib/services/api-guard.js');
    (apiGuard as any).mockResolvedValue(guardPass());

    const { POST } = await import('../../src/pages/public_api/v1/webhooks.js');
    const request = mockRequest('/public_api/v1/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: ['extraction.completed'] }),
    });
    const response = await POST({ request } as any);

    expect(response.status).toBe(400);
    const body = await parseJson(response);
    expect(body.error.message).toContain('Missing required field: url');
  });

  it('returns error for invalid webhook URL', async () => {
    const { apiGuard } = await import('@lib/services/api-guard.js');
    (apiGuard as any).mockResolvedValue(guardPass());

    const { POST } = await import('../../src/pages/public_api/v1/webhooks.js');
    const request = mockRequest('/public_api/v1/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'not-a-url', events: ['extraction.completed'] }),
    });
    const response = await POST({ request } as any);

    expect(response.status).toBe(400);
    const body = await parseJson(response);
    expect(body.error.code).toBe('INVALID_URL');
  });

  it('returns error for non-HTTP webhook URL', async () => {
    const { apiGuard } = await import('@lib/services/api-guard.js');
    (apiGuard as any).mockResolvedValue(guardPass());

    const { POST } = await import('../../src/pages/public_api/v1/webhooks.js');
    const request = mockRequest('/public_api/v1/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'ftp://example.com/hook', events: ['extraction.completed'] }),
    });
    const response = await POST({ request } as any);

    expect(response.status).toBe(400);
    const body = await parseJson(response);
    expect(body.error.message).toContain('HTTP or HTTPS');
  });

  it('returns error when events array is missing', async () => {
    const { apiGuard } = await import('@lib/services/api-guard.js');
    (apiGuard as any).mockResolvedValue(guardPass());

    const { POST } = await import('../../src/pages/public_api/v1/webhooks.js');
    const request = mockRequest('/public_api/v1/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/hook' }),
    });
    const response = await POST({ request } as any);

    expect(response.status).toBe(400);
    const body = await parseJson(response);
    expect(body.error.message).toContain('Missing or empty events');
  });

  it('returns error when events array is empty', async () => {
    const { apiGuard } = await import('@lib/services/api-guard.js');
    (apiGuard as any).mockResolvedValue(guardPass());

    const { POST } = await import('../../src/pages/public_api/v1/webhooks.js');
    const request = mockRequest('/public_api/v1/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/hook', events: [] }),
    });
    const response = await POST({ request } as any);

    expect(response.status).toBe(400);
  });

  it('returns error for invalid event types', async () => {
    const { apiGuard } = await import('@lib/services/api-guard.js');
    (apiGuard as any).mockResolvedValue(guardPass());

    const { POST } = await import('../../src/pages/public_api/v1/webhooks.js');
    const request = mockRequest('/public_api/v1/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/hook', events: ['invalid.event'] }),
    });
    const response = await POST({ request } as any);

    expect(response.status).toBe(400);
    const body = await parseJson(response);
    expect(body.error.message).toContain('Invalid events');
    expect(body.error.message).toContain('invalid.event');
  });

  it('returns error for invalid JSON body', async () => {
    const { apiGuard } = await import('@lib/services/api-guard.js');
    (apiGuard as any).mockResolvedValue(guardPass());

    const { POST } = await import('../../src/pages/public_api/v1/webhooks.js');
    const request = mockRequest('/public_api/v1/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not valid json{{{',
    });
    const response = await POST({ request } as any);

    expect(response.status).toBe(400);
    const body = await parseJson(response);
    expect(body.error.message).toContain('Invalid JSON body');
  });

  it('registers webhook successfully and returns 201', async () => {
    const { apiGuard } = await import('@lib/services/api-guard.js');
    const { registerWebhook } = await import('@lib/services/webhook-service.js');

    (apiGuard as any).mockResolvedValue(guardPass());
    (registerWebhook as any).mockResolvedValue({
      id: 'wh_abc123',
      url: 'https://example.com/hook',
      events: ['extraction.completed'],
      active: true,
      createdAt: '2025-01-01T00:00:00Z',
      secret: 'my-secret',
    });

    const { POST } = await import('../../src/pages/public_api/v1/webhooks.js');
    const request = mockRequest('/public_api/v1/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://example.com/hook',
        events: ['extraction.completed'],
        secret: 'my-secret',
      }),
    });
    const response = await POST({ request } as any);

    expect(response.status).toBe(201);
    const body = await parseJson(response);
    expect(body.success).toBe(true);
    expect(body.webhook.id).toBe('wh_abc123');
    expect(body.webhook.url).toBe('https://example.com/hook');
    expect(body.webhook.has_secret).toBe(true);
  });

  it('does not expose the webhook secret in the response', async () => {
    const { apiGuard } = await import('@lib/services/api-guard.js');
    const { registerWebhook } = await import('@lib/services/webhook-service.js');

    (apiGuard as any).mockResolvedValue(guardPass());
    (registerWebhook as any).mockResolvedValue({
      id: 'wh_abc123',
      url: 'https://example.com/hook',
      events: ['extraction.completed'],
      active: true,
      createdAt: '2025-01-01T00:00:00Z',
      secret: 'super-secret-value',
    });

    const { POST } = await import('../../src/pages/public_api/v1/webhooks.js');
    const request = mockRequest('/public_api/v1/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://example.com/hook',
        events: ['extraction.completed'],
        secret: 'super-secret-value',
      }),
    });
    const response = await POST({ request } as any);

    const body = await parseJson(response);
    expect(body.webhook.secret).toBeUndefined();
    expect(body.webhook.has_secret).toBe(true);
  });

  it('has_secret is false when no secret provided', async () => {
    const { apiGuard } = await import('@lib/services/api-guard.js');
    const { registerWebhook } = await import('@lib/services/webhook-service.js');

    (apiGuard as any).mockResolvedValue(guardPass());
    (registerWebhook as any).mockResolvedValue({
      id: 'wh_abc123',
      url: 'https://example.com/hook',
      events: ['extraction.completed'],
      active: true,
      createdAt: '2025-01-01T00:00:00Z',
    });

    const { POST } = await import('../../src/pages/public_api/v1/webhooks.js');
    const request = mockRequest('/public_api/v1/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://example.com/hook',
        events: ['extraction.completed'],
      }),
    });
    const response = await POST({ request } as any);

    const body = await parseJson(response);
    expect(body.webhook.has_secret).toBe(false);
  });
});

describe('GET /public_api/v1/webhooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when apiGuard rejects', async () => {
    const { apiGuard } = await import('@lib/services/api-guard.js');
    (apiGuard as any).mockResolvedValue(guardFail(401));

    const { GET } = await import('../../src/pages/public_api/v1/webhooks.js');
    const request = mockRequest('/public_api/v1/webhooks');
    const response = await GET({ request } as any);

    expect(response.status).toBe(401);
  });

  it('returns list of webhooks without secrets', async () => {
    const { apiGuard } = await import('@lib/services/api-guard.js');
    const { listWebhooks } = await import('@lib/services/webhook-service.js');

    (apiGuard as any).mockResolvedValue(guardPass());
    (listWebhooks as any).mockResolvedValue([
      {
        id: 'wh_1',
        url: 'https://a.com/hook',
        events: ['extraction.completed'],
        active: true,
        createdAt: '2025-01-01T00:00:00Z',
        secret: 'secret-1',
      },
      {
        id: 'wh_2',
        url: 'https://b.com/hook',
        events: ['extraction.failed'],
        active: true,
        createdAt: '2025-01-02T00:00:00Z',
      },
    ]);

    const { GET } = await import('../../src/pages/public_api/v1/webhooks.js');
    const request = mockRequest('/public_api/v1/webhooks');
    const response = await GET({ request } as any);

    expect(response.status).toBe(200);
    const body = await parseJson(response);
    expect(body.success).toBe(true);
    expect(body.webhooks).toHaveLength(2);

    // Secrets should be stripped
    expect(body.webhooks[0].secret).toBeUndefined();
    expect(body.webhooks[0].has_secret).toBe(true);
    expect(body.webhooks[1].secret).toBeUndefined();
    expect(body.webhooks[1].has_secret).toBe(false);
  });

  it('returns empty array when no webhooks registered', async () => {
    const { apiGuard } = await import('@lib/services/api-guard.js');
    const { listWebhooks } = await import('@lib/services/webhook-service.js');

    (apiGuard as any).mockResolvedValue(guardPass());
    (listWebhooks as any).mockResolvedValue([]);

    const { GET } = await import('../../src/pages/public_api/v1/webhooks.js');
    const request = mockRequest('/public_api/v1/webhooks');
    const response = await GET({ request } as any);

    const body = await parseJson(response);
    expect(body.webhooks).toEqual([]);
  });
});

describe('DELETE /public_api/v1/webhooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when apiGuard rejects', async () => {
    const { apiGuard } = await import('@lib/services/api-guard.js');
    (apiGuard as any).mockResolvedValue(guardFail(401));

    const { DELETE } = await import('../../src/pages/public_api/v1/webhooks.js');
    const request = mockRequest('/public_api/v1/webhooks?id=wh_123', { method: 'DELETE' });
    const response = await DELETE({ request } as any);

    expect(response.status).toBe(401);
  });

  it('returns error when id query parameter is missing', async () => {
    const { apiGuard } = await import('@lib/services/api-guard.js');
    (apiGuard as any).mockResolvedValue(guardPass());

    const { DELETE } = await import('../../src/pages/public_api/v1/webhooks.js');
    const request = mockRequest('/public_api/v1/webhooks', { method: 'DELETE' });
    const response = await DELETE({ request } as any);

    expect(response.status).toBe(400);
    const body = await parseJson(response);
    expect(body.error.message).toContain('Missing query parameter: id');
  });

  it('returns 404 when webhook is not found', async () => {
    const { apiGuard } = await import('@lib/services/api-guard.js');
    const { removeWebhook } = await import('@lib/services/webhook-service.js');

    (apiGuard as any).mockResolvedValue(guardPass());
    (removeWebhook as any).mockResolvedValue(false);

    const { DELETE } = await import('../../src/pages/public_api/v1/webhooks.js');
    const request = mockRequest('/public_api/v1/webhooks?id=wh_nonexistent', { method: 'DELETE' });
    const response = await DELETE({ request } as any);

    expect(response.status).toBe(404);
    const body = await parseJson(response);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('removes webhook successfully', async () => {
    const { apiGuard } = await import('@lib/services/api-guard.js');
    const { removeWebhook } = await import('@lib/services/webhook-service.js');

    (apiGuard as any).mockResolvedValue(guardPass());
    (removeWebhook as any).mockResolvedValue(true);

    const { DELETE } = await import('../../src/pages/public_api/v1/webhooks.js');
    const request = mockRequest('/public_api/v1/webhooks?id=wh_abc123', { method: 'DELETE' });
    const response = await DELETE({ request } as any);

    expect(response.status).toBe(200);
    const body = await parseJson(response);
    expect(body.success).toBe(true);
    expect(body.removed).toBe(true);
    expect(body.id).toBe('wh_abc123');
  });

  it('passes correct id to removeWebhook service', async () => {
    const { apiGuard } = await import('@lib/services/api-guard.js');
    const { removeWebhook } = await import('@lib/services/webhook-service.js');

    (apiGuard as any).mockResolvedValue(guardPass());
    (removeWebhook as any).mockResolvedValue(true);

    const { DELETE } = await import('../../src/pages/public_api/v1/webhooks.js');
    const request = mockRequest('/public_api/v1/webhooks?id=wh_target', { method: 'DELETE' });
    await DELETE({ request } as any);

    expect(removeWebhook).toHaveBeenCalledWith('wh_target');
  });
});

describe('OPTIONS preflight (CORS)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('usage OPTIONS returns 204 with CORS headers', async () => {
    const { OPTIONS } = await import('../../src/pages/public_api/v1/usage.js');
    const request = mockRequest('/public_api/v1/usage', { method: 'OPTIONS' });
    const response = await OPTIONS({ request } as any);

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('X-Api-Key');
  });

  it('webhooks OPTIONS returns 204 with CORS headers', async () => {
    const { OPTIONS } = await import('../../src/pages/public_api/v1/webhooks.js');
    const request = mockRequest('/public_api/v1/webhooks', { method: 'OPTIONS' });
    const response = await OPTIONS({ request } as any);

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });

  it('export OPTIONS returns 204 with CORS headers', async () => {
    const { OPTIONS } = await import('../../src/pages/public_api/v1/export.js');
    const request = mockRequest('/public_api/v1/export', { method: 'OPTIONS' });
    const response = await OPTIONS({ request } as any);

    expect(response.status).toBe(204);
  });

  it('supported_sites OPTIONS returns 204 with CORS headers', async () => {
    const { OPTIONS } = await import('../../src/pages/public_api/v1/supported_sites.js');
    const request = mockRequest('/public_api/v1/supported_sites', { method: 'OPTIONS' });
    const response = await OPTIONS({ request } as any);

    expect(response.status).toBe(204);
  });
});
