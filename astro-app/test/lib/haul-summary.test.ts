import { describe, it, expect } from 'vitest';
import { computeHaulSummary } from '../../src/lib/services/haul-summary.js';
import type { HaulScrape } from '../../src/lib/services/haul-store.js';

function makeScrape(overrides: Partial<HaulScrape> = {}): HaulScrape {
  return {
    resultId: 'r1',
    title: 'Test',
    grade: 'A',
    price: '£100,000',
    extractionRate: 0.8,
    createdAt: new Date().toISOString(),
    url: 'https://example.com/1',
    ...overrides,
  };
}

describe('computeHaulSummary', () => {
  it('returns empty summary for zero scrapes', () => {
    const summary = computeHaulSummary([]);

    expect(summary.totalScrapes).toBe(0);
    expect(summary.priceRange).toBeNull();
    expect(summary.avgPrice).toBeNull();
    expect(summary.medianPrice).toBeNull();
    expect(summary.bedroomRange).toBeNull();
    expect(summary.scrapesWithGeo).toBe(0);
    expect(Object.keys(summary.gradeDistribution)).toHaveLength(0);
  });

  it('computes price stats correctly', () => {
    const scrapes = [
      makeScrape({ price_float: 100000, currency: '£' }),
      makeScrape({ resultId: 'r2', price_float: 200000, currency: '£' }),
      makeScrape({ resultId: 'r3', price_float: 300000, currency: '£' }),
    ];

    const summary = computeHaulSummary(scrapes);

    expect(summary.priceRange).toEqual({ min: 100000, max: 300000, currency: '£' });
    expect(summary.avgPrice).toBe(200000);
    expect(summary.medianPrice).toBe(200000);
  });

  it('computes median for even number of prices', () => {
    const scrapes = [
      makeScrape({ price_float: 100000, currency: '€' }),
      makeScrape({ resultId: 'r2', price_float: 200000, currency: '€' }),
      makeScrape({ resultId: 'r3', price_float: 300000, currency: '€' }),
      makeScrape({ resultId: 'r4', price_float: 400000, currency: '€' }),
    ];

    const summary = computeHaulSummary(scrapes);

    expect(summary.medianPrice).toBe(250000);
  });

  it('skips zero and missing price values', () => {
    const scrapes = [
      makeScrape({ price_float: 0 }),
      makeScrape({ resultId: 'r2', price_float: 100000, currency: '$' }),
      makeScrape({ resultId: 'r3' }), // no price_float
    ];

    const summary = computeHaulSummary(scrapes);

    expect(summary.priceRange).toEqual({ min: 100000, max: 100000, currency: '$' });
    expect(summary.avgPrice).toBe(100000);
  });

  it('computes grade distribution', () => {
    const scrapes = [
      makeScrape({ grade: 'A' }),
      makeScrape({ resultId: 'r2', grade: 'A' }),
      makeScrape({ resultId: 'r3', grade: 'B' }),
      makeScrape({ resultId: 'r4', grade: 'F' }),
    ];

    const summary = computeHaulSummary(scrapes);

    expect(summary.gradeDistribution).toEqual({ A: 2, B: 1, F: 1 });
  });

  it('computes portal counts', () => {
    const scrapes = [
      makeScrape({ import_host_slug: 'rightmove' }),
      makeScrape({ resultId: 'r2', import_host_slug: 'rightmove' }),
      makeScrape({ resultId: 'r3', import_host_slug: 'zoopla' }),
    ];

    const summary = computeHaulSummary(scrapes);

    expect(summary.portalCounts).toEqual({ rightmove: 2, zoopla: 1 });
  });

  it('computes bedroom range', () => {
    const scrapes = [
      makeScrape({ count_bedrooms: 2 }),
      makeScrape({ resultId: 'r2', count_bedrooms: 5 }),
      makeScrape({ resultId: 'r3', count_bedrooms: 3 }),
    ];

    const summary = computeHaulSummary(scrapes);

    expect(summary.bedroomRange).toEqual({ min: 2, max: 5 });
  });

  it('ignores zero bedrooms', () => {
    const scrapes = [
      makeScrape({ count_bedrooms: 0 }),
      makeScrape({ resultId: 'r2' }), // undefined
    ];

    const summary = computeHaulSummary(scrapes);

    expect(summary.bedroomRange).toBeNull();
  });

  it('computes city distribution', () => {
    const scrapes = [
      makeScrape({ city: 'London' }),
      makeScrape({ resultId: 'r2', city: 'London' }),
      makeScrape({ resultId: 'r3', city: 'Manchester' }),
      makeScrape({ resultId: 'r4' }), // no city
    ];

    const summary = computeHaulSummary(scrapes);

    expect(summary.cityDistribution).toEqual({ London: 2, Manchester: 1 });
  });

  it('counts scrapes with geo', () => {
    const scrapes = [
      makeScrape({ latitude: 51.5, longitude: -0.1 }),
      makeScrape({ resultId: 'r2', latitude: 0, longitude: 0 }),
      makeScrape({ resultId: 'r3' }),
      makeScrape({ resultId: 'r4', latitude: 40.7, longitude: -74.0 }),
    ];

    const summary = computeHaulSummary(scrapes);

    expect(summary.scrapesWithGeo).toBe(2);
  });

  it('handles scrapes with no enriched data', () => {
    const scrapes = [
      makeScrape(),
      makeScrape({ resultId: 'r2', grade: 'B' }),
    ];

    const summary = computeHaulSummary(scrapes);

    expect(summary.totalScrapes).toBe(2);
    expect(summary.priceRange).toBeNull();
    expect(summary.gradeDistribution).toEqual({ A: 1, B: 1 });
    expect(summary.scrapesWithGeo).toBe(0);
  });
});
