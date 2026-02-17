import { describe, it, expect } from 'vitest';
import { validateUrl, MISSING, INVALID, UNSUPPORTED } from '../../src/lib/services/url-validator.js';

describe('url-validator', () => {
  describe('missing URL', () => {
    it('returns MISSING when url is null', async () => {
      const result = await validateUrl(null);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe(MISSING);
    });

    it('returns MISSING when url is undefined', async () => {
      const result = await validateUrl(undefined);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe(MISSING);
    });

    it('returns MISSING when url is empty string', async () => {
      const result = await validateUrl('');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe(MISSING);
    });

    it('returns MISSING when url is whitespace only', async () => {
      const result = await validateUrl('   ');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe(MISSING);
    });
  });

  describe('invalid URL', () => {
    it('returns INVALID for non-parseable string', async () => {
      const result = await validateUrl('not-a-url');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe(INVALID);
    });

    it('returns INVALID for ftp:// protocol', async () => {
      const result = await validateUrl('ftp://files.example.com/listing');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe(INVALID);
    });

    it('returns INVALID for javascript: protocol', async () => {
      const result = await validateUrl('javascript:alert(1)');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe(INVALID);
    });
  });

  describe('unsupported host', () => {
    it('returns UNSUPPORTED for unknown host', async () => {
      const result = await validateUrl('https://www.unknown-site.com/listing/1');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe(UNSUPPORTED);
    });
  });

  describe('valid URL', () => {
    it('accepts idealista URL', async () => {
      const result = await validateUrl('https://www.idealista.com/inmueble/12345/');
      expect(result.valid).toBe(true);
      expect(result.uri).toBeInstanceOf(URL);
      expect(result.importHost).toBeDefined();
      expect(result.importHost!.scraper_name).toBe('es_idealista');
    });

    it('accepts rightmove URL', async () => {
      const result = await validateUrl('https://www.rightmove.co.uk/properties/123');
      expect(result.valid).toBe(true);
      expect(result.importHost!.scraper_name).toBe('uk_rightmove');
    });

    it('accepts URL with leading/trailing whitespace', async () => {
      const result = await validateUrl('  https://www.idealista.com/inmueble/12345/  ');
      expect(result.valid).toBe(true);
      expect(result.importHost!.scraper_name).toBe('es_idealista');
    });

    it('accepts http:// URLs', async () => {
      const result = await validateUrl('http://www.idealista.com/inmueble/12345/');
      expect(result.valid).toBe(true);
    });

    it('accepts URLs without www prefix', async () => {
      const result = await validateUrl('https://idealista.com/inmueble/12345/');
      expect(result.valid).toBe(true);
      expect(result.importHost!.scraper_name).toBe('es_idealista');
    });
  });

  describe('error code constants', () => {
    it('exports expected constant values', () => {
      expect(MISSING).toBe('missing');
      expect(INVALID).toBe('invalid');
      expect(UNSUPPORTED).toBe('unsupported');
    });
  });
});
