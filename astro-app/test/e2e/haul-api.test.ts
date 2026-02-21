import { test, expect } from '@playwright/test';
import { loadFixture } from './helpers';

// Each test uses a unique IP via x-forwarded-for to avoid the per-IP free-haul limit.
// Uses random octets to prevent collisions across parallel workers.
function uniqueIp(): string {
  const a = Math.floor(Math.random() * 254) + 1;
  const b = Math.floor(Math.random() * 254) + 1;
  const c = Math.floor(Math.random() * 254) + 1;
  return `10.${a}.${b}.${c}`;
}

/** Create a haul with a unique IP. Returns the haul_id. */
async function createHaul(request: any): Promise<string> {
  const res = await request.post('/ext/v1/hauls', {
    headers: { 'x-forwarded-for': uniqueIp() },
  });
  expect(res.status()).toBe(201);
  const json = await res.json();
  return json.haul_id;
}

test.describe('POST /ext/v1/hauls — Create haul', () => {
  test('creates a haul and returns 201 with haul_id', async ({ request }) => {
    const res = await request.post('/ext/v1/hauls', {
      headers: { 'x-forwarded-for': uniqueIp() },
    });
    expect(res.status()).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.haul_id).toBeTruthy();
    expect(json.haul_url).toContain('/haul/');
  });

  test('OPTIONS returns 204 with CORS headers', async ({ request }) => {
    const res = await request.fetch('/ext/v1/hauls', { method: 'OPTIONS' });
    expect(res.status()).toBe(204);
  });
});

test.describe('GET /ext/v1/hauls/:id — Retrieve haul', () => {
  test('returns haul details for valid ID', async ({ request }) => {
    const haulId = await createHaul(request);

    const res = await request.get(`/ext/v1/hauls/${haulId}`);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.haul_id).toBe(haulId);
    expect(json.scrape_count).toBe(0);
    expect(json.scrape_capacity).toBe(20);
    expect(json.scrapes).toEqual([]);
    expect(json.name).toBeNull();
    expect(json.notes).toBeNull();
    expect(json.created_at).toBeTruthy();
    expect(json.expires_at).toBeTruthy();
  });

  test('returns 400 for invalid haul ID format', async ({ request }) => {
    const res = await request.get('/ext/v1/hauls/!!!invalid');
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('INVALID_REQUEST');
  });

  test('returns 404 for nonexistent haul', async ({ request }) => {
    const res = await request.get('/ext/v1/hauls/fake-haul-99');
    expect(res.status()).toBe(404);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('NOT_FOUND');
  });
});

test.describe('PATCH /ext/v1/hauls/:id — Update haul metadata', () => {
  test('updates name and notes', async ({ request }) => {
    const haulId = await createHaul(request);

    const res = await request.patch(`/ext/v1/hauls/${haulId}`, {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ name: 'My London Search', notes: 'Shortlist for rental' }),
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.name).toBe('My London Search');
    expect(json.notes).toBe('Shortlist for rental');
  });

  test('persists metadata across GET calls', async ({ request }) => {
    const haulId = await createHaul(request);

    await request.patch(`/ext/v1/hauls/${haulId}`, {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ name: 'Persisted Name' }),
    });

    const getRes = await request.get(`/ext/v1/hauls/${haulId}`);
    const json = await getRes.json();
    expect(json.name).toBe('Persisted Name');
  });

  test('returns 415 for wrong Content-Type', async ({ request }) => {
    const haulId = await createHaul(request);

    const res = await request.patch(`/ext/v1/hauls/${haulId}`, {
      headers: { 'Content-Type': 'text/plain' },
      data: 'name=test',
    });
    expect(res.status()).toBe(415);
  });

  test('returns 400 when no fields provided', async ({ request }) => {
    const haulId = await createHaul(request);

    const res = await request.patch(`/ext/v1/hauls/${haulId}`, {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({}),
    });
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('INVALID_REQUEST');
  });

  test('returns 404 for nonexistent haul', async ({ request }) => {
    const res = await request.patch('/ext/v1/hauls/fake-haul-99', {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ name: 'test' }),
    });
    expect(res.status()).toBe(404);
  });
});

test.describe('POST /ext/v1/hauls/:id/scrapes — Add scrape to haul', () => {
  test('adds a scrape to an existing haul', async ({ request }) => {
    const haulId = await createHaul(request);

    const res = await request.post(`/ext/v1/hauls/${haulId}/scrapes`, {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({
        url: 'https://www.rightmove.co.uk/properties/171844895',
        html: loadFixture('rightmove_v2'),
      }),
    });
    expect(res.status()).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);

    // Verify scrape count increased
    const getRes = await request.get(`/ext/v1/hauls/${haulId}`);
    const haul = await getRes.json();
    expect(haul.scrape_count).toBe(1);
    expect(haul.scrapes.length).toBe(1);
  });

  test('returns 404 for nonexistent haul', async ({ request }) => {
    const res = await request.post('/ext/v1/hauls/fake-haul-99/scrapes', {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({
        url: 'https://www.rightmove.co.uk/properties/171844895',
        html: '<html></html>',
      }),
    });
    expect(res.status()).toBe(404);
  });

  test('returns 415 for wrong Content-Type', async ({ request }) => {
    const haulId = await createHaul(request);

    const res = await request.post(`/ext/v1/hauls/${haulId}/scrapes`, {
      headers: { 'Content-Type': 'text/plain' },
      data: 'url=test',
    });
    expect(res.status()).toBe(415);
  });
});

