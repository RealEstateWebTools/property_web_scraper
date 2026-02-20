import { describe, it, expect } from 'vitest';
import { haulScrapeToListing, haulScrapesToListings } from '../../src/lib/services/haul-export-adapter.js';
import type { HaulScrape } from '../../src/lib/services/haul-store.js';

function makeEnrichedScrape(overrides: Partial<HaulScrape> = {}): HaulScrape {
  return {
    resultId: 'r1',
    title: 'Beautiful 3-bed House',
    grade: 'A',
    price: '£350,000',
    extractionRate: 0.92,
    createdAt: new Date().toISOString(),
    url: 'https://www.rightmove.co.uk/properties/123',
    price_float: 350000,
    currency: '£',
    count_bedrooms: 3,
    count_bathrooms: 2,
    constructed_area: 120,
    area_unit: 'sqmt',
    latitude: 51.5074,
    longitude: -0.1278,
    city: 'London',
    country: 'UK',
    address_string: '123 Baker Street, London',
    main_image_url: 'https://example.com/image.jpg',
    import_host_slug: 'rightmove',
    for_sale: true,
    for_rent: false,
    features: ['Garden', 'Parking', 'Central Heating'],
    description: 'A lovely property in London',
    property_type: 'house',
    property_subtype: 'detached',
    tenure: 'freehold',
    listing_status: 'active',
    agent_name: 'Acme Estates',
    agent_phone: '+44 20 1234 5678',
    agent_email: 'info@acme.co.uk',
    agent_logo_url: 'https://example.com/logo.png',
    price_qualifier: 'guide_price',
    floor_plan_urls: ['https://example.com/floor1.png'],
    energy_certificate_grade: 'C',
    ...overrides,
  };
}

function makeLegacyScrape(overrides: Partial<HaulScrape> = {}): HaulScrape {
  return {
    resultId: 'r2',
    title: 'Old Listing',
    grade: 'C',
    price: '200,000',
    extractionRate: 0.5,
    createdAt: new Date().toISOString(),
    url: 'https://example.com/listing/456',
    ...overrides,
  };
}

describe('haul-export-adapter', () => {
  describe('haulScrapeToListing', () => {
    it('converts a fully enriched scrape to a Listing', () => {
      const scrape = makeEnrichedScrape();
      const listing = haulScrapeToListing(scrape);

      expect(listing.import_url).toBe(scrape.url);
      expect(listing.title).toBe('Beautiful 3-bed House');
      expect(listing.price_string).toBe('£350,000');
      expect(listing.price_float).toBe(350000);
      expect(listing.currency).toBe('£');
      expect(listing.count_bedrooms).toBe(3);
      expect(listing.count_bathrooms).toBe(2);
      expect(listing.constructed_area).toBe(120);
      expect(listing.latitude).toBe(51.5074);
      expect(listing.longitude).toBe(-0.1278);
      expect(listing.city).toBe('London');
      expect(listing.country).toBe('UK');
      expect(listing.address_string).toBe('123 Baker Street, London');
      expect(listing.main_image_url).toBe('https://example.com/image.jpg');
      expect(listing.import_host_slug).toBe('rightmove');
      expect(listing.for_sale).toBe(true);
      expect(listing.for_rent).toBe(false);
      expect(listing.features).toEqual(['Garden', 'Parking', 'Central Heating']);
      expect(listing.description).toBe('A lovely property in London');
      expect(listing.property_type).toBe('house');
      expect(listing.property_subtype).toBe('detached');
      expect(listing.tenure).toBe('freehold');
      expect(listing.listing_status).toBe('active');
      expect(listing.agent_name).toBe('Acme Estates');
      expect(listing.agent_phone).toBe('+44 20 1234 5678');
      expect(listing.agent_email).toBe('info@acme.co.uk');
      expect(listing.agent_logo_url).toBe('https://example.com/logo.png');
      expect(listing.price_qualifier).toBe('guide_price');
      expect(listing.floor_plan_urls).toEqual(['https://example.com/floor1.png']);
      expect(listing.energy_certificate_grade).toBe('C');
    });

    it('handles a legacy scrape with missing enriched fields', () => {
      const scrape = makeLegacyScrape();
      const listing = haulScrapeToListing(scrape);

      expect(listing.import_url).toBe('https://example.com/listing/456');
      expect(listing.title).toBe('Old Listing');
      expect(listing.price_string).toBe('200,000');
      expect(listing.price_float).toBe(0);
      expect(listing.count_bedrooms).toBe(0);
      expect(listing.latitude).toBe(0);
      expect(listing.longitude).toBe(0);
      expect(listing.city).toBe('');
      expect(listing.features).toEqual([]);
      expect(listing.description).toBe('');
      // New interoperability fields default to empty for legacy scrapes
      expect(listing.property_type).toBe('');
      expect(listing.property_subtype).toBe('');
      expect(listing.tenure).toBe('');
      expect(listing.listing_status).toBe('');
      expect(listing.agent_name).toBe('');
      expect(listing.agent_phone).toBe('');
      expect(listing.agent_email).toBe('');
      expect(listing.agent_logo_url).toBe('');
      expect(listing.price_qualifier).toBe('');
      expect(listing.floor_plan_urls).toEqual([]);
      expect(listing.energy_certificate_grade).toBe('');
    });

    it('round-trips new interoperability fields through adapter', () => {
      const scrape = makeEnrichedScrape({
        property_type: 'apartment',
        agent_name: 'Best Homes Ltd',
        tenure: 'leasehold',
        floor_plan_urls: ['https://example.com/fp1.png', 'https://example.com/fp2.png'],
      });
      const listing = haulScrapeToListing(scrape);

      expect(listing.property_type).toBe('apartment');
      expect(listing.agent_name).toBe('Best Homes Ltd');
      expect(listing.tenure).toBe('leasehold');
      expect(listing.floor_plan_urls).toEqual(['https://example.com/fp1.png', 'https://example.com/fp2.png']);
    });
  });

  describe('haulScrapesToListings', () => {
    it('converts an array of scrapes', () => {
      const scrapes = [makeEnrichedScrape(), makeLegacyScrape()];
      const listings = haulScrapesToListings(scrapes);

      expect(listings).toHaveLength(2);
      expect(listings[0].title).toBe('Beautiful 3-bed House');
      expect(listings[1].title).toBe('Old Listing');
    });

    it('handles empty array', () => {
      expect(haulScrapesToListings([])).toEqual([]);
    });
  });
});
