import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { extractImages } from '../../src/lib/extractor/image-extractor.js';
import type { FieldMapping } from '../../src/lib/extractor/mapping-loader.js';

function makeMapping(overrides: Partial<FieldMapping> = {}): FieldMapping {
  return { cssLocator: 'img', cssAttr: 'src', ...overrides };
}

describe('extractImages', () => {
  it('extracts image URLs from CSS selector', () => {
    const html = '<html><body><img src="https://example.com/a.jpg"><img src="https://example.com/b.jpg"></body></html>';
    const $ = cheerio.load(html);
    const uri = new URL('https://example.com/listing/1');
    const mapping = makeMapping();

    const result = extractImages($, html, mapping, uri);
    expect(result).toEqual([{ url: 'https://example.com/a.jpg' }, { url: 'https://example.com/b.jpg' }]);
  });

  it('converts relative URLs to absolute using source URL', () => {
    const html = '<html><body><img src="/images/photo.jpg"></body></html>';
    const $ = cheerio.load(html);
    const uri = new URL('https://example.com/listing/1');
    const mapping = makeMapping();

    const result = extractImages($, html, mapping, uri);
    expect(result).toEqual([{ url: 'https://example.com/images/photo.jpg' }]);
  });

  it('applies imagePathPrefix to relative URLs', () => {
    const html = '<html><body><img src="/photo.jpg"></body></html>';
    const $ = cheerio.load(html);
    const uri = new URL('https://example.com/listing/1');
    const mapping = makeMapping({ imagePathPrefix: '/cdn' });

    const result = extractImages($, html, mapping, uri);
    expect(result).toEqual([{ url: 'https://example.com/cdn/photo.jpg' }]);
  });

  it('does not apply imagePathPrefix to absolute URLs', () => {
    const html = '<html><body><img src="https://cdn.example.com/photo.jpg"></body></html>';
    const $ = cheerio.load(html);
    const uri = new URL('https://example.com/listing/1');
    const mapping = makeMapping({ imagePathPrefix: '/cdn' });

    const result = extractImages($, html, mapping, uri);
    expect(result).toEqual([{ url: 'https://cdn.example.com/photo.jpg' }]);
  });

  it('returns empty array when no elements match', () => {
    const html = '<html><body><p>No images here</p></body></html>';
    const $ = cheerio.load(html);
    const uri = new URL('https://example.com/listing/1');
    const mapping = makeMapping();

    const result = extractImages($, html, mapping, uri);
    expect(result).toEqual([]);
  });

  it('returns empty array when no cssLocator is set', () => {
    const html = '<html><body><img src="https://example.com/a.jpg"></body></html>';
    const $ = cheerio.load(html);
    const uri = new URL('https://example.com/listing/1');
    const mapping = makeMapping({ cssLocator: undefined });

    const result = extractImages($, html, mapping, uri);
    expect(result).toEqual([]);
  });

  it('applies cleanUpString post-processing (stripString)', () => {
    const html = '<html><body><img src="https://example.com/photo.jpg?v=123"></body></html>';
    const $ = cheerio.load(html);
    const uri = new URL('https://example.com/listing/1');
    const mapping = makeMapping({ stripString: '?v=123' });

    const result = extractImages($, html, mapping, uri);
    expect(result).toEqual([{ url: 'https://example.com/photo.jpg' }]);
  });

  it('warns but does not crash on xpath mapping', () => {
    const html = '<html><body><img src="https://example.com/a.jpg"></body></html>';
    const $ = cheerio.load(html);
    const uri = new URL('https://example.com/listing/1');
    const mapping = makeMapping({ xpath: '//img/@src' });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = extractImages($, html, mapping, uri);
    expect(result).toHaveLength(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('XPath is no longer supported'));
    warnSpy.mockRestore();
  });

  it('uses cssAttr to get attribute value instead of text', () => {
    const html = '<html><body><div class="img" data-src="https://example.com/lazy.jpg">text</div></body></html>';
    const $ = cheerio.load(html);
    const uri = new URL('https://example.com/listing/1');
    const mapping: FieldMapping = { cssLocator: 'div.img', cssAttr: 'data-src' };

    const result = extractImages($, html, mapping, uri);
    expect(result).toEqual([{ url: 'https://example.com/lazy.jpg' }]);
  });
});
