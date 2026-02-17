import { describe, it, expect } from 'vitest';
import {
  normalizeImageUrl,
  normalizeImageUrls,
} from '../../src/lib/extractor/image-normalizer.js';

describe('image-normalizer', () => {
  describe('normalizeImageUrl', () => {
    it('enforces HTTPS by default', () => {
      expect(normalizeImageUrl('http://cdn.example.com/img.jpg')).toBe(
        'https://cdn.example.com/img.jpg',
      );
    });

    it('converts protocol-relative URLs to HTTPS', () => {
      expect(normalizeImageUrl('//cdn.example.com/img.jpg')).toBe(
        'https://cdn.example.com/img.jpg',
      );
    });

    it('returns null for invalid URLs', () => {
      expect(normalizeImageUrl('not a url at all')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(normalizeImageUrl('')).toBeNull();
    });

    it('returns null for whitespace-only string', () => {
      expect(normalizeImageUrl('   ')).toBeNull();
    });

    it('passes through valid HTTPS URLs unchanged', () => {
      expect(normalizeImageUrl('https://cdn.example.com/img.jpg')).toBe(
        'https://cdn.example.com/img.jpg',
      );
    });

    it('rejects disallowed file extensions', () => {
      expect(normalizeImageUrl('https://example.com/file.exe')).toBeNull();
      expect(normalizeImageUrl('https://example.com/file.pdf')).toBeNull();
      expect(normalizeImageUrl('https://example.com/file.zip')).toBeNull();
    });

    it('allows common image extensions', () => {
      expect(normalizeImageUrl('https://example.com/photo.jpg')).toBe(
        'https://example.com/photo.jpg',
      );
      expect(normalizeImageUrl('https://example.com/photo.png')).toBe(
        'https://example.com/photo.png',
      );
      expect(normalizeImageUrl('https://example.com/photo.webp')).toBe(
        'https://example.com/photo.webp',
      );
    });

    it('allows URLs without file extensions', () => {
      expect(normalizeImageUrl('https://cdn.example.com/images/12345')).toBe(
        'https://cdn.example.com/images/12345',
      );
    });

    it('applies thumbnail pattern replacements', () => {
      const result = normalizeImageUrl('https://cdn.example.com/thumb_photo.jpg', {
        thumbnailPatterns: [{ match: 'thumb_', replace: 'full_' }],
      });
      expect(result).toBe('https://cdn.example.com/full_photo.jpg');
    });

    it('applies multiple thumbnail patterns', () => {
      const result = normalizeImageUrl('https://cdn.example.com/thumb_small_photo.jpg', {
        thumbnailPatterns: [
          { match: 'thumb_', replace: '' },
          { match: 'small_', replace: 'large_' },
        ],
      });
      expect(result).toBe('https://cdn.example.com/large_photo.jpg');
    });

    it('does not enforce HTTPS when explicitly disabled', () => {
      expect(
        normalizeImageUrl('http://cdn.example.com/img.jpg', { enforceHttps: false }),
      ).toBe('http://cdn.example.com/img.jpg');
    });

    it('rejects non-http protocols', () => {
      expect(normalizeImageUrl('ftp://example.com/img.jpg')).toBeNull();
      expect(normalizeImageUrl('data:image/png;base64,abc')).toBeNull();
    });
  });

  describe('normalizeImageUrls', () => {
    it('normalizes an array of URLs and filters out nulls', () => {
      const urls = [
        'http://example.com/a.jpg',
        '',
        '//cdn.example.com/b.png',
        'not-a-url',
        'https://example.com/c.webp',
      ];
      const result = normalizeImageUrls(urls);
      expect(result).toEqual([
        'https://example.com/a.jpg',
        'https://cdn.example.com/b.png',
        'https://example.com/c.webp',
      ]);
    });

    it('returns empty array when all URLs are invalid', () => {
      expect(normalizeImageUrls(['', 'bad-url', 'ftp://x.com/a.jpg'])).toEqual([]);
    });

    it('returns empty array for empty input', () => {
      expect(normalizeImageUrls([])).toEqual([]);
    });

    it('passes options through to normalizeImageUrl', () => {
      const result = normalizeImageUrls(
        ['https://cdn.example.com/thumb_a.jpg', 'https://cdn.example.com/thumb_b.png'],
        { thumbnailPatterns: [{ match: 'thumb_', replace: 'full_' }] },
      );
      expect(result).toEqual([
        'https://cdn.example.com/full_a.jpg',
        'https://cdn.example.com/full_b.png',
      ]);
    });
  });
});
