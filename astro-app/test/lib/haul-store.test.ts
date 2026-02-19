import { describe, it, expect, beforeEach } from 'vitest';
import { createHaul, addScrapeToHaul, getHaul, removeScrapeFromHaul, updateHaulMeta } from '../../src/lib/services/haul-store.js';
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

    it('persists enriched fields through add/get cycle', async () => {
      const scrape = makeScrape({
        price_float: 350000,
        currency: '£',
        count_bedrooms: 3,
        count_bathrooms: 2,
        latitude: 51.5,
        longitude: -0.1,
        city: 'London',
        import_host_slug: 'rightmove',
        for_sale: true,
        features: ['Garden', 'Parking'],
        description: 'A nice property',
      });
      await addScrapeToHaul(haulId, scrape);

      const haul = await getHaul(haulId);
      expect(haul).toBeDefined();
      const s = haul!.scrapes[0];
      expect(s.price_float).toBe(350000);
      expect(s.currency).toBe('£');
      expect(s.count_bedrooms).toBe(3);
      expect(s.count_bathrooms).toBe(2);
      expect(s.latitude).toBe(51.5);
      expect(s.longitude).toBe(-0.1);
      expect(s.city).toBe('London');
      expect(s.import_host_slug).toBe('rightmove');
      expect(s.for_sale).toBe(true);
      expect(s.features).toEqual(['Garden', 'Parking']);
      expect(s.description).toBe('A nice property');
    });
  });

  describe('removeScrapeFromHaul', () => {
    it('removes a scrape by resultId', async () => {
      await addScrapeToHaul(haulId, makeScrape({ resultId: 'r1', url: 'https://a.com/1' }));
      await addScrapeToHaul(haulId, makeScrape({ resultId: 'r2', url: 'https://b.com/2' }));
      await addScrapeToHaul(haulId, makeScrape({ resultId: 'r3', url: 'https://c.com/3' }));

      const { haul, removed } = await removeScrapeFromHaul(haulId, 'r2');

      expect(removed).toBe(true);
      expect(haul.scrapes).toHaveLength(2);
      expect(haul.scrapes[0].resultId).toBe('r1');
      expect(haul.scrapes[1].resultId).toBe('r3');
    });

    it('returns removed=false if resultId not found', async () => {
      await addScrapeToHaul(haulId, makeScrape({ resultId: 'r1' }));

      const { removed } = await removeScrapeFromHaul(haulId, 'nonexistent');

      expect(removed).toBe(false);
    });

    it('throws if haul does not exist', async () => {
      await expect(removeScrapeFromHaul('nonexistent-haul', 'r1')).rejects.toThrow('Haul not found');
    });
  });

  describe('updateHaulMeta', () => {
    it('sets name and notes', async () => {
      const haul = await updateHaulMeta(haulId, { name: 'London Search', notes: 'Looking at 3-beds' });

      expect(haul.name).toBe('London Search');
      expect(haul.notes).toBe('Looking at 3-beds');
    });

    it('truncates name to 100 chars', async () => {
      const longName = 'A'.repeat(200);
      const haul = await updateHaulMeta(haulId, { name: longName });

      expect(haul.name).toBe('A'.repeat(100));
    });

    it('truncates notes to 500 chars', async () => {
      const longNotes = 'B'.repeat(600);
      const haul = await updateHaulMeta(haulId, { notes: longNotes });

      expect(haul.notes).toBe('B'.repeat(500));
    });

    it('clears name when set to empty string', async () => {
      await updateHaulMeta(haulId, { name: 'My Haul' });
      const haul = await updateHaulMeta(haulId, { name: '' });

      expect(haul.name).toBeUndefined();
    });

    it('persists through get cycle', async () => {
      await updateHaulMeta(haulId, { name: 'Persist Test', notes: 'Some notes' });

      const haul = await getHaul(haulId);
      expect(haul?.name).toBe('Persist Test');
      expect(haul?.notes).toBe('Some notes');
    });

    it('throws if haul does not exist', async () => {
      await expect(updateHaulMeta('nonexistent-haul', { name: 'Test' })).rejects.toThrow('Haul not found');
    });

    it('does not affect scrapes', async () => {
      await addScrapeToHaul(haulId, makeScrape());
      await updateHaulMeta(haulId, { name: 'Named Haul' });

      const haul = await getHaul(haulId);
      expect(haul?.scrapes).toHaveLength(1);
      expect(haul?.name).toBe('Named Haul');
    });
  });
});
