import { describe, it, expect } from 'vitest';
import { mergeListings } from '../../src/lib/services/listing-merger.js';
import type { ExtractionResult } from '../../src/lib/extractor/html-extractor.js';

function makeResult(
  overrides: Partial<ExtractionResult> & { properties: Record<string, unknown>[] },
): ExtractionResult {
  return {
    success: true,
    status: 'full',
    warnings: [],
    fingerprint: overrides.fingerprint || 'abc123',
    ...overrides,
  };
}

describe('listing-merger', () => {
  describe('mergeListings', () => {
    it('passes a single result through unchanged', () => {
      const result = makeResult({
        properties: [{ title: 'Lovely flat', price_float: 250000 }],
        fingerprint: 'fp1',
      });
      const merged = mergeListings([{ sourceUrl: 'https://a.com/1', result }]);
      expect(merged).toHaveLength(1);
      expect(merged[0].fingerprint).toBe('fp1');
      expect(merged[0].properties.title).toBe('Lovely flat');
      expect(merged[0].properties.price_float).toBe(250000);
      expect(merged[0].sources).toEqual(['https://a.com/1']);
    });

    it('merges two results with the same fingerprint', () => {
      const resultA = makeResult({
        properties: [{ title: 'Lovely flat', price_float: 250000, address_string: '10 Main St' }],
        fingerprint: 'fp1',
      });
      const resultB = makeResult({
        properties: [{ title: 'Lovely flat', price_float: 250000 }],
        fingerprint: 'fp1',
      });
      const merged = mergeListings([
        { sourceUrl: 'https://a.com/1', result: resultA },
        { sourceUrl: 'https://b.com/1', result: resultB },
      ]);
      expect(merged).toHaveLength(1);
      expect(merged[0].sources).toContain('https://a.com/1');
      expect(merged[0].sources).toContain('https://b.com/1');
    });

    it('prefers the source with more populated fields', () => {
      const sparse = makeResult({
        properties: [{ title: 'Flat', price_float: 0 }],
        fingerprint: 'fp1',
      });
      const rich = makeResult({
        properties: [
          { title: 'Lovely flat', price_float: 250000, address_string: '10 Main St', count_bedrooms: 3 },
        ],
        fingerprint: 'fp1',
      });
      const merged = mergeListings([
        { sourceUrl: 'https://sparse.com/1', result: sparse },
        { sourceUrl: 'https://rich.com/1', result: rich },
      ]);
      expect(merged).toHaveLength(1);
      expect(merged[0].properties.title).toBe('Lovely flat');
      expect(merged[0].properties.price_float).toBe(250000);
      expect(merged[0].properties.address_string).toBe('10 Main St');
    });

    it('fills gaps from secondary source', () => {
      const primary = makeResult({
        properties: [{ title: 'Lovely flat', price_float: 250000, description: '' }],
        fingerprint: 'fp1',
      });
      const secondary = makeResult({
        properties: [
          { title: 'Flat', price_float: 250000, description: 'A wonderful place to live', agent_name: 'ABC Estates' },
        ],
        fingerprint: 'fp1',
      });
      const merged = mergeListings([
        { sourceUrl: 'https://a.com/1', result: primary },
        { sourceUrl: 'https://b.com/1', result: secondary },
      ]);
      expect(merged).toHaveLength(1);
      // Primary has more populated fields for title (non-empty), so it is the base
      // But description is empty on primary, so it should be filled from secondary
      expect(merged[0].properties.description).toBe('A wonderful place to live');
      // agent_name only exists on secondary, so it should be filled in
      expect(merged[0].properties.agent_name).toBe('ABC Estates');
    });

    it('excludes failed results', () => {
      const success = makeResult({
        properties: [{ title: 'Flat', price_float: 200000 }],
        fingerprint: 'fp1',
      });
      const failed = makeResult({
        success: false,
        status: 'failed',
        properties: [{ title: 'Error' }],
        fingerprint: 'fp1',
      });
      const merged = mergeListings([
        { sourceUrl: 'https://a.com/1', result: success },
        { sourceUrl: 'https://b.com/1', result: failed },
      ]);
      expect(merged).toHaveLength(1);
      expect(merged[0].sources).toEqual(['https://a.com/1']);
    });

    it('excludes results with empty properties array', () => {
      const empty = makeResult({
        properties: [],
        fingerprint: 'fp1',
      });
      const merged = mergeListings([{ sourceUrl: 'https://a.com/1', result: empty }]);
      expect(merged).toHaveLength(0);
    });

    it('keeps results with different fingerprints separate', () => {
      const resultA = makeResult({
        properties: [{ title: 'Flat A', price_float: 200000 }],
        fingerprint: 'fp1',
      });
      const resultB = makeResult({
        properties: [{ title: 'Flat B', price_float: 300000 }],
        fingerprint: 'fp2',
      });
      const merged = mergeListings([
        { sourceUrl: 'https://a.com/1', result: resultA },
        { sourceUrl: 'https://b.com/1', result: resultB },
      ]);
      expect(merged).toHaveLength(2);
      const fps = merged.map((m) => m.fingerprint);
      expect(fps).toContain('fp1');
      expect(fps).toContain('fp2');
    });

    it('sources array contains all source URLs for merged listings', () => {
      const resultA = makeResult({
        properties: [{ title: 'Flat', price_float: 200000 }],
        fingerprint: 'fp1',
      });
      const resultB = makeResult({
        properties: [{ title: 'Flat', price_float: 200000 }],
        fingerprint: 'fp1',
      });
      const resultC = makeResult({
        properties: [{ title: 'Flat', price_float: 200000 }],
        fingerprint: 'fp1',
      });
      const merged = mergeListings([
        { sourceUrl: 'https://portal1.com/1', result: resultA },
        { sourceUrl: 'https://portal2.com/1', result: resultB },
        { sourceUrl: 'https://portal3.com/1', result: resultC },
      ]);
      expect(merged).toHaveLength(1);
      expect(merged[0].sources).toHaveLength(3);
      expect(merged[0].sources).toContain('https://portal1.com/1');
      expect(merged[0].sources).toContain('https://portal2.com/1');
      expect(merged[0].sources).toContain('https://portal3.com/1');
    });
  });
});