test.describe('DELETE /ext/v1/hauls/:id/scrapes/:resultId — Remove scrape', () => {
  test('removes a scrape from a haul', async ({ request }) => {
    const haulId = await createHaul(request);

    // Add a scrape first
    await request.post(`/ext/v1/hauls/${haulId}/scrapes`, {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({
        url: 'https://www.rightmove.co.uk/properties/171844895',
        html: loadFixture('rightmove_v2'),
      }),
    });

    // Get the scrape's result_id
    const getRes = await request.get(`/ext/v1/hauls/${haulId}`);
    const haul = await getRes.json();
    expect(haul.scrape_count).toBe(1);
    const resultId = haul.scrapes[0].resultId;

    // Delete the scrape
    const delRes = await request.delete(`/ext/v1/hauls/${haulId}/scrapes/${resultId}`);
    expect(delRes.status()).toBe(200);
    const delJson = await delRes.json();
    expect(delJson.success).toBe(true);
    expect(delJson.removed).toBe(true);
    expect(delJson.scrape_count).toBe(0);
  });

  test('returns 404 for nonexistent scrape', async ({ request }) => {
    const haulId = await createHaul(request);

    const res = await request.delete(`/ext/v1/hauls/${haulId}/scrapes/nonexistent-result`);
    expect(res.status()).toBe(404);
  });
});

test.describe('GET /ext/v1/hauls/:id/export — Export haul', () => {
  test('exports haul as JSON', async ({ request }) => {
    const haulId = await createHaul(request);

    await request.post(`/ext/v1/hauls/${haulId}/scrapes`, {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({
        url: 'https://www.rightmove.co.uk/properties/171844895',
        html: loadFixture('rightmove_v2'),
      }),
    });

    const res = await request.get(`/ext/v1/hauls/${haulId}/export?format=json&inline=1`);
    expect(res.status()).toBe(200);
    expect(res.headers()['x-export-format']).toBe('json');
    expect(res.headers()['x-listing-count']).toBe('1');
    expect(res.headers()['content-type']).toContain('application/json');
  });

  test('exports haul as CSV', async ({ request }) => {
    const haulId = await createHaul(request);

    await request.post(`/ext/v1/hauls/${haulId}/scrapes`, {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({
        url: 'https://www.rightmove.co.uk/properties/171844895',
        html: loadFixture('rightmove_v2'),
      }),
    });

    const res = await request.get(`/ext/v1/hauls/${haulId}/export?format=csv`);
    expect(res.status()).toBe(200);
    expect(res.headers()['x-export-format']).toBe('csv');
    expect(res.headers()['content-disposition']).toContain('attachment');
  });

  test('returns 400 for missing format', async ({ request }) => {
    const haulId = await createHaul(request);

    const res = await request.get(`/ext/v1/hauls/${haulId}/export`);
    expect(res.status()).toBe(400);
  });

  test('returns 400 for invalid format', async ({ request }) => {
    const haulId = await createHaul(request);

    const res = await request.get(`/ext/v1/hauls/${haulId}/export?format=xml`);
    expect(res.status()).toBe(400);
  });

  test('returns 400 for empty haul', async ({ request }) => {
    const haulId = await createHaul(request);

    const res = await request.get(`/ext/v1/hauls/${haulId}/export?format=json`);
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.error.message).toContain('no scrapes');
  });

  test('returns 404 for nonexistent haul', async ({ request }) => {
    const res = await request.get('/ext/v1/hauls/fake-haul-99/export?format=json');
    expect(res.status()).toBe(404);
  });
});

test.describe('Haul lifecycle — full CRUD flow', () => {
  test('create haul, add scrapes, update metadata, export, delete scrape', async ({ request }) => {
    // 1. Create haul
    const haulId = await createHaul(request);

    // 2. Add first scrape (rightmove) — use unique URLs to avoid cross-test dedup
    const scrape1Res = await request.post(`/ext/v1/hauls/${haulId}/scrapes`, {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({
        url: 'https://www.rightmove.co.uk/properties/800000001',
        html: loadFixture('rightmove_v2'),
      }),
    });
    // May be 201 (new) or 200 (cross-app duplicate from parallel test)
    expect([200, 201]).toContain(scrape1Res.status());

    // 3. Add second scrape (same fixture, different URL to avoid dedup)
    const scrape2Res = await request.post(`/ext/v1/hauls/${haulId}/scrapes`, {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({
        url: 'https://www.rightmove.co.uk/properties/800000002',
        html: loadFixture('rightmove_v2'),
      }),
    });
    expect([200, 201]).toContain(scrape2Res.status());

    // 4. Verify haul has 2 scrapes
    const getRes = await request.get(`/ext/v1/hauls/${haulId}`);
    const haul = await getRes.json();
    expect(haul.scrape_count).toBe(2);

    // 5. Update metadata
    const patchRes = await request.patch(`/ext/v1/hauls/${haulId}`, {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ name: 'E2E Test Haul', notes: 'Integration test' }),
    });
    expect(patchRes.status()).toBe(200);

    // 6. Export as JSON
    const exportRes = await request.get(`/ext/v1/hauls/${haulId}/export?format=json&inline=1`);
    expect(exportRes.status()).toBe(200);
    expect(exportRes.headers()['x-listing-count']).toBe('2');

    // 7. Delete one scrape
    const resultId = haul.scrapes[0].resultId;
    const delRes = await request.delete(`/ext/v1/hauls/${haulId}/scrapes/${resultId}`);
    expect(delRes.status()).toBe(200);
    expect((await delRes.json()).scrape_count).toBe(1);

    // 8. Verify haul now has 1 scrape and metadata persists
    const finalRes = await request.get(`/ext/v1/hauls/${haulId}`);
    const finalHaul = await finalRes.json();
    expect(finalHaul.scrape_count).toBe(1);
    expect(finalHaul.name).toBe('E2E Test Haul');
    expect(finalHaul.notes).toBe('Integration test');
  });
});
