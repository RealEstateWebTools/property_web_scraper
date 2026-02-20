import { describe, it, expect, beforeEach } from 'vitest';
import {
  createHaul,
  addScrapeToHaul,
  getHaul,
  findExistingScrapeByUrl,
} from '../../src/lib/services/haul-store.js';
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

describe('duplicate scrape detection', () => {
  let haulId: string;

  beforeEach(async () => {
    haulId = `test-dup-${Date.now()}`;
    await createHaul(haulId, '127.0.0.1');
  });

  describe('findExistingScrapeByUrl', () => {
    it('returns undefined when the haul has no scrapes', async () => {
      const existing = await findExistingScrapeByUrl(haulId, 'https://www.rightmove.co.uk/properties/123');
      expect(existing).toBeUndefined();
    });

    it('returns undefined when the URL is not in the haul', async () => {
      await addScrapeToHaul(haulId, makeScrape({
        resultId: 'r1',
        url: 'https://www.rightmove.co.uk/properties/456',
      }));

      const existing = await findExistingScrapeByUrl(haulId, 'https://www.rightmove.co.uk/properties/123');
      expect(existing).toBeUndefined();
    });

    it('returns the existing scrape when the exact URL is already in the haul', async () => {
      const scrape = makeScrape({ resultId: 'r1', title: 'Nice Flat' });
      await addScrapeToHaul(haulId, scrape);

      const existing = await findExistingScrapeByUrl(haulId, 'https://www.rightmove.co.uk/properties/123');
      expect(existing).toBeDefined();
      expect(existing!.resultId).toBe('r1');
      expect(existing!.title).toBe('Nice Flat');
    });

    it('matches URLs ignoring query params (canonical matching)', async () => {
      const scrape = makeScrape({
        resultId: 'r1',
        url: 'https://www.rightmove.co.uk/properties/123',
      });
      await addScrapeToHaul(haulId, scrape);

      const existing = await findExistingScrapeByUrl(
        haulId,
        'https://www.rightmove.co.uk/properties/123?utm_source=google&channel=search',
      );
      expect(existing).toBeDefined();
      expect(existing!.resultId).toBe('r1');
    });

    it('matches URLs ignoring protocol differences', async () => {
      const scrape = makeScrape({
        resultId: 'r1',
        url: 'https://www.rightmove.co.uk/properties/123',
      });
      await addScrapeToHaul(haulId, scrape);

      const existing = await findExistingScrapeByUrl(
        haulId,
        'http://www.rightmove.co.uk/properties/123',
      );
      expect(existing).toBeDefined();
      expect(existing!.resultId).toBe('r1');
    });

    it('does not match different properties on the same host', async () => {
      const scrape = makeScrape({
        resultId: 'r1',
        url: 'https://www.rightmove.co.uk/properties/123',
      });
      await addScrapeToHaul(haulId, scrape);

      const existing = await findExistingScrapeByUrl(
        haulId,
        'https://www.rightmove.co.uk/properties/999',
      );
      expect(existing).toBeUndefined();
    });

    it('throws when haul does not exist', async () => {
      await expect(
        findExistingScrapeByUrl('nonexistent-haul-id', 'https://example.com'),
      ).rejects.toThrow('Haul not found');
    });
  });

  describe('scrape endpoint behavior: first scrape succeeds', () => {
    it('adds the first scrape to the haul successfully', async () => {
      const scrape = makeScrape({ resultId: 'r1' });
      const { added, replaced } = await addScrapeToHaul(haulId, scrape);

      expect(added).toBe(true);
      expect(replaced).toBe(false);

      const haul = await getHaul(haulId);
      expect(haul!.scrapes).toHaveLength(1);
      expect(haul!.scrapes[0].resultId).toBe('r1');
    });

    it('allows scraping different properties into the same haul', async () => {
      await addScrapeToHaul(haulId, makeScrape({
        resultId: 'r1',
        url: 'https://www.rightmove.co.uk/properties/111',
      }));
      await addScrapeToHaul(haulId, makeScrape({
        resultId: 'r2',
        url: 'https://www.rightmove.co.uk/properties/222',
      }));
      await addScrapeToHaul(haulId, makeScrape({
        resultId: 'r3',
        url: 'https://www.zoopla.co.uk/property/333',
      }));

      const haul = await getHaul(haulId);
      expect(haul!.scrapes).toHaveLength(3);
    });
  });

  describe('scrape endpoint behavior: duplicate detection pre-check', () => {
    it('detects a duplicate before extraction runs', async () => {
      // First scrape succeeds
      await addScrapeToHaul(haulId, makeScrape({
        resultId: 'r1',
        url: 'https://www.rightmove.co.uk/properties/123',
        title: 'Original Scrape',
      }));

      // Before attempting a second scrape of the same URL,
      // the endpoint should check for duplicates
      const existing = await findExistingScrapeByUrl(
        haulId,
        'https://www.rightmove.co.uk/properties/123',
      );

      // Duplicate detected — the endpoint should return info
      // about the existing scrape instead of re-extracting
      expect(existing).toBeDefined();
      expect(existing!.resultId).toBe('r1');
      expect(existing!.title).toBe('Original Scrape');
    });

    it('provides enough info to redirect to the existing scrape', async () => {
      await addScrapeToHaul(haulId, makeScrape({
        resultId: 'abc123',
        url: 'https://www.rightmove.co.uk/properties/123',
        title: 'A Nice House',
        grade: 'B',
        price: '350,000',
      }));

      const existing = await findExistingScrapeByUrl(
        haulId,
        'https://www.rightmove.co.uk/properties/123',
      );

      expect(existing).toBeDefined();
      // The existing scrape should have all the info needed
      // to build a redirect response
      expect(existing!.resultId).toBe('abc123');
      expect(existing!.url).toBe('https://www.rightmove.co.uk/properties/123');
      expect(existing!.title).toBe('A Nice House');
      expect(existing!.grade).toBe('B');
      expect(existing!.price).toBe('350,000');
    });

    it('does not block scraping a new property after a duplicate is detected', async () => {
      await addScrapeToHaul(haulId, makeScrape({
        resultId: 'r1',
        url: 'https://www.rightmove.co.uk/properties/123',
      }));

      // Duplicate detected for same URL
      const dup = await findExistingScrapeByUrl(
        haulId,
        'https://www.rightmove.co.uk/properties/123',
      );
      expect(dup).toBeDefined();

      // But a different URL should still be allowed
      const noDup = await findExistingScrapeByUrl(
        haulId,
        'https://www.rightmove.co.uk/properties/456',
      );
      expect(noDup).toBeUndefined();

      // And adding it should work
      const { added } = await addScrapeToHaul(haulId, makeScrape({
        resultId: 'r2',
        url: 'https://www.rightmove.co.uk/properties/456',
      }));
      expect(added).toBe(true);
    });
  });
});
