import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { retrieveListing } from '../../src/lib/services/listing-retriever.js';
import {
  clearListingStore,
  storeListing,
  generateId,
  findListingByUrl,
} from '../../src/lib/services/listing-store.js';
import { Listing } from '../../src/lib/models/listing.js';

function loadFixture(name: string): string {
  return readFileSync(resolve(__dirname, '..', 'fixtures', `${name}.html`), 'utf-8');
}

describe('retrieveListing', () => {
  beforeEach(() => {
    clearListingStore();
  });
  it('returns error for invalid URL', async () => {
    const result = await retrieveListing('not-a-valid-url');
    expect(result.success).toBe(false);
    expect(result.errorMessage).toBe('Invalid Url');
  });

  it('returns error for unsupported host', async () => {
    const result = await retrieveListing('https://www.unsupported-site-xyz.com/listing/123');
    expect(result.success).toBe(false);
    expect(result.errorMessage).toBe('Unsupported Url');
  });

  it('returns error for empty URL', async () => {
    const result = await retrieveListing('');
    expect(result.success).toBe(false);
    expect(result.errorMessage).toBe('Invalid Url');
  });

  it('succeeds with valid URL and HTML', async () => {
    const html = loadFixture('rightmove_v2');
    const result = await retrieveListing(
      'https://www.rightmove.co.uk/properties/168908774',
      html,
    );
    expect(result.success).toBe(true);
    expect(result.retrievedListing).toBeDefined();
    expect(result.retrievedListing!.title).toBe(
      '2 bedroom apartment for sale in Augustine Way, Oxford, OX4'
    );
  });

  it('returns listing with diagnostics when HTML is provided', async () => {
    const html = loadFixture('rightmove_v2');
    const result = await retrieveListing(
      'https://www.rightmove.co.uk/properties/168908774',
      html,
    );
    expect(result.success).toBe(true);
    expect(result.diagnostics).toBeDefined();
    expect(result.diagnostics!.scraperName).toBe('uk_rightmove');
    expect(result.diagnostics!.populatedFields).toBeGreaterThan(0);
  });

  it('returns undefined diagnostics in URL-only mode', async () => {
    const result = await retrieveListing(
      'https://www.rightmove.co.uk/properties/168908774',
    );
    expect(result.success).toBe(true);
    expect(result.diagnostics).toBeUndefined();
    expect(result.retrievedListing).toBeDefined();
  });

  it('handles valid URL with empty HTML string as URL-only mode', async () => {
    // Empty string is falsy, so retrieveListing treats it as URL-only mode
    const result = await retrieveListing(
      'http://www.rightmove.co.uk/property-to-rent/property-99999.html',
      '',
    );
    expect(result.success).toBe(true);
    expect(result.diagnostics).toBeUndefined();
  });

  it('handles valid URL with no-data HTML', async () => {
    const result = await retrieveListing(
      'http://www.rightmove.co.uk/property-to-rent/property-99999.html',
      '<html><body><p>Nothing useful</p></body></html>',
    );
    expect(result.success).toBe(true);
    expect(result.diagnostics).toBeDefined();
    expect(result.diagnostics!.emptyFields.length).toBeGreaterThan(0);
  });

  it('sets import_host_slug on listing when extraction succeeds', async () => {
    const html = loadFixture('rightmove_v2');
    const result = await retrieveListing(
      'https://www.rightmove.co.uk/properties/168908774',
      html,
    );
    expect(result.success).toBe(true);
    expect(result.retrievedListing!.import_host_slug).toBe('uk_rightmove');
  });

  it('works with idealista URL and fixture', async () => {
    const html = loadFixture('idealista_v2');
    const result = await retrieveListing(
      'https://www.idealista.com/inmueble/98765432/',
      html,
    );
    expect(result.success).toBe(true);
    expect(result.retrievedListing!.title).toBe('Piso en venta en calle de Serrano, 50, Salamanca, Madrid');
    expect(result.diagnostics!.scraperName).toBe('es_idealista');
  });

  describe('price normalization', () => {
    it('sets price_cents and price_currency for rightmove', async () => {
      const html = loadFixture('rightmove_v2');
      const result = await retrieveListing(
        'https://www.rightmove.co.uk/properties/168908774',
        html,
      );

      expect(result.success).toBe(true);
      const listing = result.retrievedListing!;
      expect(listing.price_cents).toBeGreaterThan(0);
      expect(listing.price_currency).toBe('GBP');
    });

    it('uses EUR currency for idealista', async () => {
      const html = loadFixture('idealista_v2');
      const result = await retrieveListing(
        'https://www.idealista.com/pro/rv-gestion-inmobiliaria/inmueble/38604738/',
        html,
      );

      expect(result.success).toBe(true);
      const listing = result.retrievedListing!;
      expect(listing.price_currency).toBe('EUR');
      expect(listing.price_cents).toBeGreaterThan(0);
    });

    it('sets price_cents to 0 when no price in HTML', async () => {
      const result = await retrieveListing(
        'https://www.rightmove.co.uk/properties/168908774',
        '<html><body></body></html>',
      );

      expect(result.success).toBe(true);
      expect(result.retrievedListing!.price_cents).toBe(0);
    });

    it('includes price_cents in listing asJson output', async () => {
      const html = loadFixture('rightmove_v2');
      const result = await retrieveListing(
        'https://www.rightmove.co.uk/properties/168908774',
        html,
      );

      const json = result.retrievedListing!.asJson();
      expect(json).toHaveProperty('price_cents');
      expect(json).toHaveProperty('price_currency');
      expect(json.price_cents).toBeGreaterThan(0);
    });
  });

  describe('URL deduplication', () => {
    it('reuses existing listing from store', async () => {
      const url = 'https://www.rightmove.co.uk/properties/168908774';
      const listing = new Listing();
      listing.assignAttributes({ import_url: url, title: 'Stored Listing' });

      const id = generateId();
      await storeListing(id, listing);

      const result = await retrieveListing(url);
      expect(result.success).toBe(true);
      // The listing was found via dedup
      expect(findListingByUrl(url)).toBe(id);
    });

    it('deduplicates URLs ignoring tracking params', async () => {
      const url = 'https://www.rightmove.co.uk/properties/168908774';
      const listing = new Listing();
      listing.assignAttributes({ import_url: url, title: 'Original' });

      const id = generateId();
      await storeListing(id, listing);

      const foundId = findListingByUrl(url + '?utm_source=google&fbclid=abc');
      expect(foundId).toBe(id);
    });
  });

  describe('weighted diagnostics', () => {
    it('includes weightedExtractionRate', async () => {
      const html = loadFixture('rightmove_v2');
      const result = await retrieveListing(
        'https://www.rightmove.co.uk/properties/168908774',
        html,
      );

      expect(result.diagnostics!.weightedExtractionRate).toBeDefined();
      expect(result.diagnostics!.weightedExtractionRate).toBeGreaterThan(0);
    });

    it('includes criticalFieldsMissing', async () => {
      const html = loadFixture('rightmove_v2');
      const result = await retrieveListing(
        'https://www.rightmove.co.uk/properties/168908774',
        html,
      );

      expect(result.diagnostics!.criticalFieldsMissing).toBeDefined();
      expect(Array.isArray(result.diagnostics!.criticalFieldsMissing)).toBe(true);
    });

    it('includes contentAnalysis', async () => {
      const html = loadFixture('rightmove_v2');
      const result = await retrieveListing(
        'https://www.rightmove.co.uk/properties/168908774',
        html,
      );

      const ca = result.diagnostics!.contentAnalysis!;
      expect(ca).toBeDefined();
      expect(ca.htmlLength).toBeGreaterThan(0);
      expect(typeof ca.hasScriptTags).toBe('boolean');
      expect(typeof ca.jsonLdCount).toBe('number');
    });
  });
});
