import { test, expect } from '@playwright/test';

test.describe('/retriever/as_json API', () => {
  test('GET without url returns success: false', async ({ request }) => {
    const res = await request.get('/retriever/as_json');
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  test('GET with unsupported URL returns success: false', async ({ request }) => {
    const res = await request.get('/retriever/as_json?url=https://www.unsupported-xyz.com/listing/1');
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  test('GET with supported URL returns success: true with listing', async ({ request }) => {
    const res = await request.get('/retriever/as_json?url=https://www.idealista.com/inmueble/12345/');
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.listing).toBeDefined();
    expect(json.listing.import_url).toBe('https://www.idealista.com/inmueble/12345/');
  });
});
