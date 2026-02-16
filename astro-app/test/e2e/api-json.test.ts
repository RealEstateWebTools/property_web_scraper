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
