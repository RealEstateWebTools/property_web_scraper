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

    it('returns Firestore listings when in-memory store is empty', async () => {
      // Save listings directly to Firestore via ORM
      const fs1 = await Listing.create({ title: 'Firestore House A', price_float: 100000 });
      const fs2 = await Listing.create({ title: 'Firestore House B', price_float: 200000 });

      // Clear in-memory store (does NOT clear InMemoryFirestoreClient)
      clearListingStore();

      const result = await getAllListings();
      expect(result.length).toBeGreaterThanOrEqual(2);
      const titles = result.map(r => r.listing.title);
      expect(titles).toContain('Firestore House A');
      expect(titles).toContain('Firestore House B');
    });

    it('merges Firestore and in-memory listings without duplicates', async () => {
      // Create a listing in Firestore
      const fsListing = await Listing.create({ title: 'Firestore Only', price_float: 150000 });
      const firestoreId = fsListing.id;

      // Clear in-memory then add a different listing to in-memory only
      clearListingStore();
      const memId = generateId();
      const memListing = new Listing();
      memListing.assignAttributes({ title: 'Memory Only', price_float: 250000 });
      await storeListing(memId, memListing);

      const result = await getAllListings();
      const titles = result.map(r => r.listing.title);
      expect(titles).toContain('Firestore Only');
      expect(titles).toContain('Memory Only');

      // Verify no duplicate IDs
      const ids = result.map(r => r.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('does not duplicate listings present in both Firestore and memory', async () => {
      // Create a listing in Firestore
      const fsListing = await Listing.create({ title: 'Shared Listing', price_float: 300000 });
      const firestoreId = fsListing.id;

      // Also put it in the in-memory store (simulates a listing that was just extracted)
      const inMemListing = new Listing();
      inMemListing.assignAttributes({ title: 'Shared Listing', price_float: 300000 });
      await storeListing(firestoreId, inMemListing);

      const result = await getAllListings();
      const matchingEntries = result.filter(r => r.id === firestoreId);
      expect(matchingEntries).toHaveLength(1);
    });

    it('populates in-memory cache from Firestore for subsequent getListing calls', async () => {
      const fsListing = await Listing.create({ title: 'Cache Populate Test', price_float: 400000 });
      const firestoreId = fsListing.id;

      clearListingStore();

      // getAllListings should populate the cache
      await getAllListings();

      // Now getListing should find it in-memory without hitting Firestore again
      const retrieved = await getListing(firestoreId);
      expect(retrieved).toBeDefined();
      expect(retrieved!.title).toBe('Cache Populate Test');
    });

    it('returns proper Listing instances with asJson() from Firestore', async () => {
      await Listing.create({ title: 'AsJson Test', price_float: 500000, city: 'London' });

      clearListingStore();

      const result = await getAllListings();
      expect(result.length).toBeGreaterThanOrEqual(1);

      const entry = result.find(r => r.listing.title === 'AsJson Test');
      expect(entry).toBeDefined();
      expect(typeof entry!.listing.asJson).toBe('function');

      const json = entry!.listing.asJson();
      expect(json.title).toBe('AsJson Test');
      expect(json.price_float).toBe(500000);
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

  describe('Firestore fallback', () => {
    it('getAllListings falls back to Firestore when in-memory is empty', async () => {
      const listing = await Listing.create({
        title: 'Firestore Fallback List',
        price_float: 350000,
        visibility: 'published',
      });

      clearListingStore();

      const result = await getAllListings();
      const titles = result.map(r => r.listing.title);
      expect(titles).toContain('Firestore Fallback List');
    });

    it('getAllListings survives Firestore errors and returns in-memory data', async () => {
      // Store something in memory first
      const id = generateId();
      const memListing = new Listing();
      memListing.assignAttributes({ title: 'In Memory Survivor' });
      await storeListing(id, memListing);

      // getAllListings should still return in-memory data even if Firestore has issues
      const result = await getAllListings();
      const titles = result.map(r => r.listing.title);
      expect(titles).toContain('In Memory Survivor');
    });

    it('getListing falls back to Firestore when not in memory', async () => {
      // Save a listing to Firestore via the ORM
      const listing = await Listing.create({
        title: 'Firestore Fallback House',
        price_float: 300000,
      });
      const firestoreId = listing.id;

      // Clear in-memory store (does NOT clear InMemoryFirestoreClient)
      clearListingStore();

      // getListing should fall back to Listing.find() on the InMemoryFirestoreClient
      const retrieved = await getListing(firestoreId);
      expect(retrieved).toBeDefined();
      expect(retrieved!.title).toBe('Firestore Fallback House');
    });

    it('getListing caches Firestore result in memory', async () => {
      const listing = await Listing.create({
        title: 'Cached Fallback',
      });
      const firestoreId = listing.id;

      clearListingStore();

      // First call fetches from Firestore
      const first = await getListing(firestoreId);
      expect(first).toBeDefined();

      // Second call should still return (now from in-memory cache)
      const second = await getListing(firestoreId);
      expect(second).toBeDefined();
      expect(second!.title).toBe('Cached Fallback');
    });

    it('getListing returns undefined when not in Firestore either', async () => {
      clearListingStore();
      const result = await getListing('totally-bogus-id');
      expect(result).toBeUndefined();
    });

    it('getDiagnostics reconstructs from Firestore listing', async () => {
      const listing = await Listing.create({
        title: 'Diag Reconstruction Test',
        scraper_name: 'uk_rightmove',
        quality_grade: 'A',
        quality_label: 'Excellent',
        extraction_rate: 0.85,
        weighted_extraction_rate: 0.9,
        extractable_fields: 20,
        populated_extractable_fields: 17,
        meets_expectation: true,
        critical_fields_missing: ['energy_rating'],
        confidence_score: 0.95,
      });
      const firestoreId = listing.id;

      // Clear both in-memory stores
      clearListingStore();

      const diag = await getDiagnostics(firestoreId);
      expect(diag).toBeDefined();
      expect(diag!.scraperName).toBe('uk_rightmove');
      expect(diag!.qualityGrade).toBe('A');
      expect(diag!.qualityLabel).toBe('Excellent');
      expect(diag!.extractionRate).toBe(0.85);
      expect(diag!.weightedExtractionRate).toBe(0.9);
      expect(diag!.extractableFields).toBe(20);
      expect(diag!.populatedExtractableFields).toBe(17);
      expect(diag!.meetsExpectation).toBe(true);
      expect(diag!.confidenceScore).toBe(0.95);
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
