/**
 * Tests for the duplicate-listings bug documented in
 * astro-app/docs/duplicate-listings-bug.md
 *
 * Root cause: getRecentExtractions() previously deduped only by Firestore
 * document ID, so multiple documents (or in-memory entries) for the same
 * property URL all appeared as separate rows in /admin/extractions.
 *
 * Fix: URL-level deduplication in getRecentExtractions() using deduplicationKey().
 * Secondary fix: deduplicationKey() strips trailing slashes.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getRecentExtractions } from '../../src/lib/services/extraction-stats.js';
import {
  generateId,
  generateStableId,
  storeListing,
  storeDiagnostics,
  clearListingStore,
} from '../../src/lib/services/listing-store.js';
import { deduplicationKey } from '../../src/lib/services/url-canonicalizer.js';
import { Listing } from '../../src/lib/models/listing.js';
import type { ExtractionDiagnostics } from '../../src/lib/extractor/html-extractor.js';

const URL_A = 'https://www.rightmove.co.uk/properties/168908774';
const URL_A_SLASH = 'https://www.rightmove.co.uk/properties/168908774/';
const URL_B = 'https://www.rightmove.co.uk/properties/172085585';

function makeDiagnostics(overrides: Partial<ExtractionDiagnostics> = {}): ExtractionDiagnostics {
  return {
    scraperName: 'uk_rightmove',
    fieldTraces: [],
    totalFields: 5,
    populatedFields: 3,
    emptyFields: [],
    extractableFields: 5,
    populatedExtractableFields: 3,
    extractionRate: 0.6,
    qualityGrade: 'C',
    qualityLabel: 'Partial',
    meetsExpectation: false,
    ...overrides,
  };
}

async function storeFull(
  id: string,
  importUrl: string,
  title: string,
  timestamp: Date = new Date(),
  diagOverrides: Partial<ExtractionDiagnostics> = {},
): Promise<void> {
  const listing = new Listing();
  listing.assignAttributes({
    title,
    import_url: importUrl,
    scraper_name: 'uk_rightmove',
    quality_grade: diagOverrides.qualityGrade ?? 'C',
    extraction_rate: diagOverrides.extractionRate ?? 0.6,
    extractable_fields: 5,
    populated_extractable_fields: 3,
    last_retrieved_at: timestamp,
  });
  await storeListing(id, listing);
  await storeDiagnostics(id, makeDiagnostics(diagOverrides));
}

describe('admin extractions deduplication', () => {
  beforeEach(() => {
    clearListingStore();
  });

  // ──────────────────────────────────────────────────────────────────
  // generateStableId()
  // ──────────────────────────────────────────────────────────────────

  describe('generateStableId', () => {
    it('generates the same ID for the same URL', () => {
      expect(generateStableId(URL_A)).toBe(generateStableId(URL_A));
    });

    it('generates different IDs for different URLs', () => {
      expect(generateStableId(URL_A)).not.toBe(generateStableId(URL_B));
    });

    it('produces a 12-character lowercase hex string', () => {
      expect(generateStableId(URL_A)).toMatch(/^[0-9a-f]{12}$/);
    });

    it('same ID for URL with and without trailing slash (after secondary fix)', () => {
      // Previously these differed because deduplicationKey preserved trailing slashes.
      // The fix in url-canonicalizer.ts strips trailing slashes in deduplicationKey().
      expect(generateStableId(URL_A)).toBe(generateStableId(URL_A_SLASH));
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // deduplicationKey()
  // ──────────────────────────────────────────────────────────────────

  describe('deduplicationKey', () => {
    it('returns hostname + pathname only (no query params or fragment)', () => {
      const base = deduplicationKey(URL_A);
      expect(deduplicationKey(URL_A + '?utm_source=google')).toBe(base);
      expect(deduplicationKey(URL_A + '#photos')).toBe(base);
      expect(deduplicationKey(URL_A + '?ref=email&utm_medium=cpc')).toBe(base);
    });

    it('lowercases the hostname', () => {
      const key = deduplicationKey('https://WWW.Rightmove.CO.UK/properties/123');
      expect(key).toBe('www.rightmove.co.uk/properties/123');
    });

    it('treats URL with and without trailing slash as the same key', () => {
      // Cause 1c fix: trailing slash stripped in deduplicationKey()
      expect(deduplicationKey(URL_A)).toBe(deduplicationKey(URL_A_SLASH));
    });

    it('does not strip the root slash', () => {
      // "example.com/" — root path, slash must stay
      const key = deduplicationKey('https://example.com/');
      expect(key).toBe('example.com/');
    });

    it('returns the raw string for unparseable input', () => {
      expect(deduplicationKey('not-a-url')).toBe('not-a-url');
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // getRecentExtractions() — URL-level dedup (primary fix)
  // ──────────────────────────────────────────────────────────────────

  describe('getRecentExtractions URL-level dedup', () => {
    it('returns one row when two in-memory entries share the same URL (different IDs)', async () => {
      // Simulate Cause 1a: same URL stored under a legacy dynamic ID and then
      // again under the stable ID produced by generateStableId().
      const dynamicId = generateId();
      const stableId = generateStableId(URL_A);

      await storeFull(dynamicId, URL_A, 'Old duplicate entry', new Date(Date.now() - 10_000), { qualityGrade: 'C' });
      // storeListing overwrites the URL-index entry but keeps both in store
      await storeFull(stableId, URL_A, 'Newer entry', new Date(), { qualityGrade: 'B' });

      const result = await getRecentExtractions();
      const forUrl = result.filter(s => s.sourceUrl === URL_A);

      expect(forUrl).toHaveLength(1);
    });

    it('keeps the most recent entry when deduplicating by URL', async () => {
      const oldId = generateId();
      const newId = generateId();

      await storeFull(oldId, URL_A, 'Old entry', new Date(Date.now() - 10_000));
      await storeFull(newId, URL_A, 'New entry', new Date());

      const result = await getRecentExtractions();
      const forUrl = result.filter(s => s.sourceUrl === URL_A);

      expect(forUrl).toHaveLength(1);
      expect(forUrl[0].title).toBe('New entry');
    });

    it('does not collapse entries for genuinely different URLs', async () => {
      await storeFull(generateId(), URL_A, 'Property A');
      await storeFull(generateId(), URL_B, 'Property B');

      const result = await getRecentExtractions();
      expect(result).toHaveLength(2);
    });

    it('treats URL with and without trailing slash as one entry', async () => {
      // Cause 1c fix: same property submitted with and without trailing slash
      // should yield only one row after both deduplicationKey() fix (strips slash)
      // and getRecentExtractions() URL-level dedup.
      await storeFull(generateId(), URL_A, 'Without slash', new Date(Date.now() - 5_000));
      await storeFull(generateId(), URL_A_SLASH, 'With slash', new Date());

      const result = await getRecentExtractions();
      const forProp = result.filter(
        s => s.sourceUrl === URL_A || s.sourceUrl === URL_A_SLASH,
      );

      expect(forProp).toHaveLength(1);
      expect(forProp[0].title).toBe('With slash'); // most recent wins
    });

    it('handles more than two duplicates for the same URL', async () => {
      // Observed in production: 4× entries for the same property
      const base = new Date(Date.now() - 30_000);
      for (let i = 0; i < 4; i++) {
        await storeFull(
          generateId(),
          URL_A,
          `Duplicate ${i}`,
          new Date(base.getTime() + i * 1_000),
        );
      }

      const result = await getRecentExtractions();
      const forUrl = result.filter(s => s.sourceUrl === URL_A);

      expect(forUrl).toHaveLength(1);
      expect(forUrl[0].title).toBe('Duplicate 3'); // highest timestamp wins
    });

    it('does not drop entries that have no source URL', async () => {
      // Listings without an import_url should still appear
      const id = generateId();
      const listing = new Listing();
      listing.assignAttributes({
        title: 'No URL listing',
        last_retrieved_at: new Date(),
      });
      await storeListing(id, listing);
      await storeDiagnostics(id, makeDiagnostics());

      const result = await getRecentExtractions();
      expect(result.some(s => s.title === 'No URL listing')).toBe(true);
    });

    it('does not collapse multiple no-URL entries into one', async () => {
      // Each listing without a URL should appear independently
      for (let i = 0; i < 3; i++) {
        const id = generateId();
        const listing = new Listing();
        listing.assignAttributes({ title: `No URL ${i}`, last_retrieved_at: new Date() });
        await storeListing(id, listing);
        await storeDiagnostics(id, makeDiagnostics());
      }

      const result = await getRecentExtractions();
      const noUrl = result.filter(s => !s.sourceUrl);
      expect(noUrl).toHaveLength(3);
    });

    it('respects the limit after deduplication', async () => {
      // 3 unique URLs, limit=2 → only 2 rows
      await storeFull(generateId(), URL_A, 'A');
      await storeFull(generateId(), URL_B, 'B');
      await storeFull(generateId(), 'https://www.rightmove.co.uk/properties/300', 'C');

      const result = await getRecentExtractions(2);
      expect(result).toHaveLength(2);
    });
  });
});
