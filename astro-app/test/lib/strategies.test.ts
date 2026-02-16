import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { getTextFromCss, getTextFromUrl, retrieveTargetText, cleanUpString, evaluateXPath } from '../../src/lib/extractor/strategies.js';

describe('Strategies', () => {
  describe('getTextFromCss', () => {
    it('extracts text content from a CSS selector match', () => {
      const html = '<div><h1 class="title">Hello World</h1></div>';
      const $ = cheerio.load(html);
      const elements = $('h1.title');
      const text = getTextFromCss($, elements, {});
      expect(text).toBe('Hello World');
    });

    it('extracts attribute value via cssAttr', () => {
      const html = '<div><a href="/page" class="link">Click</a></div>';
      const $ = cheerio.load(html);
      const elements = $('a.link');
      const text = getTextFromCss($, elements, { cssAttr: 'href' });
      expect(text).toBe('/page');
    });

    it('extracts attribute value via xmlAttr', () => {
      const html = '<div><img data-src="image.jpg" /></div>';
      const $ = cheerio.load(html);
      const elements = $('img');
      const text = getTextFromCss($, elements, { xmlAttr: 'data-src' });
      expect(text).toBe('image.jpg');
    });

    it('extracts text at specific index via cssCountId', () => {
      const html = '<ul><li>First</li><li>Second</li><li>Third</li></ul>';
      const $ = cheerio.load(html);
      const elements = $('li');
      const text = getTextFromCss($, elements, { cssCountId: '1' });
      expect(text).toBe('Second');
    });
  });

  describe('getTextFromUrl', () => {
    it('returns full pathname when urlPathPart is "0" or non-numeric', () => {
      const uri = new URL('https://example.com/property/123/details');
      expect(getTextFromUrl('0', uri)).toBe('/property/123/details');
    });

    it('returns specific path segment', () => {
      const uri = new URL('https://example.com/property/123/details');
      expect(getTextFromUrl('1', uri)).toBe('property');
      expect(getTextFromUrl('2', uri)).toBe('123');
      expect(getTextFromUrl('3', uri)).toBe('details');
    });
  });

  describe('cleanUpString', () => {
    it('splits text by character and selects index', () => {
      const result = cleanUpString('key:value', { splitTextCharacter: ':', splitTextArrayId: '1' });
      expect(result).toBe('value');
    });

    it('strips a substring', () => {
      const result = cleanUpString('hello_world.html', { stripString: '.html' });
      expect(result).toBe('hello_world');
    });

    it('handles combined split + strip', () => {
      const result = cleanUpString('property-51775029.html', {
        splitTextCharacter: '-',
        splitTextArrayId: '1',
        stripString: '.html',
      });
      expect(result).toBe('51775029');
    });
  });

  describe('evaluateXPath', () => {
    it('evaluates an XPath expression on HTML', () => {
      const html = '<html><head><meta name="description" content="A lovely house" /></head><body></body></html>';
      const result = evaluateXPath(html, "//meta[@name='description']/@content");
      expect(result).toBe('A lovely house');
    });

    it('returns empty string for no matches', () => {
      const html = '<html><body><p>Hello</p></body></html>';
      const result = evaluateXPath(html, "//meta[@name='nonexistent']/@content");
      expect(result).toBe('');
    });
  });

  describe('retrieveTargetText', () => {
    it('uses CSS selector strategy', () => {
      const html = '<div><span class="price">$500,000</span></div>';
      const $ = cheerio.load(html);
      const uri = new URL('https://example.com/property/1');
      const text = retrieveTargetText($, html, { cssLocator: 'span.price' }, uri);
      expect(text).toBe('$500,000');
    });

    it('uses regex strategy on script content', () => {
      const html = '<html><body><script>var config = { latitude:"40.42", longitude:"-3.67" };</script></body></html>';
      const $ = cheerio.load(html);
      const uri = new URL('https://example.com');
      const text = retrieveTargetText($, html, {
        scriptRegEx: 'latitude:[^,]*',
        splitTextCharacter: '"',
        splitTextArrayId: '1',
      }, uri);
      expect(text).toBe('40.42');
    });

    it('uses URL path strategy', () => {
      const html = '<html></html>';
      const $ = cheerio.load(html);
      const uri = new URL('https://example.com/property-to-rent/property-123.html');
      const text = retrieveTargetText($, html, {
        urlPathPart: '2',
        splitTextCharacter: '-',
        splitTextArrayId: '1',
        stripString: '.html',
      }, uri);
      expect(text).toBe('123');
    });
  });
});
