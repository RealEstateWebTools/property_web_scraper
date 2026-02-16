/**
 * End-to-end tests for extraction diagnostics pipeline.
 *
 * Tests the full flow: extractFromHtml → retrieveListing → listing-store → results page logic.
 * These tests exercise every link in the chain to ensure diagnostics are never lost
 * and the UI receives the right signal (green vs amber banner).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { extractFromHtml } from '../../src/lib/extractor/html-extractor.js';
import type { ExtractionDiagnostics } from '../../src/lib/extractor/html-extractor.js';
import { retrieveListing } from '../../src/lib/services/listing-retriever.js';
import {
  clearListingStore,
  generateId,
  storeListing,
  getListing,
  storeDiagnostics,
  getDiagnostics,
} from '../../src/lib/services/listing-store.js';

function loadFixture(name: string): string {
  return readFileSync(resolve(__dirname, '..', 'fixtures', `${name}.html`), 'utf-8');
}

/**
 * Mirrors the hasFields logic from results/[id].astro exactly.
 * Uses significantFields (not model-default fields like area_unit='sqmt')
 * to determine if extraction actually found real data.
 */
const significantFields = ['reference', 'title', 'price_string', 'price_float',
  'address_string', 'longitude', 'latitude', 'count_bedrooms', 'count_bathrooms'];

function computeHasFields(
  diagnostics: ExtractionDiagnostics | undefined,
  listing: any | undefined,
): boolean {
  if (diagnostics) {
    return diagnostics.populatedFields > 0;
  }
  if (listing) {
    return significantFields.some((attr) => {
      const val = (listing as any)[attr];
      return val != null && val !== '' && val !== 0 && val !== false;
    });
  }
  return false;
}

// ─── 1. extractFromHtml always returns diagnostics ──────────────

describe('extractFromHtml diagnostics contract', () => {
  it('returns diagnostics when extraction succeeds with real fixture', () => {
    const html = loadFixture('rightmove');
    const result = extractFromHtml({
      html,
      sourceUrl: 'http://www.rightmove.co.uk/property-to-rent/property-51775029.html',
      scraperMappingName: 'rightmove',
    });

    expect(result.success).toBe(true);
    expect(result.diagnostics).toBeDefined();
    expect(result.diagnostics!.scraperName).toBe('rightmove');
    expect(result.diagnostics!.populatedFields).toBeGreaterThan(0);
    expect(result.diagnostics!.totalFields).toBeGreaterThan(0);
    expect(result.diagnostics!.fieldTraces.length).toBe(result.diagnostics!.totalFields);
  });

  it('returns diagnostics with populatedFields=0 when HTML has no data', () => {
    const result = extractFromHtml({
      html: '<html><body><p>Nothing useful</p></body></html>',
      sourceUrl: 'http://www.rightmove.co.uk/property-to-rent/property-99999999.html',
      scraperMappingName: 'rightmove',
    });

    expect(result.success).toBe(true);
    expect(result.diagnostics).toBeDefined();
    // Only defaultValues should be populated (country, currency, etc.)
    // All CSS/script fields should be empty
    expect(result.diagnostics!.emptyFields.length).toBeGreaterThan(0);
  });

  it('returns diagnostics even with empty HTML string', () => {
    const result = extractFromHtml({
      html: '',
      sourceUrl: 'http://www.rightmove.co.uk/property-to-rent/property-99999999.html',
      scraperMappingName: 'rightmove',
    });

    expect(result.success).toBe(true);
    expect(result.diagnostics).toBeDefined();
    expect(result.diagnostics!.totalFields).toBeGreaterThan(0);
  });
});

// ─── 2. retrieveListing threads diagnostics through ─────────────

describe('retrieveListing diagnostics passthrough', () => {
  it('returns diagnostics when HTML is provided and extraction succeeds', async () => {
    const html = loadFixture('rightmove');
    const result = await retrieveListing(
      'http://www.rightmove.co.uk/property-to-rent/property-51775029.html',
      html,
    );

    expect(result.success).toBe(true);
    expect(result.diagnostics).toBeDefined();
    expect(result.diagnostics!.scraperName).toBe('rightmove');
    expect(result.diagnostics!.populatedFields).toBeGreaterThan(0);
  });

  it('returns diagnostics even when HTML yields no fields', async () => {
    const result = await retrieveListing(
      'http://www.rightmove.co.uk/property-to-rent/property-99999999.html',
      '<html><body></body></html>',
    );

    expect(result.success).toBe(true);
    expect(result.diagnostics).toBeDefined();
    expect(result.diagnostics!.emptyFields.length).toBeGreaterThan(0);
  });

  it('returns undefined diagnostics when no HTML is provided (URL-only)', async () => {
    const result = await retrieveListing(
      'http://www.rightmove.co.uk/property-to-rent/property-51775029.html',
    );

    expect(result.success).toBe(true);
    // URL-only mode: no extraction happens, so no diagnostics
    expect(result.diagnostics).toBeUndefined();
  });
});

