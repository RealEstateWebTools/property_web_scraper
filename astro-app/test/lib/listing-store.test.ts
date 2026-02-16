import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateId,
  storeListing,
  getListing,
  storeDiagnostics,
  getDiagnostics,
  getAllListings,
  getStoreStats,
  clearListingStore,
  initKV,
  findListingByUrl,
} from '../../src/lib/services/listing-store.js';
import { Listing } from '../../src/lib/models/listing.js';
import type { ExtractionDiagnostics } from '../../src/lib/extractor/html-extractor.js';

describe('listing-store', () => {
  beforeEach(() => {
    clearListingStore();
  });

  describe('generateId', () => {
    it('returns a non-empty string', () => {
      const id = generateId();
      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
    });

    it('returns unique IDs on subsequent calls', () => {
      const id1 = generateId();
      const id2 = generateId();
      const id3 = generateId();
      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
    });

    it('contains a dash separator', () => {
      const id = generateId();
      expect(id).toContain('-');
    });
  });

  describe('storeListing / getListing', () => {
    it('stores and retrieves a listing by ID', async () => {
      const id = generateId();
      const listing = new Listing();
      listing.assignAttributes({ title: 'Test House', price_float: 250000 });

      await storeListing(id, listing);
      const retrieved = await getListing(id);

      expect(retrieved).toBeDefined();
      expect(retrieved!.title).toBe('Test House');
      expect(retrieved!.price_float).toBe(250000);
    });

    it('returns undefined for unknown ID', async () => {
      const result = await getListing('nonexistent-id');
      expect(result).toBeUndefined();
    });

    it('retrieved listing has asJson method', async () => {
      const id = generateId();
      const listing = new Listing();
      listing.assignAttributes({ title: 'Test' });

      await storeListing(id, listing);
      const retrieved = await getListing(id);

      expect(typeof retrieved!.asJson).toBe('function');
      const json = retrieved!.asJson();
      expect(json.title).toBe('Test');
    });
  });

  describe('rehydration from plain objects', () => {
    it('rehydrates a plain object into a Listing with asJson()', async () => {
      const id = generateId();
      // Simulate KV deserialization: a plain object without prototype methods
      const plainObj = {
        title: 'Rehydrated Property',
        price_string: '£500,000',
        import_url: 'http://example.com/listing/1',
      } as any;

      await storeListing(id, plainObj);
      const retrieved = await getListing(id);

      expect(retrieved).toBeDefined();
      expect(typeof retrieved!.asJson).toBe('function');
      const json = retrieved!.asJson();
      expect(json.title).toBe('Rehydrated Property');
      expect(json.price_string).toBe('£500,000');
    });

    it('asJson does not crash on rehydrated listing', async () => {
      const id = generateId();
      const plainObj = { title: 'Crash test' } as any;

      await storeListing(id, plainObj);
      const retrieved = await getListing(id);

      expect(() => retrieved!.asJson()).not.toThrow();
    });
  });

  describe('storeDiagnostics / getDiagnostics', () => {
    it('stores and retrieves diagnostics by ID', async () => {
      const id = generateId();
      const diag: ExtractionDiagnostics = {
        scraperName: 'rightmove',
        fieldTraces: [
          { field: 'title', section: 'textFields', strategy: 'cssLocator:h1', rawText: 'Test', value: 'Test' },
        ],
        totalFields: 1,
        populatedFields: 1,
        emptyFields: [],
      };

      await storeDiagnostics(id, diag);
      const retrieved = await getDiagnostics(id);

      expect(retrieved).toBeDefined();
      expect(retrieved!.scraperName).toBe('rightmove');
      expect(retrieved!.populatedFields).toBe(1);
      expect(retrieved!.fieldTraces).toHaveLength(1);
    });

    it('returns undefined for unknown diagnostics ID', async () => {
      const result = await getDiagnostics('nonexistent-id');
      expect(result).toBeUndefined();
    });
  });

  describe('getAllListings', () => {
    it('returns empty array when store is empty', async () => {
      const result = await getAllListings();
      expect(result).toEqual([]);
    });

    it('returns all stored listings with their IDs', async () => {
      const id1 = generateId();
      const id2 = generateId();
      const listing1 = new Listing();
      listing1.assignAttributes({ title: 'House 1' });
      const listing2 = new Listing();
      listing2.assignAttributes({ title: 'House 2' });

      await storeListing(id1, listing1);
      await storeListing(id2, listing2);

      const result = await getAllListings();
      expect(result).toHaveLength(2);
      const titles = result.map(r => r.listing.title);
      expect(titles).toContain('House 1');
      expect(titles).toContain('House 2');
    });
  });

  describe('getStoreStats', () => {
    it('returns count 0 when store is empty', () => {
      const stats = getStoreStats();
      expect(stats.count).toBe(0);
    });

    it('returns correct count after storing listings', async () => {
      const listing = new Listing();
      await storeListing(generateId(), listing);
      await storeListing(generateId(), listing);

      const stats = getStoreStats();
      expect(stats.count).toBe(2);
    });
  });

  describe('clearListingStore', () => {
    it('clears all listings and diagnostics', async () => {
      const id = generateId();
      const listing = new Listing();
      await storeListing(id, listing);
      await storeDiagnostics(id, {
        scraperName: 'test',
        fieldTraces: [],
        totalFields: 0,
        populatedFields: 0,
        emptyFields: [],
      });

      expect(getStoreStats().count).toBe(1);
      expect(await getDiagnostics(id)).toBeDefined();

      clearListingStore();

      expect(getStoreStats().count).toBe(0);
      expect(await getListing(id)).toBeUndefined();
      expect(await getDiagnostics(id)).toBeUndefined();
    });
  });

  describe('findListingByUrl', () => {
    it('finds listing ID by URL after storing', async () => {
      const id = generateId();
      const listing = new Listing();
      listing.assignAttributes({ import_url: 'https://www.rightmove.co.uk/properties/123' });
      await storeListing(id, listing);

      const foundId = findListingByUrl('https://www.rightmove.co.uk/properties/123');
      expect(foundId).toBe(id);
    });

    it('finds listing regardless of query params (dedup key)', async () => {
      const id = generateId();
      const listing = new Listing();
      listing.assignAttributes({ import_url: 'https://www.rightmove.co.uk/properties/123' });
      await storeListing(id, listing);

      const foundId = findListingByUrl('https://www.rightmove.co.uk/properties/123?utm_source=google');
      expect(foundId).toBe(id);
    });

    it('returns undefined for unknown URL', () => {
      expect(findListingByUrl('https://www.unknown.com/page')).toBeUndefined();
    });

    it('clears URL index on clearListingStore', async () => {
      const id = generateId();
      const listing = new Listing();
      listing.assignAttributes({ import_url: 'https://example.com/listing/1' });
      await storeListing(id, listing);

      expect(findListingByUrl('https://example.com/listing/1')).toBe(id);

      clearListingStore();
      expect(findListingByUrl('https://example.com/listing/1')).toBeUndefined();
    });
  });

  describe('initKV', () => {
    it('accepts null without crashing', () => {
      expect(() => initKV(null)).not.toThrow();
    });

    it('accepts undefined without crashing', () => {
      expect(() => initKV(undefined)).not.toThrow();
    });

    it('works with a mock KV namespace', async () => {
      const kvData = new Map<string, string>();
      const mockKV = {
        put: async (key: string, value: string, _opts?: any) => { kvData.set(key, value); },
        get: async (key: string, _type?: string) => {
          const val = kvData.get(key);
          return val ? JSON.parse(val) : null;
        },
      };

      initKV(mockKV);

      const id = generateId();
      const listing = new Listing();
      listing.assignAttributes({ title: 'KV Test' });
      await storeListing(id, listing);

      // Verify KV was called
      expect(kvData.has(`listing:${id}`)).toBe(true);

      // Reset KV to null for other tests
      initKV(null);
    });
  });
});
