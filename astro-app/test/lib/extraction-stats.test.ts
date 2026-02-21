import { describe, it, expect, beforeEach } from 'vitest';
import {
  getRecentExtractions,
  getScraperStats,
  getAllScraperStats,
  getSystemOverview,
} from '../../src/lib/services/extraction-stats.js';
import {
  generateId,
  storeListing,
  storeDiagnostics,
  clearListingStore,
} from '../../src/lib/services/listing-store.js';
import { Listing } from '../../src/lib/models/listing.js';
import type { ExtractionDiagnostics } from '../../src/lib/extractor/html-extractor.js';

function makeDiagnostics(overrides: Partial<ExtractionDiagnostics> = {}): ExtractionDiagnostics {
  return {
    scraperName: 'uk_rightmove',
    fieldTraces: [
      { field: 'title', section: 'textFields', strategy: 'cssLocator:title', rawText: 'Test', value: 'Test' },
      { field: 'price_string', section: 'textFields', strategy: 'cssLocator:.price', rawText: '£500,000', value: '£500,000' },
      { field: 'latitude', section: 'floatFields', strategy: 'scriptRegEx:lat', rawText: '51.5', value: 51.5 },
    ],
    totalFields: 10,
    populatedFields: 3,
    emptyFields: ['description', 'longitude'],
    extractableFields: 8,
    populatedExtractableFields: 3,
    extractionRate: 0.375,
    qualityGrade: 'C',
    qualityLabel: 'Partial',
    meetsExpectation: false,
    ...overrides,
  };
}

async function storeTestListing(
  scraperName: string,
  title: string,
  priceString: string,
  importUrl: string,
  diagOverrides: Partial<ExtractionDiagnostics> = {},
): Promise<string> {
  const id = generateId();
  const diag = makeDiagnostics({ scraperName, ...diagOverrides });
  const listing = new Listing();
  listing.assignAttributes({
    title,
    price_string: priceString,
    import_url: importUrl,
    last_retrieved_at: new Date(),
    // Embed diagnostic fields on the listing (matches what extraction-runner.ts does)
    scraper_name: diag.scraperName,
    quality_grade: diag.qualityGrade,
    quality_label: diag.qualityLabel,
    extraction_rate: diag.extractionRate,
    weighted_extraction_rate: diag.weightedExtractionRate,
    extractable_fields: diag.extractableFields,
    populated_extractable_fields: diag.populatedExtractableFields,
    meets_expectation: diag.meetsExpectation,
    critical_fields_missing: diag.criticalFieldsMissing,
  });
  await storeListing(id, listing);
  await storeDiagnostics(id, diag);
  return id;
}