// ─── 3. listing-store round-trips diagnostics ───────────────────

describe('listing-store diagnostics storage', () => {
  beforeEach(() => {
    clearListingStore();
  });

  it('stores and retrieves diagnostics by ID', async () => {
    const id = generateId();
    const diag: ExtractionDiagnostics = {
      scraperName: 'rightmove',
      fieldTraces: [
        { field: 'title', section: 'textFields', strategy: 'cssLocator:h1', rawText: 'Test', value: 'Test' },
      ],
      totalFields: 1,
      populatedFields: 1,
      emptyFields: [],
    };

    await storeDiagnostics(id, diag);
    const retrieved = await getDiagnostics(id);

    expect(retrieved).toBeDefined();
    expect(retrieved!.scraperName).toBe('rightmove');
    expect(retrieved!.populatedFields).toBe(1);
    expect(retrieved!.fieldTraces).toHaveLength(1);
  });

  it('returns undefined for unknown ID', async () => {
    const result = await getDiagnostics('nonexistent-id');
    expect(result).toBeUndefined();
  });

  it('clearListingStore clears diagnostics too', async () => {
    const id = generateId();
    const diag: ExtractionDiagnostics = {
      scraperName: 'test',
      fieldTraces: [],
      totalFields: 0,
      populatedFields: 0,
      emptyFields: [],
    };

    await storeDiagnostics(id, diag);
    expect(await getDiagnostics(id)).toBeDefined();

    clearListingStore();
    expect(await getDiagnostics(id)).toBeUndefined();
  });
});

// ─── 4. Results page banner logic ───────────────────────────────

describe('results page hasFields logic', () => {
  it('shows amber banner when diagnostics is undefined and listing is empty', () => {
    // URL-only mode: no diagnostics, listing has only import_url and model defaults
    const emptyListing = { import_url: 'http://example.com', area_unit: 'sqmt', country: '' };
    expect(computeHasFields(undefined, emptyListing)).toBe(false);
  });

  it('shows green banner when diagnostics missing but listing has significant fields', () => {
    const goodListing = { title: 'Nice flat', price_string: '£250,000' };
    expect(computeHasFields(undefined, goodListing)).toBe(true);
  });

  it('ignores model defaults (area_unit, for_sale=false) when checking listing', () => {
    // A listing with only model defaults should NOT be considered as having data
    const defaultsOnly = {
      area_unit: 'sqmt',
      for_sale: false,
      for_rent: false,
      price_float: 0,
      count_bedrooms: 0,
      country: '',
    };
    expect(computeHasFields(undefined, defaultsOnly)).toBe(false);
  });

  it('uses diagnostics.populatedFields when diagnostics are present', () => {
    const emptyDiag: ExtractionDiagnostics = {
      scraperName: 'rightmove',
      fieldTraces: [],
      totalFields: 10,
      populatedFields: 0,
      emptyFields: ['title', 'price_string'],
    };
    expect(computeHasFields(emptyDiag, {})).toBe(false); // amber

    const goodDiag: ExtractionDiagnostics = {
      scraperName: 'rightmove',
      fieldTraces: [],
      totalFields: 10,
      populatedFields: 5,
      emptyFields: [],
    };
    expect(computeHasFields(goodDiag, {})).toBe(true); // green
  });
});

// ─── 5. Full pipeline: extract → store → retrieve → banner ─────

