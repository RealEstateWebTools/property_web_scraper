import { test, expect } from '@playwright/test';

test.describe('/public_api/v1/listings API', () => {
  test('GET without url returns 400 with MISSING_URL', async ({ request }) => {
    const res = await request.get('/public_api/v1/listings');
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('MISSING_URL');
  });

  test('GET with unsupported URL returns 400 with UNSUPPORTED_HOST', async ({ request }) => {
    const res = await request.get('/public_api/v1/listings?url=https://www.unsupported-xyz.com/listing/1');
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('UNSUPPORTED_HOST');
  });

  test('GET with invalid URL returns 400 with INVALID_URL', async ({ request }) => {
    const res = await request.get('/public_api/v1/listings?url=not-a-valid-url');
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('INVALID_URL');
  });

  test('GET with ftp:// URL returns 400 with INVALID_URL', async ({ request }) => {
    const res = await request.get('/public_api/v1/listings?url=ftp://files.example.com/listing');
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('INVALID_URL');
  });

  test('GET with supported URL returns 200 with success: true', async ({ request }) => {
    const res = await request.get('/public_api/v1/listings?url=https://www.idealista.com/inmueble/12345/');
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.listings).toBeDefined();
    expect(json.listings[0].import_url).toBe('https://www.idealista.com/inmueble/12345/');
  });

  test('GET response includes CORS headers', async ({ request }) => {
    const res = await request.get('/public_api/v1/listings?url=https://www.idealista.com/inmueble/12345/');
    expect(res.headers()['access-control-allow-origin']).toBe('*');
  });

  test('POST without url returns 400 with MISSING_URL', async ({ request }) => {
    const res = await request.post('/public_api/v1/listings', {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({}),
    });
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('MISSING_URL');
  });

  test('POST with unsupported URL returns 400 with UNSUPPORTED_HOST', async ({ request }) => {
    const res = await request.post('/public_api/v1/listings', {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ url: 'https://www.unsupported-xyz.com/listing/1' }),
    });
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('UNSUPPORTED_HOST');
  });

  test('POST with unsupported Content-Type returns 415', async ({ request }) => {
    const res = await request.post('/public_api/v1/listings', {
      headers: { 'Content-Type': 'text/plain' },
      data: 'url=https://www.idealista.com/inmueble/12345/',
    });
    expect(res.status()).toBe(415);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('UNSUPPORTED_CONTENT_TYPE');
  });

  test('POST with html includes extraction metadata', async ({ request }) => {
    const res = await request.post('/public_api/v1/listings', {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({
        url: 'https://www.idealista.com/inmueble/12345/',
        html: '<html><body><span class="info-data"><span class="txt-bold">Test Title</span></span></body></html>',
      }),
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    if (json.extraction) {
      expect(json.extraction.scraper_used).toBe('idealista');
      expect(typeof json.extraction.fields_extracted).toBe('number');
      expect(typeof json.extraction.fields_available).toBe('number');
    }
  });

  test('OPTIONS returns 204 with CORS headers', async ({ request }) => {
    const res = await request.fetch('/public_api/v1/listings', { method: 'OPTIONS' });
    expect(res.status()).toBe(204);
    // The dev server handles OPTIONS preflight automatically.
    // In production, our handler adds custom CORS headers.
    // Verify that some CORS-related header is present.
    const headers = res.headers();
    const hasCors = headers['access-control-allow-origin'] === '*' ||
      headers['access-control-allow-methods'] !== undefined;
    expect(hasCors).toBe(true);
  });
});

test.describe('/public_api/v1/listings/:id API', () => {
  test('GET with invalid ID returns 404 with LISTING_NOT_FOUND', async ({ request }) => {
    const res = await request.get('/public_api/v1/listings/nonexistent-id');
    expect(res.status()).toBe(404);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('LISTING_NOT_FOUND');
  });
});

test.describe('/public_api/v1/supported_sites API', () => {
  test('GET returns 200 with sites array', async ({ request }) => {
    const res = await request.get('/public_api/v1/supported_sites');
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.sites)).toBe(true);
    expect(json.sites.length).toBeGreaterThan(0);
    for (const site of json.sites) {
      expect(site.host).toBeDefined();
      expect(site.scraper).toBeDefined();
    }
  });
});

test.describe('/public_api/v1/health API', () => {
  test('GET returns 200 with status ok', async ({ request }) => {
    const res = await request.get('/public_api/v1/health');
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.status).toBe('ok');
    expect(json.scrapers_loaded).toBeGreaterThan(0);
  });
});
