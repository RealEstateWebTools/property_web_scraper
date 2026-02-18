import { describe, it, expect } from 'vitest';
import { detectListingType } from '../../src/lib/extractor/listing-type-detector.js';

describe('listing-type-detector', () => {
  describe('detectListingType', () => {
    it('returns "rental" when for_rent_long_term is true', () => {
      expect(detectListingType({ for_rent_long_term: true })).toBe('rental');
    });

    it('returns "rental" when for_rent_short_term is true', () => {
      expect(detectListingType({ for_rent_short_term: true })).toBe('rental');
    });

    it('returns "sale" when for_sale is true', () => {
      expect(detectListingType({ for_sale: true })).toBe('sale');
    });

    it('prefers rental booleans over for_sale', () => {
      expect(detectListingType({
        for_sale: true,
        for_rent_long_term: true,
      })).toBe('rental');
    });

    it('detects rental from URL path /rent', () => {
      expect(detectListingType({}, 'https://example.com/property/to-rent/123')).toBe('rental');
    });

    it('detects rental from URL path /for-rent', () => {
      expect(detectListingType({}, 'https://example.com/for-rent/apartments')).toBe('rental');
    });

    it('detects rental from Spanish URL /alquiler', () => {
      expect(detectListingType({}, 'https://idealista.com/inmueble/alquiler/madrid')).toBe('rental');
    });

    it('detects rental from French URL /location', () => {
      expect(detectListingType({}, 'https://seloger.com/annonces/location/paris')).toBe('rental');
    });

    it('detects rental from German URL /miete', () => {
      expect(detectListingType({}, 'https://immoscout24.de/wohnung/miete/berlin')).toBe('rental');
    });

    it('detects rental from Italian URL /affitto', () => {
      expect(detectListingType({}, 'https://immobiliare.it/annunci/affitto/roma')).toBe('rental');
    });

    it('detects rental from Portuguese URL /arrendamento', () => {
      expect(detectListingType({}, 'https://idealista.pt/imovel/arrendamento/lisboa')).toBe('rental');
    });

    it('defaults to "sale" when no signals', () => {
      expect(detectListingType({})).toBe('sale');
      expect(detectListingType({}, 'https://example.com/property/123')).toBe('sale');
    });

    it('booleans take priority over URL patterns', () => {
      // for_sale=true should override a rental URL
      expect(detectListingType(
        { for_sale: true },
        'https://example.com/to-rent/123',
      )).toBe('sale');
    });

    it('handles invalid URL gracefully', () => {
      expect(detectListingType({}, 'not-a-url')).toBe('sale');
    });

    it('handles missing URL', () => {
      expect(detectListingType({})).toBe('sale');
      expect(detectListingType({}, undefined)).toBe('sale');
    });
  });
});
