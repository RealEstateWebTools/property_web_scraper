import { describe, it, expect } from 'vitest';
import { applyFilters } from '../../src/lib/extractor/result-filter.js';

describe('result-filter', () => {
  describe('applyFilters', () => {
    it('passes with no filters', () => {
      const result = applyFilters({ title: 'Nice flat', price_float: 200000 }, {});
      expect(result.passed).toBe(true);
      expect(result.reasons).toEqual([]);
    });

    it('rejects when excludeTerms matches in title', () => {
      const result = applyFilters(
        { title: 'Lovely garage for sale', description: '' },
        { excludeTerms: ['garage'] },
      );
      expect(result.passed).toBe(false);
      expect(result.reasons).toContainEqual(expect.stringContaining('garage'));
    });

    it('rejects when excludeTerms matches in description', () => {
      const result = applyFilters(
        { title: 'Nice flat', description: 'Includes a large garage space' },
        { excludeTerms: ['garage'] },
      );
      expect(result.passed).toBe(false);
      expect(result.reasons).toContainEqual(expect.stringContaining('garage'));
    });

    it('excludeTerms matching is case insensitive', () => {
      const result = applyFilters(
        { title: 'GARAGE conversion', description: '' },
        { excludeTerms: ['garage'] },
      );
      expect(result.passed).toBe(false);
    });

    it('rejects when price is below minPrice', () => {
      const result = applyFilters(
        { title: 'Flat', price_float: 50000 },
        { minPrice: 100000 },
      );
      expect(result.passed).toBe(false);
      expect(result.reasons).toContainEqual(expect.stringContaining('below minimum'));
    });

    it('rejects when price is above maxPrice', () => {
      const result = applyFilters(
        { title: 'Mansion', price_float: 5000000 },
        { maxPrice: 1000000 },
      );
      expect(result.passed).toBe(false);
      expect(result.reasons).toContainEqual(expect.stringContaining('above maximum'));
    });

    it('passes when price is within range', () => {
      const result = applyFilters(
        { title: 'Flat', price_float: 250000 },
        { minPrice: 100000, maxPrice: 500000 },
      );
      expect(result.passed).toBe(true);
      expect(result.reasons).toEqual([]);
    });

    it('rejects when bedrooms is below minBedrooms', () => {
      const result = applyFilters(
        { title: 'Studio', count_bedrooms: 0 },
        { minBedrooms: 2 },
      );
      expect(result.passed).toBe(false);
      expect(result.reasons).toContainEqual(expect.stringContaining('below minimum'));
    });

    it('passes when bedrooms meets minBedrooms', () => {
      const result = applyFilters(
        { title: 'House', count_bedrooms: 3 },
        { minBedrooms: 2 },
      );
      expect(result.passed).toBe(true);
    });

    it('rejects when a required field is missing', () => {
      const result = applyFilters(
        { title: 'Flat' },
        { requiredFields: ['price_float'] },
      );
      expect(result.passed).toBe(false);
      expect(result.reasons).toContainEqual(expect.stringContaining('price_float'));
    });

    it('passes when required fields are present', () => {
      const result = applyFilters(
        { title: 'Flat', price_float: 200000, address_string: '10 Main St' },
        { requiredFields: ['title', 'price_float', 'address_string'] },
      );
      expect(result.passed).toBe(true);
    });

    it('accumulates multiple failure reasons', () => {
      const result = applyFilters(
        { title: 'Garage studio', price_float: 50000, count_bedrooms: 0 },
        {
          excludeTerms: ['garage'],
          minPrice: 100000,
          minBedrooms: 1,
          requiredFields: ['address_string'],
        },
      );
      expect(result.passed).toBe(false);
      expect(result.reasons.length).toBeGreaterThanOrEqual(3);
    });

    it('treats zero price as not triggering min/max filters', () => {
      // When price is 0, the filter skips price checks (price > 0 guard)
      const result = applyFilters(
        { title: 'Flat', price_float: 0 },
        { minPrice: 100000 },
      );
      expect(result.passed).toBe(true);
    });
  });
});
