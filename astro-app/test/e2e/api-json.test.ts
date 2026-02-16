import { test, expect } from '@playwright/test';

test.describe('/public_api/v1/listings API', () => {
  test('GET without url returns success: false', async ({ request }) => {
    const res = await request.get('/public_api/v1/listings');
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  test('GET with unsupported URL returns success: false', async ({ request }) => {
    const res = await request.get('/public_api/v1/listings?url=https://www.unsupported-xyz.com/listing/1');
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  test('GET with supported URL returns success: true with listing', async ({ request }) => {
    const res = await request.get('/public_api/v1/listings?url=https://www.idealista.com/inmueble/12345/');
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.listings).toBeDefined();
    expect(json.listings[0].import_url).toBe('https://www.idealista.com/inmueble/12345/');
  });
});

test.describe('/public_api/v1/listings/:id API', () => {
  test('GET with invalid ID returns 404', async ({ request }) => {
    const res = await request.get('/public_api/v1/listings/nonexistent-id');
    expect(res.status()).toBe(404);
    const json = await res.json();
    expect(json.success).toBe(false);
  });
});