describe('extraction-stats', () => {
  beforeEach(() => {
    clearListingStore();
  });

  describe('getRecentExtractions', () => {
    it('returns empty array when no listings', async () => {
      const result = await getRecentExtractions();
      expect(result).toEqual([]);
    });

    it('returns summaries for stored listings with diagnostics', async () => {
      await storeTestListing('uk_rightmove', 'Test House', '£500,000', 'https://www.rightmove.co.uk/properties/123');
      await storeTestListing('es_idealista', 'Piso en Madrid', '990.000', 'https://www.idealista.com/inmueble/456/');

      const result = await getRecentExtractions();
      expect(result).toHaveLength(2);
      expect(result[0].scraperName).toBeTruthy();
      expect(result[0].qualityGrade).toBe('C');
    });

    it('respects limit parameter', async () => {
      await storeTestListing('uk_rightmove', 'House 1', '£100,000', 'https://example.com/1');
      await storeTestListing('uk_rightmove', 'House 2', '£200,000', 'https://example.com/2');
      await storeTestListing('uk_rightmove', 'House 3', '£300,000', 'https://example.com/3');

      const result = await getRecentExtractions(2);
      expect(result).toHaveLength(2);
    });

    it('sorts by timestamp descending (most recent first)', async () => {
      await storeTestListing('uk_rightmove', 'Old House', '£100,000', 'https://example.com/old');
      // Small delay to ensure different timestamp
      await new Promise(r => setTimeout(r, 5));
      await storeTestListing('uk_rightmove', 'New House', '£200,000', 'https://example.com/new');

      const result = await getRecentExtractions();
      expect(result[0].title).toBe('New House');
      expect(result[1].title).toBe('Old House');
    });

    it('includes weighted extraction rate when present', async () => {
      await storeTestListing('uk_rightmove', 'Test', '£500', 'https://example.com/1', {
        weightedExtractionRate: 0.65,
      });

      const result = await getRecentExtractions();
      expect(result[0].weightedExtractionRate).toBe(0.65);
    });

    it('includes critical fields missing when present', async () => {
      await storeTestListing('uk_rightmove', 'Test', '£500', 'https://example.com/1', {
        criticalFieldsMissing: ['title', 'price_string'],
      });

      const result = await getRecentExtractions();
      expect(result[0].criticalFieldsMissing).toEqual(['title', 'price_string']);
    });

    it('includes listings without diagnostics (shows everything)', async () => {
      const id = generateId();
      const listing = new Listing();
      listing.assignAttributes({ title: 'No diag' });
      await storeListing(id, listing);

      const result = await getRecentExtractions();
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('No diag');
      expect(result[0].scraperName).toBe('');
      expect(result[0].qualityGrade).toBe('F');
    });
  });

  describe('getScraperStats', () => {
    it('returns stats for a known scraper with no extractions', async () => {
      const stats = await getScraperStats('uk_rightmove');
      expect(stats.name).toBe('uk_rightmove');
      expect(stats.loaded).toBe(true);
      expect(stats.extractionCount).toBe(0);
      expect(stats.avgExtractionRate).toBe(0);
      expect(stats.gradeDistribution).toEqual({ A: 0, B: 0, C: 0, F: 0 });
    });

    it('returns loaded=false for unknown scraper', async () => {
      const stats = await getScraperStats('nonexistent');
      expect(stats.name).toBe('nonexistent');
      expect(stats.loaded).toBe(false);
    });

    it('counts extractions and computes average rate', async () => {
      await storeTestListing('uk_rightmove', 'House 1', '£100', 'https://example.com/1', {
        extractionRate: 0.8,
      });
      await storeTestListing('uk_rightmove', 'House 2', '£200', 'https://example.com/2', {
        extractionRate: 0.6,
      });

      const stats = await getScraperStats('uk_rightmove');
      expect(stats.extractionCount).toBe(2);
      expect(stats.avgExtractionRate).toBeCloseTo(0.7, 1);
    });

    it('tracks grade distribution', async () => {
      await storeTestListing('uk_rightmove', 'A House', '£100', 'https://example.com/1', {
        qualityGrade: 'A',
      });
      await storeTestListing('uk_rightmove', 'C House', '£200', 'https://example.com/2', {
        qualityGrade: 'C',
      });
      await storeTestListing('uk_rightmove', 'C House 2', '£300', 'https://example.com/3', {
        qualityGrade: 'C',
      });

      const stats = await getScraperStats('uk_rightmove');
      expect(stats.gradeDistribution.A).toBe(1);
      expect(stats.gradeDistribution.C).toBe(2);
      expect(stats.gradeDistribution.F).toBe(0);
    });

    it('tracks field success rates from traces', async () => {
      await storeTestListing('uk_rightmove', 'House', '£100', 'https://example.com/1', {
        fieldTraces: [
          { field: 'title', section: 'textFields', strategy: 'css', rawText: 'Test', value: 'Test' },
          { field: 'price_string', section: 'textFields', strategy: 'css', rawText: '', value: '' },
        ],
      });

      const stats = await getScraperStats('uk_rightmove');
      expect(stats.fieldSuccessRates['title']).toBe(1);
      expect(stats.fieldSuccessRates['price_string']).toBe(0);
    });

    it('includes expected extraction rate from mapping', async () => {
      const stats = await getScraperStats('uk_rightmove');
      expect(stats.expectedExtractionRate).toBe(0.85);
    });

    it('lists hosts for the scraper', async () => {
      const stats = await getScraperStats('uk_rightmove');
      expect(stats.hosts).toContain('www.rightmove.co.uk');
    });
  });

  describe('getAllScraperStats', () => {
    it('returns stats for all loaded scrapers', async () => {
      const allStats = await getAllScraperStats();
      expect(allStats.length).toBeGreaterThan(0);
      const names = allStats.map(s => s.name);
      expect(names).toContain('uk_rightmove');
      expect(names).toContain('es_idealista');
    });
  });

  describe('getSystemOverview', () => {
    it('returns empty overview when no data', async () => {
      const overview = await getSystemOverview();
      expect(overview.totalExtractions).toBe(0);
      expect(overview.avgExtractionRate).toBe(0);
      expect(overview.recentExtractions).toHaveLength(0);
    });

    it('aggregates data across scrapers', async () => {
      await storeTestListing('uk_rightmove', 'RM House', '£100', 'https://example.com/1', {
        extractionRate: 0.8,
        qualityGrade: 'A',
      });
      await storeTestListing('es_idealista', 'ID House', '100.000', 'https://example.com/2', {
        extractionRate: 0.6,
        qualityGrade: 'C',
      });

      const overview = await getSystemOverview();
      expect(overview.totalExtractions).toBe(2);
      expect(overview.avgExtractionRate).toBeCloseTo(0.7, 1);
      expect(overview.gradeDistribution.A).toBe(1);
      expect(overview.gradeDistribution.C).toBe(1);
      expect(overview.scraperUsage['uk_rightmove']).toBe(1);
      expect(overview.scraperUsage['es_idealista']).toBe(1);
    });

    it('limits recent extractions to 10', async () => {
      for (let i = 0; i < 15; i++) {
        await storeTestListing('uk_rightmove', `House ${i}`, '£100', `https://example.com/${i}`);
      }

      const overview = await getSystemOverview();
      expect(overview.totalExtractions).toBe(15);
      expect(overview.recentExtractions).toHaveLength(10);
    });
  });
});
