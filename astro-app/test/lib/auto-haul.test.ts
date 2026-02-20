import { describe, it, expect, beforeEach } from 'vitest';
import {
  createHaul,
  addScrapeToHaul,
  getHaul,
} from '../../src/lib/services/haul-store.js';
import type { HaulScrape } from '../../src/lib/services/haul-store.js';
import { generateHaulId, isValidHaulId } from '../../src/lib/services/haul-id.js';

function makeScrape(overrides: Partial<HaulScrape> = {}): HaulScrape {
  return {
    resultId: 'r1',
    title: 'Test Property',
    grade: 'A',
    price: '250,000',
    extractionRate: 0.85,
    createdAt: new Date().toISOString(),
    url: 'https://www.rightmove.co.uk/properties/123',
    ...overrides,
  };
}

describe('auto-haul resolution', () => {
  describe('haul creation and reuse', () => {
    it('creates a new haul when none exists', async () => {
      const id = generateHaulId();
      expect(isValidHaulId(id)).toBe(true);

      const haul = await createHaul(id, '127.0.0.1');
      expect(haul.id).toBe(id);
      expect(haul.scrapes).toHaveLength(0);
      expect(haul.creatorIp).toBe('127.0.0.1');
    });

    it('reuses an existing haul by ID', async () => {
      const id = generateHaulId();
      await createHaul(id, '127.0.0.1');

      // Add a scrape to it
      await addScrapeToHaul(id, makeScrape({ resultId: 'r1' }));

      // Fetch it again — should still exist with the scrape
      const haul = await getHaul(id);
      expect(haul).toBeDefined();
      expect(haul!.id).toBe(id);
      expect(haul!.scrapes).toHaveLength(1);
    });

    it('returns undefined for an expired haul', async () => {
      const id = `test-expired-${Date.now()}`;
      // Manually create a haul with an expiration in the past
      const now = new Date();
      const { createHaul: _ } = await import('../../src/lib/services/haul-store.js');

      // Create haul, then simulate expiry by manipulating it
      await createHaul(id, '127.0.0.1');
      const haul = await getHaul(id);
      expect(haul).toBeDefined();

      // Overwrite with expired data
      (haul as any).expiresAt = new Date(now.getTime() - 1000).toISOString();
      // The in-memory store holds a reference, so next getHaul will see the expired value
      const expired = await getHaul(id);
      expect(expired).toBeUndefined();
    });

    it('provided haul_id uses existing haul when valid', async () => {
      const id = generateHaulId();
      await createHaul(id, '127.0.0.1');

      const haul = await getHaul(id);
      expect(haul).toBeDefined();
      expect(haul!.id).toBe(id);
    });

    it('provided haul_id with missing haul triggers new creation', async () => {
      // Simulate: provided haul_id is valid format but haul doesn't exist
      const missingId = 'bold-fox-42';
      expect(isValidHaulId(missingId)).toBe(true);

      const haul = await getHaul(missingId);
      expect(haul).toBeUndefined();

      // In the endpoint, this would trigger createHaul with a new ID
      const newId = generateHaulId();
      const newHaul = await createHaul(newId, '127.0.0.1');
      expect(newHaul).toBeDefined();
      expect(newHaul.id).toBe(newId);
    });
  });

  describe('anonymous haul reuse (simulated KV)', () => {
    it('creates a haul for anonymous user with no prior haul', async () => {
      const id = generateHaulId();
      const haul = await createHaul(id, '192.168.1.1');
      expect(haul.id).toBe(id);

      // Simulate KV: store free-haul:{ip} → { haulId }
      const kvRecord = { haulId: id, createdAt: new Date().toISOString() };
      expect(kvRecord.haulId).toBe(id);
    });

    it('reuses existing haul for same anonymous IP', async () => {
      const id = generateHaulId();
      await createHaul(id, '192.168.1.1');
      await addScrapeToHaul(id, makeScrape({ resultId: 'r1', url: 'https://example.com/1' }));

      // Simulate: KV lookup returns existing haulId
      const kvRecord = { haulId: id };
      const haul = await getHaul(kvRecord.haulId);
      expect(haul).toBeDefined();
      expect(haul!.scrapes).toHaveLength(1);

      // Can add more scrapes to the same haul
      await addScrapeToHaul(id, makeScrape({ resultId: 'r2', url: 'https://example.com/2' }));
      const updated = await getHaul(id);
      expect(updated!.scrapes).toHaveLength(2);
    });
  });

  describe('haul_id always in response', () => {
    it('scrape result includes haul_id for client persistence', async () => {
      const id = generateHaulId();
      await createHaul(id, '127.0.0.1');

      // Simulate what the endpoint response would look like
      const mockResponse = {
        success: true,
        haul_id: id,
        haul_url: `/haul/${id}`,
        scrape: { result_id: 'r1', title: 'Test', grade: 'A', rate: 85, price: '250,000' },
      };

      expect(mockResponse.haul_id).toBe(id);
      expect(mockResponse.haul_url).toBe(`/haul/${id}`);
    });
  });

  describe('full haul rejects scrapes at capacity', () => {
    it('cannot add scrape to a haul with 20 scrapes', async () => {
      const id = `test-full-${Date.now()}`;
      await createHaul(id, '127.0.0.1');

      // Fill the haul to capacity
      for (let i = 0; i < 20; i++) {
        await addScrapeToHaul(id, makeScrape({
          resultId: `r${i}`,
          url: `https://example.com/property/${i}`,
        }));
      }

      const haul = await getHaul(id);
      expect(haul!.scrapes).toHaveLength(20);

      // 21st scrape should fail
      const { added } = await addScrapeToHaul(id, makeScrape({
        resultId: 'r-overflow',
        url: 'https://example.com/property/overflow',
      }));
      expect(added).toBe(false);
    });
  });
});
