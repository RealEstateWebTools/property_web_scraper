import { describe, it, expect, beforeEach } from 'vitest';
import { createHaul, addScrapeToHaul, getHaul } from '../../src/lib/services/haul-store.js';
import type { HaulScrape } from '../../src/lib/services/haul-store.js';

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

describe('haul-store', () => {
  let haulId: string;

  beforeEach(async () => {
    haulId = `test-${Date.now()}`;
    await createHaul(haulId, '127.0.0.1');
  });

  describe('addScrapeToHaul', () => {
    it('appends a scrape to the haul', async () => {
      const scrape = makeScrape();
      const { haul, added, replaced } = await addScrapeToHaul(haulId, scrape);

      expect(added).toBe(true);
      expect(replaced).toBe(false);
      expect(haul.scrapes).toHaveLength(1);
      expect(haul.scrapes[0].title).toBe('Test Property');
    });

    it('replaces an existing scrape with the same URL', async () => {
      const scrape1 = makeScrape({ resultId: 'r1', title: 'First Scrape', grade: 'C' });
      await addScrapeToHaul(haulId, scrape1);

      const scrape2 = makeScrape({ resultId: 'r2', title: 'Updated Scrape', grade: 'A' });
      const { haul, added, replaced } = await addScrapeToHaul(haulId, scrape2);

      expect(added).toBe(true);
      expect(replaced).toBe(true);
      expect(haul.scrapes).toHaveLength(1);
      expect(haul.scrapes[0].resultId).toBe('r2');
      expect(haul.scrapes[0].title).toBe('Updated Scrape');
      expect(haul.scrapes[0].grade).toBe('A');
    });

    it('replaces based on canonical URL (ignores query params)', async () => {
      const scrape1 = makeScrape({
        resultId: 'r1',
        url: 'https://www.rightmove.co.uk/properties/123',
      });
      await addScrapeToHaul(haulId, scrape1);

      const scrape2 = makeScrape({
        resultId: 'r2',
        url: 'https://www.rightmove.co.uk/properties/123?utm_source=google',
        title: 'Updated',
      });
      const { haul, replaced } = await addScrapeToHaul(haulId, scrape2);

      expect(replaced).toBe(true);
      expect(haul.scrapes).toHaveLength(1);
      expect(haul.scrapes[0].resultId).toBe('r2');
    });

    it('appends scrapes with different URLs', async () => {
      const scrape1 = makeScrape({
        resultId: 'r1',
        url: 'https://www.rightmove.co.uk/properties/123',
      });
      const scrape2 = makeScrape({
        resultId: 'r2',
        url: 'https://www.rightmove.co.uk/properties/456',
      });

      await addScrapeToHaul(haulId, scrape1);
      const { haul, added, replaced } = await addScrapeToHaul(haulId, scrape2);

      expect(added).toBe(true);
      expect(replaced).toBe(false);
      expect(haul.scrapes).toHaveLength(2);
    });

    it('preserves position when replacing', async () => {
      const scrape1 = makeScrape({ resultId: 'r1', url: 'https://a.com/1' });
      const scrape2 = makeScrape({ resultId: 'r2', url: 'https://b.com/2' });
      const scrape3 = makeScrape({ resultId: 'r3', url: 'https://c.com/3' });

      await addScrapeToHaul(haulId, scrape1);
      await addScrapeToHaul(haulId, scrape2);
      await addScrapeToHaul(haulId, scrape3);

      const updated = makeScrape({ resultId: 'r2-updated', url: 'https://b.com/2', title: 'Updated' });
      const { haul, replaced } = await addScrapeToHaul(haulId, updated);

      expect(replaced).toBe(true);
      expect(haul.scrapes).toHaveLength(3);
      expect(haul.scrapes[1].resultId).toBe('r2-updated');
      expect(haul.scrapes[0].resultId).toBe('r1');
      expect(haul.scrapes[2].resultId).toBe('r3');
    });
  });
});
