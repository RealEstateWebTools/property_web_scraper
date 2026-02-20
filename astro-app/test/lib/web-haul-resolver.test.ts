import { describe, it, expect } from 'vitest';
import { resolveWebHaul, setHaulCookie } from '../../src/lib/services/web-haul-resolver.js';
import { createHaul, getHaul, addScrapeToHaul } from '../../src/lib/services/haul-store.js';
import type { HaulScrape } from '../../src/lib/services/haul-store.js';

function makeRequest(cookie?: string): Request {
  const headers: Record<string, string> = {};
  if (cookie) headers['cookie'] = cookie;
  return new Request('http://localhost/extract/url', { headers });
}

function makeScrape(overrides: Partial<HaulScrape> = {}): HaulScrape {
  return {
    resultId: `r-${Date.now()}-${Math.random()}`,
    title: 'Test',
    grade: 'A',
    price: '100,000',
    extractionRate: 0.8,
    createdAt: new Date().toISOString(),
    url: `https://www.rightmove.co.uk/properties/${Date.now()}`,
    ...overrides,
  };
}

describe('web-haul-resolver', () => {
  describe('resolveWebHaul', () => {
    it('creates a new haul when no cookie is present', async () => {
      const haulId = await resolveWebHaul(makeRequest());
      expect(haulId).toMatch(/^[a-z]+-[a-z]+-\d{2,3}$/);

      const haul = await getHaul(haulId);
      expect(haul).toBeDefined();
      expect(haul!.scrapes).toHaveLength(0);
    });

    it('reuses haul from cookie when valid and not full', async () => {
      const existingId = `test-reuse-${Date.now()}`;
      await createHaul(existingId, '127.0.0.1');

      const haulId = await resolveWebHaul(makeRequest(`pws_haul_id=${existingId}`));
      expect(haulId).toBe(existingId);
    });

    it('creates new haul when cookie references expired/missing haul', async () => {
      const haulId = await resolveWebHaul(makeRequest('pws_haul_id=nonexistent-haul-99'));
      expect(haulId).not.toBe('nonexistent-haul-99');
      expect(haulId).toMatch(/^[a-z]+-[a-z]+-\d{2,3}$/);
    });

    it('creates new haul when cookie haul is full (20 scrapes)', async () => {
      const fullId = `test-full-${Date.now()}`;
      await createHaul(fullId, '127.0.0.1');

      // Fill to capacity
      for (let i = 0; i < 20; i++) {
        await addScrapeToHaul(fullId, makeScrape({
          resultId: `r-${i}`,
          url: `https://www.rightmove.co.uk/properties/${i}`,
        }));
      }

      const haul = await getHaul(fullId);
      expect(haul!.scrapes).toHaveLength(20);

      const haulId = await resolveWebHaul(makeRequest(`pws_haul_id=${fullId}`));
      expect(haulId).not.toBe(fullId);
      expect(haulId).toMatch(/^[a-z]+-[a-z]+-\d{2,3}$/);
    });
  });

  describe('setHaulCookie', () => {
    it('returns a proper Set-Cookie header value', () => {
      const cookie = setHaulCookie('swift-fox-42');
      expect(cookie).toContain('pws_haul_id=swift-fox-42');
      expect(cookie).toContain('Path=/');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain('Max-Age=');
    });

    it('sets a 30-day max age', () => {
      const cookie = setHaulCookie('test-id-99');
      const match = cookie.match(/Max-Age=(\d+)/);
      expect(match).toBeTruthy();
      expect(Number(match![1])).toBe(30 * 24 * 60 * 60);
    });
  });
});
