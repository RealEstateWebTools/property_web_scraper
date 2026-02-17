import { describe, it, expect } from 'vitest';
import { sanitizePropertyHash } from '../../src/lib/services/content-sanitizer.js';

describe('sanitizePropertyHash', () => {
  it('strips HTML tags from text fields', () => {
    const input = {
      title: '<b>Nice</b> apartment <script>alert("xss")</script>',
      description: '<p>A lovely <em>home</em></p>',
      city: 'Madrid',
    };
    const result = sanitizePropertyHash(input);
    expect(result.title).toBe('Nice apartment');
    expect(result.description).toBe('A lovely home');
    expect(result.city).toBe('Madrid');
  });

  it('rejects dangerous URL schemes in URL fields', () => {
    const input = {
      main_image_url: 'javascript:alert("xss")',
    };
    const result = sanitizePropertyHash(input);
    expect(result.main_image_url).toBe('');
  });

  it('rejects data: URLs', () => {
    const input = {
      main_image_url: 'data:text/html,<h1>xss</h1>',
    };
    const result = sanitizePropertyHash(input);
    expect(result.main_image_url).toBe('');
  });

  it('allows valid https URLs', () => {
    const input = {
      main_image_url: 'https://example.com/image.jpg',
    };
    const result = sanitizePropertyHash(input);
    expect(result.main_image_url).toBe('https://example.com/image.jpg');
  });

  it('fixes protocol-relative URLs', () => {
    const input = {
      main_image_url: '//cdn.example.com/image.jpg',
    };
    const result = sanitizePropertyHash(input);
    expect(result.main_image_url).toBe('https://cdn.example.com/image.jpg');
  });

  it('filters invalid URLs from image_urls objects', () => {
    const input = {
      image_urls: [
        { url: 'https://example.com/1.jpg' },
        { url: 'javascript:alert(1)' },
        { url: 'https://example.com/2.jpg' },
        { url: 'data:text/html,bad' },
        { url: '//cdn.example.com/3.jpg' },
      ],
    };
    const result = sanitizePropertyHash(input);
    expect(result.image_urls).toEqual([
      { url: 'https://example.com/1.jpg' },
      { url: 'https://example.com/2.jpg' },
      { url: 'https://cdn.example.com/3.jpg' },
    ]);
  });

  it('sanitizes features array', () => {
    const input = {
      features: ['<b>Pool</b>', 'Garden', '<script>evil</script>Garage'],
    };
    const result = sanitizePropertyHash(input);
    expect(result.features).toEqual(['Pool', 'Garden', 'Garage']);
  });

  it('passes through non-text fields unchanged', () => {
    const input = {
      price_float: 250000,
      latitude: 40.4168,
      for_sale: true,
      count_bedrooms: 3,
    };
    const result = sanitizePropertyHash(input);
    expect(result.price_float).toBe(250000);
    expect(result.latitude).toBe(40.4168);
    expect(result.for_sale).toBe(true);
    expect(result.count_bedrooms).toBe(3);
  });
});
