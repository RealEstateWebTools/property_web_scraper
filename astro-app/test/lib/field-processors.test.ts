import { describe, it, expect } from 'vitest';
import { stripTags, booleanEvaluators, sanitizePropertyHash } from '../../src/lib/extractor/field-processors.js';

describe('stripTags', () => {
  it('removes all HTML tags leaving only text', () => {
    expect(stripTags('<p>Hello <b>world</b></p>')).toBe('Hello world');
  });

  it('returns empty string for empty input', () => {
    expect(stripTags('')).toBe('');
  });

  it('trims whitespace from result', () => {
    expect(stripTags('  <span> hello </span>  ')).toBe('hello');
  });

  it('handles nested tags', () => {
    expect(stripTags('<div><ul><li>item</li></ul></div>')).toBe('item');
  });

  it('handles self-closing tags', () => {
    expect(stripTags('before<br/>after')).toBe('beforeafter');
  });

  it('passes through plain text unchanged', () => {
    expect(stripTags('no tags here')).toBe('no tags here');
  });
});

describe('booleanEvaluators', () => {
  describe('include?', () => {
    it('returns true when text includes param', () => {
      expect(booleanEvaluators['include?']('hello world', 'world')).toBe(true);
    });
    it('returns false when text does not include param', () => {
      expect(booleanEvaluators['include?']('hello', 'world')).toBe(false);
    });
  });

  describe('start_with?', () => {
    it('returns true when text starts with param', () => {
      expect(booleanEvaluators['start_with?']('hello world', 'hello')).toBe(true);
    });
    it('returns false when text does not start with param', () => {
      expect(booleanEvaluators['start_with?']('hello world', 'world')).toBe(false);
    });
  });

  describe('end_with?', () => {
    it('returns true when text ends with param', () => {
      expect(booleanEvaluators['end_with?']('hello world', 'world')).toBe(true);
    });
    it('returns false when text does not end with param', () => {
      expect(booleanEvaluators['end_with?']('hello world', 'hello')).toBe(false);
    });
  });

  describe('present?', () => {
    it('returns true for non-empty trimmed string', () => {
      expect(booleanEvaluators['present?']('hello', '')).toBe(true);
    });
    it('returns false for empty string', () => {
      expect(booleanEvaluators['present?']('', '')).toBe(false);
    });
    it('returns false for whitespace-only string', () => {
      expect(booleanEvaluators['present?']('   ', '')).toBe(false);
    });
  });

  describe('to_i_gt_0', () => {
    it('returns true for positive integer string', () => {
      expect(booleanEvaluators['to_i_gt_0']('5', '')).toBe(true);
    });
    it('returns false for zero', () => {
      expect(booleanEvaluators['to_i_gt_0']('0', '')).toBe(false);
    });
    it('returns false for negative number', () => {
      expect(booleanEvaluators['to_i_gt_0']('-3', '')).toBe(false);
    });
    it('returns false for non-numeric string', () => {
      expect(booleanEvaluators['to_i_gt_0']('abc', '')).toBe(false);
    });
  });

  describe('==', () => {
    it('returns true for exact match', () => {
      expect(booleanEvaluators['==']('hello', 'hello')).toBe(true);
    });
    it('returns false for different strings', () => {
      expect(booleanEvaluators['==']('hello', 'world')).toBe(false);
    });
    it('is case-sensitive', () => {
      expect(booleanEvaluators['==']('Hello', 'hello')).toBe(false);
    });
  });
});

describe('sanitizePropertyHash', () => {
  it('strips HTML from text fields', () => {
    const hash = { title: '<b>Nice House</b>', description: '<p>Very <em>nice</em></p>' };
    const result = sanitizePropertyHash(hash);
    expect(result['title']).toBe('Nice House');
    expect(result['description']).toBe('Very nice');
  });

  it('does not modify non-text fields', () => {
    const hash = { price_float: 100000, count_bedrooms: 3 };
    const result = sanitizePropertyHash(hash);
    expect(result['price_float']).toBe(100000);
    expect(result['count_bedrooms']).toBe(3);
  });

  it('sanitizes URL fields — keeps valid http/https URLs', () => {
    const hash = { main_image_url: 'https://example.com/image.jpg' };
    const result = sanitizePropertyHash(hash);
    expect(result['main_image_url']).toBe('https://example.com/image.jpg');
  });

  it('sanitizes URL fields — fixes protocol-relative URLs', () => {
    const hash = { main_image_url: '//cdn.example.com/image.jpg' };
    const result = sanitizePropertyHash(hash);
    expect(result['main_image_url']).toBe('https://cdn.example.com/image.jpg');
  });

  it('sanitizes URL fields — rejects invalid scheme', () => {
    const hash = { main_image_url: 'javascript:alert(1)' };
    const result = sanitizePropertyHash(hash);
    expect(result['main_image_url']).toBeNull();
  });

  it('sanitizes URL fields — rejects empty URL', () => {
    const hash = { main_image_url: '' };
    const result = sanitizePropertyHash(hash);
    expect(result['main_image_url']).toBeNull();
  });

  it('sanitizes URL fields — rejects invalid URL', () => {
    const hash = { main_image_url: 'not a url at all' };
    const result = sanitizePropertyHash(hash);
    expect(result['main_image_url']).toBeNull();
  });

  it('sanitizes image_urls objects — filters out invalid URLs', () => {
    const hash = {
      image_urls: [
        { url: 'https://example.com/a.jpg' },
        { url: 'javascript:alert(1)' },
        { url: '//cdn.example.com/b.jpg' },
        { url: '' },
        { url: 'ftp://badscheme.com/c.jpg' },
        { url: 'https://example.com/d.jpg' },
      ],
    };
    const result = sanitizePropertyHash(hash);
    expect(result['image_urls']).toEqual([
      { url: 'https://example.com/a.jpg' },
      { url: 'https://cdn.example.com/b.jpg' },
      { url: 'https://example.com/d.jpg' },
    ]);
  });

  it('sanitizes image_urls objects — filters entries with null URLs', () => {
    const hash = { image_urls: [{ url: 'https://example.com/a.jpg' }, { url: '' }, { url: 'ftp://bad.com/c.jpg' }] };
    const result = sanitizePropertyHash(hash);
    expect(result['image_urls']).toEqual([{ url: 'https://example.com/a.jpg' }]);
  });

  it('strips HTML from features array', () => {
    const hash = { features: ['<b>Garden</b>', '<span>Parking</span>', 'Pool'] };
    const result = sanitizePropertyHash(hash);
    expect(result['features']).toEqual(['Garden', 'Parking', 'Pool']);
  });

  it('leaves non-string features unchanged', () => {
    const hash = { features: ['Garden', 42, null] };
    const result = sanitizePropertyHash(hash);
    expect(result['features']).toEqual(['Garden', 42, null]);
  });

  it('returns the same hash reference (mutates in place)', () => {
    const hash = { title: 'test' };
    const result = sanitizePropertyHash(hash);
    expect(result).toBe(hash);
  });
});
