import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { extractFeatures } from '../../src/lib/extractor/feature-extractor.js';
import type { FieldMapping } from '../../src/lib/extractor/mapping-loader.js';

function makeMapping(overrides: Partial<FieldMapping> = {}): FieldMapping {
  return { cssLocator: 'li.feature', ...overrides };
}

describe('extractFeatures', () => {
  it('extracts feature text from multiple matching elements', () => {
    const html = '<ul><li class="feature">Garden</li><li class="feature">Parking</li><li class="feature">Pool</li></ul>';
    const $ = cheerio.load(html);
    const uri = new URL('https://example.com/listing/1');
    const mapping = makeMapping();

    const result = extractFeatures($, mapping, uri);
    expect(result).toEqual(['Garden', 'Parking', 'Pool']);
  });

  it('returns empty array when no elements match', () => {
    const html = '<html><body><p>No features here</p></body></html>';
    const $ = cheerio.load(html);
    const uri = new URL('https://example.com/listing/1');
    const mapping = makeMapping();

    const result = extractFeatures($, mapping, uri);
    expect(result).toEqual([]);
  });

  it('returns empty array when no cssLocator is set', () => {
    const html = '<ul><li class="feature">Garden</li></ul>';
    const $ = cheerio.load(html);
    const uri = new URL('https://example.com/listing/1');
    const mapping: FieldMapping = {};

    const result = extractFeatures($, mapping, uri);
    expect(result).toEqual([]);
  });

  it('applies cleanUpString post-processing (stripString)', () => {
    const html = '<ul><li class="feature">Garden - details</li></ul>';
    const $ = cheerio.load(html);
    const uri = new URL('https://example.com/listing/1');
    const mapping = makeMapping({ stripString: ' - details' });

    const result = extractFeatures($, mapping, uri);
    expect(result).toEqual(['Garden']);
  });

  it('applies cleanUpString post-processing (splitTextCharacter)', () => {
    const html = '<ul><li class="feature">Garden|Parking</li></ul>';
    const $ = cheerio.load(html);
    const uri = new URL('https://example.com/listing/1');
    const mapping = makeMapping({ splitTextCharacter: '|', splitTextArrayId: '0' });

    const result = extractFeatures($, mapping, uri);
    expect(result).toEqual(['Garden']);
  });

  it('uses cssAttr to get attribute value', () => {
    const html = '<ul><li class="feature" data-name="Swimming Pool">text</li></ul>';
    const $ = cheerio.load(html);
    const uri = new URL('https://example.com/listing/1');
    const mapping = makeMapping({ cssAttr: 'data-name' });

    const result = extractFeatures($, mapping, uri);
    expect(result).toEqual(['Swimming Pool']);
  });
});
