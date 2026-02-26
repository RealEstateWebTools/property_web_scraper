import { describe, it, expect } from 'vitest';
import { Listing } from '../../src/lib/models/listing.js';
import { ImportHost } from '../../src/lib/models/import-host.js';
import { PwbListing } from '../../src/lib/models/pwb-listing.js';
import { WhereChain } from '../../src/lib/firestore/base-model.js';

describe('Models', () => {
  describe('Listing', () => {
    it('creates and retrieves a listing', async () => {
      const listing = new Listing();
      listing.assignAttributes({
        import_url: 'https://example.com/property/1',
        title: 'Test Property',
        price_string: '500,000',
        price_float: 500000,
        count_bedrooms: 3,
        for_sale: true,
      });
      await listing.save();

      expect(listing.id).toBeTruthy();
      expect(listing.persisted).toBe(true);

      const found = await Listing.find.call(Listing, listing.id) as unknown as Listing;
      expect(found.title).toBe('Test Property');
      expect(found.price_float).toBe(500000);
      expect(found.count_bedrooms).toBe(3);
      expect(found.for_sale).toBe(true);
    });

    it('updates a listing from a property hash', () => {
      const listing = new Listing();
      const hash: Record<string, unknown> = {
        title: 'Updated Property',
        price_string: '750,000',
        price_float: 750000,
        currency: 'EUR',
        count_bedrooms: 4,
        image_urls: [{ url: 'https://example.com/img1.jpg' }, { url: 'https://example.com/img2.jpg' }],
        for_sale: true,
      };

      Listing.updateFromHash(listing, hash);

      expect(listing.title).toBe('Updated Property');
      expect(listing.price_float).toBe(750000);
      expect(listing.currency).toBe('EUR');
      expect(listing.count_bedrooms).toBe(4);
      expect(listing.image_urls).toHaveLength(2);
    });

    it('updateFromHash captures description_html and strips description', () => {
      const listing = new Listing();
      const html = '<p>Spacious <b>home</b> with garden.</p>';
      Listing.updateFromHash(listing, { description: html });

      expect(listing.description).toBe('Spacious home with garden.');
      expect(listing.description_html).toBe(html);
    });

    it('serializes to JSON with correct fields', () => {
      const listing = new Listing();
      listing.assignAttributes({
        title: 'JSON Test',
        price_string: '100,000',
        import_url: 'https://example.com/p/1',
      });

      const json = listing.asJson();
      expect(json['title']).toBe('JSON Test');
      expect(json['import_url']).toBe('https://example.com/p/1');
      // Should not include internal fields
      expect(json).not.toHaveProperty('import_history');
    });

    it('asJson includes description_html and locale_code', () => {
      const listing = new Listing();
      listing.description = 'Descripción de la propiedad';
      listing.description_html = '<p>Descripción de la propiedad</p>';
      listing.locale_code = 'es';

      const json = listing.asJson();
      expect(json['description']).toBe('Descripción de la propiedad');
      expect(json['description_html']).toBe('<p>Descripción de la propiedad</p>');
      expect(json['locale_code']).toBe('es');
    });

    it('updateFromHash populates supplementary_data_links with enriched metadata', () => {
      const listing = new Listing();
      Listing.updateFromHash(listing, {
        country: 'GB',
        street_address: '10 Downing Street',
        city: 'London',
        postal_code: 'SW1A 2AA',
        latitude: 51.5034,
        longitude: -0.1276,
      });

      expect(Array.isArray(listing.supplementary_data_links)).toBe(true);
      expect(listing.supplementary_data_links.length).toBeGreaterThan(2);

      const ids = listing.supplementary_data_links.map((link) => link.id);
      expect(ids).toContain('osm-location');
      expect(ids).toContain('google-maps-search');
      expect(ids).toContain('uk-postcode-doogal');

      const first = listing.supplementary_data_links[0];
      expect(first.priority).toBeLessThanOrEqual((listing.supplementary_data_links[1]?.priority ?? 100));

      const floodLink = listing.supplementary_data_links.find((link) => link.id === 'uk-flood-risk-gov');
      expect(floodLink?.sourceType).toBe('official');
      expect(floodLink?.access).toBe('free');
      expect(floodLink?.intent).toBe('climate_risk');
      expect(floodLink?.freshness).toBe('ad_hoc');
    });

    it('supplementary_data_links require configured fields before a link is emitted', () => {
      const listing = new Listing();
      (listing as any).latitude = undefined;
      (listing as any).longitude = undefined;

      Listing.updateFromHash(listing, {
        country: 'GB',
        city: 'London',
      });

      const ids = listing.supplementary_data_links.map((link) => link.id);
      expect(ids).toContain('google-maps-search');
      expect(ids).not.toContain('osm-location');
      expect(ids).not.toContain('uk-postcode-doogal');
    });
  });

  describe('ImportHost', () => {
    it('finds import host by host name', async () => {
      const host = await ImportHost.findByHost('www.idealista.com');
      expect(host).not.toBeNull();
      expect(host!.scraper_name).toBe('es_idealista');
      expect(host!.slug).toBe('es_idealista');
    });

    it('returns null for unknown host', async () => {
      const host = await ImportHost.findByHost('www.unknown-site.com');
      expect(host).toBeNull();
    });

    it('computes hostUrl', async () => {
      const host = await ImportHost.findByHost('www.idealista.com');
      expect(host!.hostUrl).toBe('http://www.idealista.com');
    });

    it('computes staleAgeDurationMs', () => {
      const host = new ImportHost();
      host.stale_age = '1.day';
      expect(host.staleAgeDurationMs).toBe(86400000);

      host.stale_age = '5.seconds';
      expect(host.staleAgeDurationMs).toBe(5000);
    });
  });

  describe('PwbListing', () => {
    it('computes price_sale_current for sale listings', () => {
      const listing = new PwbListing();
      listing.for_sale = true;
      listing.price_float = 500000;
      expect(listing.priceSaleCurrent).toBe(500000);
    });

    it('returns 0 for price_sale_current on rental listings', () => {
      const listing = new PwbListing();
      listing.for_sale = false;
      listing.price_float = 500000;
      expect(listing.priceSaleCurrent).toBe(0);
    });

    it('computes property_photos', () => {
      const listing = new PwbListing();
      listing.image_urls = [{ url: 'https://example.com/1.jpg' }, { url: 'https://example.com/2.jpg' }];
      expect(listing.propertyPhotos).toEqual([
        { url: 'https://example.com/1.jpg' },
        { url: 'https://example.com/2.jpg' },
      ]);
    });
  });

  describe('WhereChain', () => {
    it('finds or creates a listing', async () => {
      const chain = new WhereChain(Listing as any, { import_url: 'https://example.com/unique-test' });
      const created = await chain.firstOrCreate() as unknown as Listing;
      expect(created.import_url).toBe('https://example.com/unique-test');

      // Second call should return the same document
      const chain2 = new WhereChain(Listing as any, { import_url: 'https://example.com/unique-test' });
      const found = await chain2.firstOrCreate();
      expect(found.id).toBe(created.id);
    });
  });
});