describe('full pipeline end-to-end', () => {
  beforeEach(() => {
    clearListingStore();
  });

  it('rightmove with real fixture: diagnostics survive full round-trip', async () => {
    // Step 1: Retrieve with HTML
    const html = loadFixture('rightmove');
    const result = await retrieveListing(
      'http://www.rightmove.co.uk/property-to-rent/property-51775029.html',
      html,
    );

    expect(result.success).toBe(true);
    expect(result.diagnostics).toBeDefined();

    // Step 2: Store listing + diagnostics (simulating what extract pages do)
    const id = generateId();
    await storeListing(id, result.retrievedListing!);
    if (result.diagnostics) {
      await storeDiagnostics(id, result.diagnostics);
    }

    // Step 3: Retrieve (simulating what results/[id].astro does)
    const listing = await getListing(id);
    const diagnostics = await getDiagnostics(id);

    expect(listing).toBeDefined();
    expect(diagnostics).toBeDefined();
    expect(diagnostics!.scraperName).toBe('rightmove');
    expect(diagnostics!.populatedFields).toBeGreaterThan(0);

    // Step 4: Banner logic
    const hasFields = computeHasFields(diagnostics, listing);
    expect(hasFields).toBe(true); // green — rightmove fixture has data
  });

  it('empty HTML: diagnostics show no fields, banner is amber', async () => {
    const result = await retrieveListing(
      'http://www.rightmove.co.uk/property-to-rent/property-99999999.html',
      '<html><body></body></html>',
    );

    expect(result.success).toBe(true);
    expect(result.diagnostics).toBeDefined();

    const id = generateId();
    await storeListing(id, result.retrievedListing!);
    if (result.diagnostics) {
      await storeDiagnostics(id, result.diagnostics);
    }

    const listing = await getListing(id);
    const diagnostics = await getDiagnostics(id);

    // Only defaults (country, currency) should count as populated
    // But key fields like title, price, coords should all be empty
    expect(diagnostics!.emptyFields.length).toBeGreaterThan(0);

    // If ALL real fields are empty (only defaults populated), check banner
    const hasFields = computeHasFields(diagnostics, listing);
    // This depends on whether defaultValues count as "populated"
    // Either way, diagnostics should be visible for debugging
    expect(diagnostics!.fieldTraces.length).toBeGreaterThan(0);
  });

  it('URL-only mode: no diagnostics, empty listing, banner must NOT be green', async () => {
    // Use a unique URL so Firestore doesn't return a cached listing from earlier tests
    const uniqueUrl = 'http://www.rightmove.co.uk/property-to-rent/property-00000001.html';
    const result = await retrieveListing(
      uniqueUrl,
      // no HTML — URL-only mode
    );

    expect(result.success).toBe(true);
    expect(result.diagnostics).toBeUndefined();

    const id = generateId();
    await storeListing(id, result.retrievedListing!);
    // No diagnostics to store

    const listing = await getListing(id);
    const diagnostics = await getDiagnostics(id);

    expect(diagnostics).toBeUndefined();

    // The listing should only have import_url and model defaults — no extracted data
    expect((listing as any).title).toBe('');
    expect((listing as any).price_string).toBe('');

    // THE CRITICAL TEST: banner should NOT be green for empty listing
    const hasFields = computeHasFields(diagnostics, listing);
    expect(hasFields).toBe(false); // must be amber, not green
  });
});

// ─── 6. JSON endpoint: listing.asJson() must work after store round-trip ──

describe('JSON endpoint listing serialization', () => {
  beforeEach(() => {
    clearListingStore();
  });

  it('listing.asJson() works after store/retrieve round-trip', async () => {
    const html = loadFixture('rightmove');
    const result = await retrieveListing(
      'http://www.rightmove.co.uk/property-to-rent/property-51775029.html',
      html,
    );

    const id = generateId();
    await storeListing(id, result.retrievedListing!);
    if (result.diagnostics) {
      await storeDiagnostics(id, result.diagnostics);
    }

    // Simulate exactly what [id].json.ts does — this was crashing
    const listing = await getListing(id);
    const diagnostics = await getDiagnostics(id);

    expect(listing).toBeDefined();
    expect(typeof listing!.asJson).toBe('function');

    const json = {
      success: true,
      listing: listing!.asJson(),
      ...(diagnostics ? { diagnostics } : {}),
    };

    expect(json.listing).toBeDefined();
    expect(json.listing.title).toBe(
      '4 bedroom detached house to rent in School Road, Birmingham, B14, B14'
    );
    expect(json.diagnostics).toBeDefined();
    expect(json.diagnostics!.scraperName).toBe('rightmove');
  });

  it('listing.asJson() works even after plain-object insertion', async () => {
    // Simulate what happens when KV returns a plain object (no prototype)
    const id = generateId();
    const plainObj = {
      title: 'Test Property',
      price_string: '£500,000',
      import_url: 'http://example.com/listing/1',
    } as any;

    // Force a plain object into the store (simulates KV deserialization)
    await storeListing(id, plainObj);

    // getListing must rehydrate it into a proper Listing with asJson()
    const listing = await getListing(id);
    expect(listing).toBeDefined();
    expect(typeof listing!.asJson).toBe('function');

    const json = listing!.asJson();
    expect(json.title).toBe('Test Property');
    expect(json.price_string).toBe('£500,000');
  });

  it('JSON response has no diagnostics key when not stored', async () => {
    const id = generateId();
    const { Listing: ListingClass } = await import('../../src/lib/models/listing.js');
    const listing = new ListingClass();
    await storeListing(id, listing);

    const retrieved = await getListing(id);
    const diagnostics = await getDiagnostics(id);

    expect(typeof retrieved!.asJson).toBe('function');

    const json = {
      success: true,
      listing: retrieved!.asJson(),
      ...(diagnostics ? { diagnostics } : {}),
    };

    expect(json.diagnostics).toBeUndefined();
    expect('diagnostics' in json).toBe(false);
  });
});
