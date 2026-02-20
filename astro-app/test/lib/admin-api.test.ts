/**
 * Tests for admin API functionality:
 * - Listing management (delete, set_visibility)
 * - Extraction listing and filtering
 * - Single extraction detail retrieval
 *
 * These test the underlying service functions that the admin API endpoints use,
 * since route handlers require the full Astro runtime.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateId,
  storeListing,
  getListing,
  storeDiagnostics,
  getDiagnostics,
  clearListingStore,
  deleteListing,
  updateListingVisibility,
  findListingByUrl,
} from '../../src/lib/services/listing-store.js';
import {
  getRecentExtractions,
} from '../../src/lib/services/extraction-stats.js';
import { Listing } from '../../src/lib/models/listing.js';
import type { ExtractionDiagnostics } from '../../src/lib/extractor/html-extractor.js';

function makeDiagnostics(overrides: Partial<ExtractionDiagnostics> = {}): ExtractionDiagnostics {
  return {
    scraperName: 'uk_rightmove',
    fieldTraces: [
      { field: 'title', section: 'textFields', strategy: 'cssLocator:h1', rawText: 'Test', value: 'Test' },
      { field: 'price_string', section: 'textFields', strategy: 'cssLocator:.price', rawText: '£500,000', value: '£500,000' },
    ],
    totalFields: 10,
    populatedFields: 2,
    emptyFields: ['description'],
    extractableFields: 8,
    populatedExtractableFields: 2,
    extractionRate: 0.25,
    qualityGrade: 'C',
    qualityLabel: 'Partial',
    meetsExpectation: false,
    ...overrides,
  };
}

async function createTestExtraction(
  title: string,
  importUrl: string,
  diagOverrides: Partial<ExtractionDiagnostics> = {},
): Promise<string> {
  const id = generateId();
  const listing = new Listing();
  listing.assignAttributes({
    title,
    price_string: '£500,000',
    import_url: importUrl,
    last_retrieved_at: new Date(),
  });
  await storeListing(id, listing);
  await storeDiagnostics(id, makeDiagnostics(diagOverrides));
  return id;
}

describe('admin API: listing management', () => {
  beforeEach(() => {
    clearListingStore();
  });

  describe('delete action', () => {
    it('deletes a listing and its diagnostics from the store', async () => {
      const id = await createTestExtraction(
        'Delete Me',
        'https://www.rightmove.co.uk/properties/del-1',
      );

      expect(await getListing(id)).toBeDefined();
      expect(await getDiagnostics(id)).toBeDefined();

      await deleteListing(id);

      expect(await getListing(id)).toBeUndefined();
      expect(await getDiagnostics(id)).toBeUndefined();
    });

    it('removes listing from URL index', async () => {
      const url = 'https://www.rightmove.co.uk/properties/del-url';
      const id = await createTestExtraction('URL Index Delete', url);

      expect(findListingByUrl(url)).toBe(id);

      await deleteListing(id);

      expect(findListingByUrl(url)).toBeUndefined();
    });

    it('deleted listing does not appear in extraction list', async () => {
      const id1 = await createTestExtraction(
        'Keep Me',
        'https://example.com/keep-1',
      );
      const id2 = await createTestExtraction(
        'Delete Me',
        'https://example.com/del-2',
      );

      let extractions = await getRecentExtractions();
      expect(extractions).toHaveLength(2);

      await deleteListing(id2);

      extractions = await getRecentExtractions();
      expect(extractions).toHaveLength(1);
      expect(extractions[0].title).toBe('Keep Me');
    });

    it('does not crash when deleting nonexistent listing', async () => {
      await expect(deleteListing('no-such-id')).resolves.toBeUndefined();
    });
  });

  describe('set_visibility action', () => {
    it('sets visibility to hidden', async () => {
      const id = await createTestExtraction(
        'Hide Me',
        'https://example.com/vis-1',
      );

      await updateListingVisibility(id, 'hidden');

      const listing = await getListing(id);
      expect(listing!.visibility).toBe('hidden');
      expect(listing!.manual_override).toBe(true);
    });

    it('sets visibility to spam', async () => {
      const id = await createTestExtraction(
        'Spam Me',
        'https://example.com/vis-2',
      );

      await updateListingVisibility(id, 'spam');

      const listing = await getListing(id);
      expect(listing!.visibility).toBe('spam');
    });

    it('sets visibility to published', async () => {
      const id = await createTestExtraction(
        'Publish Me',
        'https://example.com/vis-3',
      );

      // Start as hidden
      await updateListingVisibility(id, 'hidden');
      expect((await getListing(id))!.visibility).toBe('hidden');

      // Change to published
      await updateListingVisibility(id, 'published');
      expect((await getListing(id))!.visibility).toBe('published');
    });

    it('sets visibility to pending', async () => {
      const id = await createTestExtraction(
        'Pending Me',
        'https://example.com/vis-4',
      );

      await updateListingVisibility(id, 'pending');

      const listing = await getListing(id);
      expect(listing!.visibility).toBe('pending');
    });

    it('throws error for nonexistent listing', async () => {
      await expect(
        updateListingVisibility('no-such-id', 'hidden'),
      ).rejects.toThrow('Listing not found');
    });

    it('visibility change is reflected in extraction list', async () => {
      const id = await createTestExtraction(
        'Vis List Test',
        'https://example.com/vis-list',
      );

      await updateListingVisibility(id, 'spam');

      const extractions = await getRecentExtractions();
      const ext = extractions.find(e => e.id === id);
      expect(ext).toBeDefined();
      expect(ext!.visibility).toBe('spam');
    });

    it('manual_override flag is set on visibility change', async () => {
      const id = await createTestExtraction(
        'Override Test',
        'https://example.com/override',
      );

      const before = await getListing(id);
      expect(before!.manual_override).toBeFalsy();

      await updateListingVisibility(id, 'hidden');

      const after = await getListing(id);
      expect(after!.manual_override).toBe(true);
    });
  });
});

describe('admin API: extraction listing', () => {
  beforeEach(() => {
    clearListingStore();
  });

  it('returns all extractions', async () => {
    await createTestExtraction('House A', 'https://example.com/a');
    await createTestExtraction('House B', 'https://example.com/b');
    await createTestExtraction('House C', 'https://example.com/c');

    const extractions = await getRecentExtractions();
    expect(extractions).toHaveLength(3);
  });

  it('filters by scraper name', async () => {
    await createTestExtraction('RM House', 'https://example.com/rm', { scraperName: 'uk_rightmove' });
    await createTestExtraction('ID House', 'https://example.com/id', { scraperName: 'es_idealista' });

    const all = await getRecentExtractions();
    const rmOnly = all.filter(e => e.scraperName === 'uk_rightmove');
    const idOnly = all.filter(e => e.scraperName === 'es_idealista');

    expect(rmOnly).toHaveLength(1);
    expect(rmOnly[0].title).toBe('RM House');
    expect(idOnly).toHaveLength(1);
    expect(idOnly[0].title).toBe('ID House');
  });

  it('filters by quality grade', async () => {
    await createTestExtraction('A House', 'https://example.com/a', { qualityGrade: 'A' });
    await createTestExtraction('F House', 'https://example.com/f', { qualityGrade: 'F' });

    const all = await getRecentExtractions();
    const aOnly = all.filter(e => e.qualityGrade === 'A');
    const fOnly = all.filter(e => e.qualityGrade === 'F');

    expect(aOnly).toHaveLength(1);
    expect(aOnly[0].title).toBe('A House');
    expect(fOnly).toHaveLength(1);
    expect(fOnly[0].title).toBe('F House');
  });

  it('filters by search term (title)', async () => {
    await createTestExtraction('Luxury Villa', 'https://example.com/villa');
    await createTestExtraction('Cozy Apartment', 'https://example.com/apt');

    const all = await getRecentExtractions();
    const search = 'villa';
    const filtered = all.filter(e =>
      e.sourceUrl.toLowerCase().includes(search) || e.title.toLowerCase().includes(search),
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toBe('Luxury Villa');
  });

  it('filters by search term (URL)', async () => {
    await createTestExtraction('House 1', 'https://www.rightmove.co.uk/properties/111');
    await createTestExtraction('House 2', 'https://www.idealista.com/inmueble/222');

    const all = await getRecentExtractions();
    const filtered = all.filter(e =>
      e.sourceUrl.toLowerCase().includes('rightmove'),
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toBe('House 1');
  });

  it('extractions include all expected summary fields', async () => {
    await createTestExtraction('Full Fields', 'https://example.com/full', {
      qualityGrade: 'B',
      extractionRate: 0.75,
      extractableFields: 20,
      populatedExtractableFields: 15,
    });

    const extractions = await getRecentExtractions();
    const ext = extractions[0];

    expect(ext.id).toBeTruthy();
    expect(ext.timestamp).toBeGreaterThan(0);
    expect(ext.scraperName).toBe('uk_rightmove');
    expect(ext.sourceUrl).toBe('https://example.com/full');
    expect(ext.qualityGrade).toBe('B');
    expect(ext.extractionRate).toBe(0.75);
    expect(ext.extractableFields).toBe(20);
    expect(ext.populatedExtractableFields).toBe(15);
    expect(ext.title).toBe('Full Fields');
    expect(ext.priceString).toBe('£500,000');
    expect(ext.visibility).toBeTruthy();
    expect(typeof ext.confidenceScore).toBe('number');
  });
});

describe('admin API: single extraction detail', () => {
  beforeEach(() => {
    clearListingStore();
  });

  it('retrieves listing and diagnostics by ID', async () => {
    const id = await createTestExtraction(
      'Detail Test',
      'https://example.com/detail',
      { qualityGrade: 'A', extractionRate: 0.9 },
    );

    const listing = await getListing(id);
    const diagnostics = await getDiagnostics(id);

    expect(listing).toBeDefined();
    expect(listing!.title).toBe('Detail Test');
    expect(typeof listing!.asJson).toBe('function');

    expect(diagnostics).toBeDefined();
    expect(diagnostics!.qualityGrade).toBe('A');
    expect(diagnostics!.extractionRate).toBe(0.9);
    expect(diagnostics!.fieldTraces).toHaveLength(2);
  });

  it('returns undefined for nonexistent extraction', async () => {
    const listing = await getListing('bogus-id');
    expect(listing).toBeUndefined();
  });

  it('listing asJson includes all persisted fields', async () => {
    const id = generateId();
    const listing = new Listing();
    listing.assignAttributes({
      title: 'JSON Test',
      price_string: '£250,000',
      price_float: 250000,
      count_bedrooms: 3,
      city: 'London',
      import_url: 'https://example.com/json-test',
    });
    await storeListing(id, listing);

    const retrieved = await getListing(id);
    const json = retrieved!.asJson();

    expect(json.title).toBe('JSON Test');
    expect(json.price_string).toBe('£250,000');
    expect(json.price_float).toBe(250000);
    expect(json.count_bedrooms).toBe(3);
    expect(json.city).toBe('London');
    expect(json.import_url).toBe('https://example.com/json-test');
  });

  it('diagnostics include field traces for scraper analysis', async () => {
    const id = await createTestExtraction(
      'Trace Test',
      'https://example.com/trace',
      {
        fieldTraces: [
          { field: 'title', section: 'textFields', strategy: 'cssLocator:h1', rawText: 'My House', value: 'My House' },
          { field: 'price_float', section: 'floatFields', strategy: 'scriptRegEx:price', rawText: '500000', value: 500000 },
          { field: 'description', section: 'textFields', strategy: 'cssLocator:.desc', rawText: '', value: '' },
        ],
      },
    );

    const diagnostics = await getDiagnostics(id);
    expect(diagnostics!.fieldTraces).toHaveLength(3);

    const titleTrace = diagnostics!.fieldTraces.find(t => t.field === 'title');
    expect(titleTrace).toBeDefined();
    expect(titleTrace!.value).toBe('My House');
    expect(titleTrace!.strategy).toBe('cssLocator:h1');

    const emptyTrace = diagnostics!.fieldTraces.find(t => t.field === 'description');
    expect(emptyTrace).toBeDefined();
    expect(emptyTrace!.rawText).toBe('');
  });
});
