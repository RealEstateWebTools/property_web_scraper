import { describe, it, expect } from 'vitest';
import { splitPropertyHash } from '../../src/lib/extractor/schema-splitter.js';

describe('schema-splitter', () => {
  describe('splitPropertyHash', () => {
    it('puts asset fields into assetData', () => {
      const hash = {
        title: 'Nice flat',
        description: 'A lovely property',
        count_bedrooms: 3,
        count_bathrooms: 2,
        latitude: 51.5,
        longitude: -0.1,
      };

      const result = splitPropertyHash(hash);
      expect(result.assetData).toEqual(hash);
      expect(Object.keys(result.listingData)).toHaveLength(0);
      expect(Object.keys(result.unmapped)).toHaveLength(0);
    });

    it('puts listing fields into listingData', () => {
      const hash = {
        price_string: '£250,000',
        price_float: 250000,
        currency: 'GBP',
        for_sale: true,
        for_rent: false,
        furnished: false,
      };

      const result = splitPropertyHash(hash);
      expect(result.listingData).toEqual(hash);
      expect(Object.keys(result.assetData)).toHaveLength(0);
      expect(Object.keys(result.unmapped)).toHaveLength(0);
    });

    it('puts unrecognized fields into unmapped', () => {
      const hash = {
        custom_field: 'hello',
        unknown_data: 42,
      };

      const result = splitPropertyHash(hash);
      expect(result.unmapped).toEqual(hash);
      expect(Object.keys(result.assetData)).toHaveLength(0);
      expect(Object.keys(result.listingData)).toHaveLength(0);
    });

    it('splits a mixed property hash correctly', () => {
      const hash = {
        title: 'House',
        reference: 'REF-123',
        latitude: 40.4,
        longitude: -3.7,
        count_bedrooms: 4,
        image_urls: ['img1.jpg', 'img2.jpg'],
        price_string: '€500.000',
        price_float: 500000,
        price_cents: 50000000,
        price_currency: 'EUR',
        for_sale: true,
        for_rent: false,
        locale_code: 'es-ES',
        re_agent_id: 42,
      };

      const result = splitPropertyHash(hash);

      expect(result.assetData.title).toBe('House');
      expect(result.assetData.reference).toBe('REF-123');
      expect(result.assetData.latitude).toBe(40.4);
      expect(result.assetData.count_bedrooms).toBe(4);
      expect(result.assetData.image_urls).toEqual(['img1.jpg', 'img2.jpg']);

      expect(result.listingData.price_string).toBe('€500.000');
      expect(result.listingData.price_float).toBe(500000);
      expect(result.listingData.price_cents).toBe(50000000);
      expect(result.listingData.price_currency).toBe('EUR');
      expect(result.listingData.for_sale).toBe(true);
      expect(result.listingData.locale_code).toBe('es-ES');

      expect(result.unmapped.re_agent_id).toBe(42);
    });

    it('handles empty hash', () => {
      const result = splitPropertyHash({});
      expect(Object.keys(result.assetData)).toHaveLength(0);
      expect(Object.keys(result.listingData)).toHaveLength(0);
      expect(Object.keys(result.unmapped)).toHaveLength(0);
    });

    it('classifies address fields as asset data', () => {
      const hash = {
        address_string: '123 Main St',
        street_name: 'Main St',
        street_number: '123',
        street_address: '123 Main St',
        postal_code: '28001',
        city: 'Madrid',
        province: 'Madrid',
        region: 'Centro',
        country: 'ES',
      };

      const result = splitPropertyHash(hash);
      expect(Object.keys(result.assetData)).toHaveLength(9);
      expect(result.assetData.city).toBe('Madrid');
    });

    it('classifies boolean listing flags correctly', () => {
      const hash = {
        sold: true,
        reserved: false,
        for_rent_short_term: true,
        for_rent_long_term: false,
      };

      const result = splitPropertyHash(hash);
      expect(Object.keys(result.listingData)).toHaveLength(4);
      expect(result.listingData.sold).toBe(true);
    });
  });
});
