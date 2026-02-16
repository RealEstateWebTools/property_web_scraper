import { describe, it, expect } from 'vitest';
import { canonicalizeUrl, deduplicationKey } from '../../src/lib/services/url-canonicalizer.js';

describe('url-canonicalizer', () => {
  describe('canonicalizeUrl', () => {
    it('normalizes protocol to https', () => {
      const result = canonicalizeUrl('http://www.rightmove.co.uk/properties/123');
      expect(result).toMatch(/^https:\/\//);
    });

    it('lowercases hostname', () => {
      const result = canonicalizeUrl('https://WWW.Rightmove.CO.UK/properties/123');
      expect(result).toContain('www.rightmove.co.uk');
    });

    it('removes utm_source param', () => {
      const result = canonicalizeUrl('https://example.com/page?utm_source=google&id=5');
      expect(result).not.toContain('utm_source');
      expect(result).toContain('id=5');
    });

    it('removes utm_medium param', () => {
      const result = canonicalizeUrl('https://example.com/page?utm_medium=cpc');
      expect(result).not.toContain('utm_medium');
    });

    it('removes utm_campaign param', () => {
      const result = canonicalizeUrl('https://example.com/page?utm_campaign=spring');
      expect(result).not.toContain('utm_campaign');
    });

    it('removes fbclid param', () => {
      const result = canonicalizeUrl('https://example.com/page?fbclid=abc123&id=5');
      expect(result).not.toContain('fbclid');
      expect(result).toContain('id=5');
    });

    it('removes gclid param', () => {
      const result = canonicalizeUrl('https://example.com/page?gclid=xyz');
      expect(result).not.toContain('gclid');
    });

    it('removes ref and source params', () => {
      const result = canonicalizeUrl('https://example.com/page?ref=home&source=nav&id=1');
      expect(result).not.toContain('ref=');
      expect(result).not.toContain('source=');
      expect(result).toContain('id=1');
    });

    it('removes fragment', () => {
      const result = canonicalizeUrl('https://example.com/page#section');
      expect(result).not.toContain('#');
    });

    it('preserves non-tracking params', () => {
      const result = canonicalizeUrl('https://example.com/page?id=123&type=sale');
      expect(result).toContain('id=123');
      expect(result).toContain('type=sale');
    });

    it('strips trailing slash when enabled', () => {
      const result = canonicalizeUrl('https://example.com/page/', true);
      expect(result).not.toMatch(/\/$/);
    });

    it('keeps trailing slash when disabled', () => {
      const result = canonicalizeUrl('https://example.com/page/', false);
      expect(result).toMatch(/\/$/);
    });

    it('does not strip root path slash', () => {
      const result = canonicalizeUrl('https://example.com/', true);
      expect(result).toMatch(/\/$/);
    });

    it('returns original string for invalid URL', () => {
      expect(canonicalizeUrl('not-a-url')).toBe('not-a-url');
    });

    it('handles URL with no params', () => {
      const result = canonicalizeUrl('https://example.com/properties/123');
      expect(result).toBe('https://example.com/properties/123');
    });

    it('removes all tracking params at once', () => {
      const url = 'https://example.com/p?utm_source=g&utm_medium=c&utm_campaign=s&fbclid=x&gclid=y&ref=z&source=a&channel=b&id=1';
      const result = canonicalizeUrl(url);
      expect(result).not.toContain('utm_');
      expect(result).not.toContain('fbclid');
      expect(result).not.toContain('gclid');
      expect(result).not.toContain('ref=');
      expect(result).not.toContain('source=');
      expect(result).not.toContain('channel=');
      expect(result).toContain('id=1');
    });
  });

  describe('deduplicationKey', () => {
    it('returns hostname + pathname', () => {
      const key = deduplicationKey('https://www.rightmove.co.uk/properties/123');
      expect(key).toBe('www.rightmove.co.uk/properties/123');
    });

    it('ignores query params', () => {
      const key1 = deduplicationKey('https://example.com/p/1?utm_source=google');
      const key2 = deduplicationKey('https://example.com/p/1?ref=home');
      expect(key1).toBe(key2);
    });

    it('ignores protocol differences', () => {
      const key1 = deduplicationKey('http://example.com/page');
      const key2 = deduplicationKey('https://example.com/page');
      expect(key1).toBe(key2);
    });

    it('ignores fragment', () => {
      const key1 = deduplicationKey('https://example.com/page#top');
      const key2 = deduplicationKey('https://example.com/page');
      expect(key1).toBe(key2);
    });

    it('lowercases hostname', () => {
      const key = deduplicationKey('https://WWW.Example.COM/Page');
      expect(key).toBe('www.example.com/Page');
    });

    it('returns original string for invalid URL', () => {
      expect(deduplicationKey('not-a-url')).toBe('not-a-url');
    });

    it('same listing URL with different tracking params produces same key', () => {
      const key1 = deduplicationKey('https://www.idealista.com/inmueble/12345/?utm_source=google&fbclid=abc');
      const key2 = deduplicationKey('https://www.idealista.com/inmueble/12345/');
      expect(key1).toBe(key2);
    });
  });
});
