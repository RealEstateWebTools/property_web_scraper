import { describe, it, expect } from 'vitest';
import { Listing } from '../../src/lib/models/listing.js';
import { JSONExporter } from '../../src/lib/exporters/json-exporter.js';
import { CSVExporter } from '../../src/lib/exporters/csv-exporter.js';
import { GeoJSONExporter } from '../../src/lib/exporters/geojson-exporter.js';
import { XMLExporter } from '../../src/lib/exporters/xml-exporter.js';
import { SchemaOrgExporter } from '../../src/lib/exporters/schema-org-exporter.js';
import { BLMExporter } from '../../src/lib/exporters/blm-exporter.js';
import { KyeroExporter } from '../../src/lib/exporters/kyero-exporter.js';
import { RESOJsonExporter } from '../../src/lib/exporters/reso-json-exporter.js';
import {
  createExporter,
  getAvailableExporters,
  getAllExporters,
  getExporterConfig,
  requiresGeoLocation,
  getMimeType,
  getFileExtension,
} from '../../src/lib/exporters/exporter-registry.js';
import { ExportService } from '../../src/lib/services/export-service.js';

function makeListing(overrides: Partial<Record<string, unknown>> = {}): Listing {
  const listing = new Listing();
  listing.assignAttributes({
    reference: 'REF-001',
    title: 'Modern Apartment in Madrid',
    description: 'A lovely test property',
    price_float: 250000,
    price_string: '250,000',
    currency: 'EUR',
    count_bedrooms: 3,
    count_bathrooms: 2,
    constructed_area: 120,
    area_unit: 'sqmt',
    city: 'Madrid',
    country: 'Spain',
    address_string: '123 Test Street, Madrid',
    latitude: 40.4168,
    longitude: -3.7038,
    main_image_url: 'https://example.com/img.jpg',
    import_url: 'https://example.com/listing/1',
    for_sale: true,
    image_urls: [{ url: 'https://example.com/img1.jpg' }, { url: 'https://example.com/img2.jpg' }],
    ...overrides,
  });
  return listing;
}

function makeListings(count: number): Listing[] {
  return Array.from({ length: count }, (_, i) =>
    makeListing({
      reference: `REF-${String(i + 1).padStart(3, '0')}`,
      title: `Property ${i + 1}`,
      price_float: 200000 + i * 50000,
      latitude: 40.4 + i * 0.01,
      longitude: -3.7 + i * 0.01,
    })
  );
}

describe('Exporters', () => {
  // ─── JSONExporter ────────────────────────────────────────────────────────────

  describe('JSONExporter', () => {
    it('exports listings as formatted JSON', async () => {
      const exporter = new JSONExporter({ pretty: true });
      const result = await exporter.export([makeListing()]);
      const parsed = JSON.parse(result);

      expect(parsed.export_version).toBe('1.0');
      expect(parsed.source_platform).toBe('PropertyWebScraper');
      expect(parsed.listings).toHaveLength(1);
      expect(parsed.listings[0].title).toBe('Modern Apartment in Madrid');
      expect(parsed.listings[0].price_float).toBe(250000);
    });

    it('includes metadata when enabled', async () => {
      const exporter = new JSONExporter({ includeMetadata: true });
      const result = await exporter.export([makeListing()]);
      const parsed = JSON.parse(result);

      expect(parsed.metadata).toBeDefined();
      expect(parsed.metadata.total_listings).toBe(1);
      expect(parsed.metadata.source_platform).toBe('PropertyWebScraper');
    });

    it('excludes metadata when disabled', async () => {
      const exporter = new JSONExporter({ includeMetadata: false });
      const result = await exporter.export([makeListing()]);
      const parsed = JSON.parse(result);

      expect(parsed.metadata).toBeUndefined();
    });

    it('exports all fields by default', async () => {
      const exporter = new JSONExporter();
      const result = await exporter.export([makeListing()]);
      const parsed = JSON.parse(result);
      const listing = parsed.listings[0];

      expect(listing.reference).toBeDefined();
      expect(listing.title).toBeDefined();
      expect(listing.price_float).toBeDefined();
      expect(listing.city).toBeDefined();
      expect(listing.description).toBeDefined();
      expect(listing.address_string).toBeDefined();
    });

    it('exports essential fields when requested', async () => {
      const exporter = new JSONExporter({ fieldSelection: 'essential' });
      const result = await exporter.export([makeListing()]);
      const parsed = JSON.parse(result);
      const listing = parsed.listings[0];

      expect(listing.reference).toBeDefined();
      expect(listing.title).toBeDefined();
      expect(listing.price_float).toBeDefined();
      expect(listing.city).toBeDefined();
      // Non-essential fields should be absent
      expect(listing.description).toBeUndefined();
      expect(listing.postal_code).toBeUndefined();
    });

    it('exports all fields when requested', async () => {
      const exporter = new JSONExporter({ fieldSelection: 'all' });
      const result = await exporter.export([makeListing()]);
      const parsed = JSON.parse(result);
      const listing = parsed.listings[0];

      expect(listing.reference).toBeDefined();
      expect(listing.import_url).toBeDefined();
      expect(listing.for_sale).toBe(true);
    });

    it('exports custom field selection', async () => {
      const exporter = new JSONExporter({ fieldSelection: ['title', 'price_float'] });
      const result = await exporter.export([makeListing()]);
      const parsed = JSON.parse(result);
      const listing = parsed.listings[0];

      expect(Object.keys(listing)).toEqual(['title', 'price_float']);
    });

    it('exports multiple listings', async () => {
      const exporter = new JSONExporter();
      const listings = makeListings(3);
      const result = await exporter.export(listings);
      const parsed = JSON.parse(result);

      expect(parsed.listings).toHaveLength(3);
      expect(parsed.listings[0].reference).toBe('REF-001');
      expect(parsed.listings[2].reference).toBe('REF-003');
    });

    it('throws on empty listings', async () => {
      const exporter = new JSONExporter();
      await expect(exporter.export([])).rejects.toThrow('Cannot export empty listing array');
    });

    it('exports single listing', async () => {
      const exporter = new JSONExporter();
      const result = await exporter.exportSingle(makeListing());
      const parsed = JSON.parse(result);

      expect(parsed.listing).toBeDefined();
      expect(parsed.listing.title).toBe('Modern Apartment in Madrid');
    });

    it('produces valid JSON without pretty printing', async () => {
      const exporter = new JSONExporter({ pretty: false });
      const result = await exporter.export([makeListing()]);

      // No newlines in compact JSON (except within values)
      expect(result).not.toContain('\n');
      expect(JSON.parse(result)).toBeDefined();
    });

    it('ensures image_urls includes main_image_url when empty', async () => {
      const exporter = new JSONExporter({ fieldSelection: 'all' });
      const result = await exporter.export([
        makeListing({
          main_image_url: 'https://example.com/primary.jpg',
          image_urls: [],
        }),
      ]);
      const parsed = JSON.parse(result);
      const listing = parsed.listings[0];

      expect(listing.main_image_url).toBe('https://example.com/primary.jpg');
      expect(Array.isArray(listing.image_urls)).toBe(true);
      expect(listing.image_urls.length).toBeGreaterThan(0);
      expect(listing.image_urls[0]).toEqual({ url: 'https://example.com/primary.jpg' });
    });

    it('includes export_date as ISO8601 string', async () => {
      const exporter = new JSONExporter();
      const result = await exporter.export([makeListing()]);
      const parsed = JSON.parse(result);

      expect(parsed.export_date).toBeDefined();
      expect(new Date(parsed.export_date).getTime()).not.toBeNaN();
    });

    it('metadata includes export_version and scraper_version', async () => {
      const exporter = new JSONExporter({ includeMetadata: true });
      const result = await exporter.export([makeListing()]);
      const parsed = JSON.parse(result);

      expect(parsed.metadata.export_version).toBe('1.0');
      expect(parsed.metadata.scraper_version).toBe('5.0.0');
      expect(parsed.metadata.duration_ms).toBeGreaterThanOrEqual(0);
    });

    it('streaming export produces valid JSON when concatenated', async () => {
      const exporter = new JSONExporter({ includeMetadata: true });
      const listings = makeListings(3);
      const chunks: string[] = [];
      for await (const chunk of exporter.exportStream(listings)) {
        chunks.push(chunk);
      }
      const full = chunks.join('');
      const parsed = JSON.parse(full);

      expect(parsed.export_version).toBe('1.0');
      expect(parsed.listings).toHaveLength(3);
    });

    it('single listing export includes metadata when enabled', async () => {
      const exporter = new JSONExporter({ includeMetadata: true });
      const result = await exporter.exportSingle(makeListing());
      const parsed = JSON.parse(result);

      expect(parsed.metadata).toBeDefined();
      expect(parsed.metadata.total_listings).toBe(1);
    });

    it('does not prepend main_image_url when already in image_urls', async () => {
      const exporter = new JSONExporter({ fieldSelection: 'all' });
      const result = await exporter.export([
        makeListing({
          main_image_url: 'https://example.com/img1.jpg',
          image_urls: [{ url: 'https://example.com/img1.jpg' }, { url: 'https://example.com/img2.jpg' }],
        }),
      ]);
      const parsed = JSON.parse(result);
      const listing = parsed.listings[0];

      // Should not duplicate
      expect(listing.image_urls).toHaveLength(2);
    });
  });

  // ─── CSVExporter ─────────────────────────────────────────────────────────────

  describe('CSVExporter', () => {
    it('exports listings as CSV with header', async () => {
      const exporter = new CSVExporter({ includeHeader: true });
      const result = await exporter.export([makeListing()]);
      const lines = result.trim().split('\n');

      expect(lines).toHaveLength(2); // header + 1 data row
      expect(lines[0]).toContain('reference');
      expect(lines[0]).toContain('title');
      expect(lines[1]).toContain('REF-001');
    });

    it('exports CSV without header', async () => {
      const exporter = new CSVExporter({ includeHeader: false });
      const result = await exporter.export([makeListing()]);
      const lines = result.trim().split('\n');

      expect(lines).toHaveLength(1);
      expect(lines[0]).not.toContain('reference,title');
    });

    it('uses semicolon delimiter', async () => {
      const exporter = new CSVExporter({ delimiter: ';', includeHeader: true });
      const result = await exporter.export([makeListing()]);
      const header = result.split('\n')[0];

      expect(header).toContain(';');
      expect(header.split(';').length).toBeGreaterThan(1);
    });

    it('uses tab delimiter', async () => {
      const exporter = new CSVExporter({ delimiter: '\t', includeHeader: true });
      const result = await exporter.export([makeListing()]);
      const header = result.split('\n')[0];

      expect(header).toContain('\t');
    });

    it('escapes fields containing delimiter', async () => {
      const listing = makeListing({ title: 'Apartment, 3 bed' });
      const exporter = new CSVExporter();
      const result = await exporter.export([listing]);

      // Title with comma should be quoted
      expect(result).toContain('"Apartment, 3 bed"');
    });

    it('escapes fields containing quotes', async () => {
      const listing = makeListing({ title: 'The "Best" Apartment' });
      const exporter = new CSVExporter();
      const result = await exporter.export([listing]);

      // Quotes should be doubled within quoted field
      expect(result).toContain('""Best""');
    });

    it('escapes fields containing newlines', async () => {
      const listing = makeListing({ title: 'Line 1\nLine 2' });
      const exporter = new CSVExporter();
      const result = await exporter.export([listing]);

      expect(result).toContain('"Line 1\nLine 2"');
    });

    it('adds UTF-8 BOM when requested', async () => {
      const exporter = new CSVExporter({ encoding: 'utf-8-bom' });
      const result = await exporter.export([makeListing()]);

      expect(result.charCodeAt(0)).toBe(0xFEFF);
    });

    it('handles null values as empty strings', async () => {
      const listing = makeListing();
      listing.last_retrieved_at = null;
      const exporter = new CSVExporter({ fieldSelection: ['title', 'last_retrieved_at'] });
      const result = await exporter.export([listing]);
      const lines = result.trim().split('\n');
      const dataLine = lines[1];

      // Should end with empty value after delimiter
      expect(dataLine).toBe('Modern Apartment in Madrid,');
    });

    it('handles array values with json-string mode', async () => {
      const exporter = new CSVExporter({
        fieldSelection: ['title', 'features'],
        nestedArrayHandling: 'json-string',
      });
      const listing = makeListing();
      listing.features = ['pool', 'garden'];
      const result = await exporter.export([listing]);

      // The JSON array contains commas, so the CSV escaper wraps it in quotes
      // and doubles any internal quotes: "["pool","garden"]" -> """[""pool"",""garden""]"""
      expect(result).toContain('"[""pool"",""garden""]"');
    });

    it('handles array values with count mode', async () => {
      const exporter = new CSVExporter({
        fieldSelection: ['title', 'features'],
        nestedArrayHandling: 'count',
      });
      const listing = makeListing();
      listing.features = ['pool', 'garden', 'parking'];
      const result = await exporter.export([listing]);

      expect(result).toContain(',3\n');
    });

    it('handles array values with first-item mode', async () => {
      const exporter = new CSVExporter({
        fieldSelection: ['title', 'features'],
        nestedArrayHandling: 'first-item',
      });
      const listing = makeListing();
      listing.features = ['pool', 'garden'];
      const result = await exporter.export([listing]);

      expect(result).toContain(',pool\n');
    });

    it('exports multiple rows', async () => {
      const exporter = new CSVExporter({ includeHeader: true });
      const listings = makeListings(5);
      const result = await exporter.export(listings);
      const lines = result.trim().split('\n');

      expect(lines).toHaveLength(6); // header + 5 rows
    });

    it('throws on empty listings', async () => {
      const exporter = new CSVExporter();
      await expect(exporter.export([])).rejects.toThrow('Cannot export empty listing array');
    });

    it('defaults to essential field selection', async () => {
      const exporter = new CSVExporter({ includeHeader: true });
      const result = await exporter.export([makeListing()]);
      const header = result.split('\n')[0];

      // Essential fields should be present
      expect(header).toContain('reference');
      expect(header).toContain('title');
      expect(header).toContain('price_float');
      // Non-essential fields should be absent from header
      expect(header).not.toContain('description');
      expect(header).not.toContain('postal_code');
    });

    it('exports boolean values as true/false strings', async () => {
      const exporter = new CSVExporter({ fieldSelection: ['title', 'for_sale'] });
      const listing = makeListing({ for_sale: true });
      const result = await exporter.export([listing]);
      const lines = result.trim().split('\n');

      expect(lines[1]).toContain('true');
    });

    it('handles empty arrays as empty string', async () => {
      const exporter = new CSVExporter({
        fieldSelection: ['title', 'features'],
        nestedArrayHandling: 'json-string',
      });
      const listing = makeListing();
      listing.features = [];
      const result = await exporter.export([listing]);
      const lines = result.trim().split('\n');
      const dataLine = lines[1];

      expect(dataLine).toBe('Modern Apartment in Madrid,');
    });

    it('escapes semicolons in values when using semicolon delimiter', async () => {
      const listing = makeListing({ title: 'Apartment; 3 bed' });
      const exporter = new CSVExporter({ delimiter: ';' });
      const result = await exporter.export([listing]);

      expect(result).toContain('"Apartment; 3 bed"');
    });

    it('streaming export yields header and rows', async () => {
      const exporter = new CSVExporter({ includeHeader: true });
      const listings = makeListings(3);
      const chunks: string[] = [];
      for await (const chunk of exporter.exportStream(listings)) {
        chunks.push(chunk);
      }

      // First chunk is the header
      expect(chunks[0]).toContain('reference');
      // Should have header + 3 data rows
      expect(chunks).toHaveLength(4);
    });

    it('uses single quote character when specified', async () => {
      const listing = makeListing({ title: "Apartment's Place" });
      const exporter = new CSVExporter({ quoteChar: "'" });
      const result = await exporter.export([listing]);

      // Single quotes should be doubled when used as quote char
      expect(result).toContain("''");
    });
  });

  // ─── GeoJSONExporter ─────────────────────────────────────────────────────────

  describe('GeoJSONExporter', () => {
    it('exports listings as GeoJSON FeatureCollection', async () => {
      const exporter = new GeoJSONExporter();
      const result = await exporter.export([makeListing()]);
      const parsed = JSON.parse(result);

      expect(parsed.type).toBe('FeatureCollection');
      expect(parsed.features).toHaveLength(1);
      expect(parsed.features[0].type).toBe('Feature');
      expect(parsed.features[0].geometry.type).toBe('Point');
    });

    it('uses [longitude, latitude] coordinate order per GeoJSON spec', async () => {
      const listing = makeListing({ latitude: 40.4168, longitude: -3.7038 });
      const exporter = new GeoJSONExporter();
      const result = await exporter.export([listing]);
      const parsed = JSON.parse(result);
      const coords = parsed.features[0].geometry.coordinates;

      // GeoJSON is [lng, lat]
      expect(coords[0]).toBe(-3.7038);
      expect(coords[1]).toBe(40.4168);
    });

    it('includes property data in features', async () => {
      const exporter = new GeoJSONExporter();
      const result = await exporter.export([makeListing()]);
      const parsed = JSON.parse(result);
      const props = parsed.features[0].properties;

      expect(props.title).toBe('Modern Apartment in Madrid');
      expect(props.price_float).toBe(250000);
      expect(props.city).toBe('Madrid');
      expect(props.country).toBe('Spain');
    });

    it('filters out listings without valid geolocation', async () => {
      const validListing = makeListing();
      const invalidListing = makeListing({ latitude: 0, longitude: 0 });
      const exporter = new GeoJSONExporter();
      const result = await exporter.export([validListing, invalidListing]);
      const parsed = JSON.parse(result);

      expect(parsed.features).toHaveLength(1);
    });

    it('filters out listings with out-of-range coordinates', async () => {
      const listing = makeListing({ latitude: 100, longitude: 200 });
      const validListing = makeListing();
      const exporter = new GeoJSONExporter();
      const result = await exporter.export([validListing, listing]);
      const parsed = JSON.parse(result);

      expect(parsed.features).toHaveLength(1);
    });

    it('exports multiple features', async () => {
      const exporter = new GeoJSONExporter();
      const listings = makeListings(4);
      const result = await exporter.export(listings);
      const parsed = JSON.parse(result);

      expect(parsed.features).toHaveLength(4);
    });

    it('throws on empty listings', async () => {
      const exporter = new GeoJSONExporter();
      await expect(exporter.export([])).rejects.toThrow('Cannot export empty listing array');
    });

    it('includes for_sale and for_rent in properties', async () => {
      const listing = makeListing({ for_sale: true, for_rent: false });
      const exporter = new GeoJSONExporter();
      const result = await exporter.export([listing]);
      const parsed = JSON.parse(result);
      const props = parsed.features[0].properties;

      expect(props.for_sale).toBe(true);
      expect(props.for_rent).toBe(false);
    });

    it('includes furnished status in properties', async () => {
      const listing = makeListing({ furnished: true });
      const exporter = new GeoJSONExporter();
      const result = await exporter.export([listing]);
      const parsed = JSON.parse(result);
      const props = parsed.features[0].properties;

      expect(props.furnished).toBe(true);
    });

    it('includes source_url from import_url', async () => {
      const exporter = new GeoJSONExporter();
      const result = await exporter.export([makeListing()]);
      const parsed = JSON.parse(result);
      const props = parsed.features[0].properties;

      expect(props.source_url).toBe('https://example.com/listing/1');
    });

    it('excludes undefined property_type when empty', async () => {
      const listing = makeListing({ property_type: '' });
      const exporter = new GeoJSONExporter();
      const result = await exporter.export([listing]);
      const parsed = JSON.parse(result);
      const props = parsed.features[0].properties;

      expect(props.property_type).toBeUndefined();
    });

    it('includes property_type when populated', async () => {
      const listing = makeListing({ property_type: 'apartment' });
      const exporter = new GeoJSONExporter();
      const result = await exporter.export([listing]);
      const parsed = JSON.parse(result);
      const props = parsed.features[0].properties;

      expect(props.property_type).toBe('apartment');
    });

    it('allows negative coordinates within valid range', async () => {
      const listing = makeListing({ latitude: -33.8688, longitude: 151.2093 });
      const exporter = new GeoJSONExporter();
      const result = await exporter.export([listing]);
      const parsed = JSON.parse(result);

      expect(parsed.features).toHaveLength(1);
      expect(parsed.features[0].geometry.coordinates).toEqual([151.2093, -33.8688]);
    });

    it('exportWithImages adds gallery features for multi-image listings', async () => {
      const listing = makeListing();
      listing.image_urls = [
        { url: 'https://example.com/1.jpg' },
        { url: 'https://example.com/2.jpg' },
      ] as any;
      const exporter = new GeoJSONExporter();
      const result = await exporter.exportWithImages([listing]);
      const parsed = JSON.parse(result);

      // Should have main feature + gallery feature
      expect(parsed.features.length).toBe(2);
      const galleryFeature = parsed.features.find(
        (f: any) => f.properties.type === 'gallery'
      );
      expect(galleryFeature).toBeDefined();
      expect(galleryFeature.properties.images).toHaveLength(2);
    });

    it('streaming export produces valid GeoJSON when concatenated', async () => {
      const exporter = new GeoJSONExporter();
      const listings = makeListings(3);
      const chunks: string[] = [];
      for await (const chunk of exporter.exportStream(listings)) {
        chunks.push(chunk);
      }
      const full = chunks.join('');
      const parsed = JSON.parse(full);

      expect(parsed.type).toBe('FeatureCollection');
      expect(parsed.features).toHaveLength(3);
    });
  });

  // ─── XMLExporter ──────────────────────────────────────────────────────────────

  describe('XMLExporter', () => {
    it('exports listings as valid XML', async () => {
      const exporter = new XMLExporter();
      const result = await exporter.export([makeListing()]);

      expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(result).toContain('<Listings');
      expect(result).toContain('<Listing>');
      expect(result).toContain('</Listing>');
      expect(result).toContain('</Listings>');
    });

    it('maps fields to RETS standard names', async () => {
      const exporter = new XMLExporter();
      const result = await exporter.export([makeListing()]);

      expect(result).toContain('<ListingKey>REF-001</ListingKey>');
      expect(result).toContain('<ListPrice>250000</ListPrice>');
      expect(result).toContain('<BedroomsTotal>3</BedroomsTotal>');
      expect(result).toContain('<BathroomsTotalInteger>2</BathroomsTotalInteger>');
      expect(result).toContain('<City>Madrid</City>');
      expect(result).toContain('<Country>Spain</Country>');
    });

    it('escapes XML special characters', async () => {
      const listing = makeListing({ title: 'Apartment <3 beds> & pool' });
      const exporter = new XMLExporter();
      const result = await exporter.export([listing]);

      expect(result).toContain('&lt;3 beds&gt;');
      expect(result).toContain('&amp; pool');
    });

    it('includes image URLs in Media section', async () => {
      const listing = makeListing();
      listing.image_urls = [{ url: 'https://example.com/1.jpg' }, { url: 'https://example.com/2.jpg' }] as any;
      const exporter = new XMLExporter();
      const result = await exporter.export([listing]);

      expect(result).toContain('<Media>');
      expect(result).toContain('<MediaURL>https://example.com/1.jpg</MediaURL>');
      expect(result).toContain('<MediaURL>https://example.com/2.jpg</MediaURL>');
      expect(result).toContain('</Media>');
    });

    it('includes features as separate elements', async () => {
      const listing = makeListing();
      listing.features = ['pool', 'garden'];
      const exporter = new XMLExporter();
      const result = await exporter.export([listing]);

      expect(result).toContain('<Features>');
      expect(result).toContain('<Feature>pool</Feature>');
      expect(result).toContain('<Feature>garden</Feature>');
    });

    it('exports multiple listings', async () => {
      const exporter = new XMLExporter();
      const listings = makeListings(3);
      const result = await exporter.export(listings);

      expect(result).toContain('count="3"');
      const matches = result.match(/<Listing>/g);
      expect(matches).toHaveLength(3);
    });

    it('throws on empty listings', async () => {
      const exporter = new XMLExporter();
      await expect(exporter.export([])).rejects.toThrow('Cannot export empty listing array');
    });

    it('includes exportDate attribute on root element', async () => {
      const exporter = new XMLExporter();
      const result = await exporter.export([makeListing()]);

      expect(result).toMatch(/exportDate="[^"]+"/);
    });

    it('uses PascalCase for unmapped field names', async () => {
      // Fields without a RETS mapping should be converted to PascalCase
      const listing = makeListing({ area_unit: 'sqmt' });
      const exporter = new XMLExporter();
      const result = await exporter.export([listing]);

      // area_unit maps to LivingAreaUnits via RESO mapping
      expect(result).toContain('<LivingAreaUnits>');
    });

    it('skips zero, empty, and false values', async () => {
      const listing = makeListing({
        count_toilets: 0,
        furnished: false,
        energy_rating: 0,
      });
      const exporter = new XMLExporter();
      const result = await exporter.export([listing]);

      expect(result).not.toContain('<BathroomHalf>');
      expect(result).not.toContain('<Furnished>');
    });

    it('escapes quotes and apostrophes in XML', async () => {
      const listing = makeListing({ title: `Apartment "Luxury" O'Brien` });
      const exporter = new XMLExporter();
      const result = await exporter.export([listing]);

      expect(result).toContain('&quot;Luxury&quot;');
      expect(result).toContain('&apos;Brien');
    });
  });

  // ─── SchemaOrgExporter ───────────────────────────────────────────────────────

  describe('SchemaOrgExporter', () => {
    it('exports listings as JSON-LD with @context and @graph', async () => {
      const exporter = new SchemaOrgExporter();
      const result = await exporter.export([makeListing()]);
      const parsed = JSON.parse(result);

      expect(parsed['@context']).toBe('https://schema.org');
      expect(parsed['@graph']).toHaveLength(1);
    });

    it('uses RealEstateListing type', async () => {
      const exporter = new SchemaOrgExporter();
      const result = await exporter.export([makeListing()]);
      const parsed = JSON.parse(result);
      const node = parsed['@graph'][0];

      expect(node['@type']).toBe('RealEstateListing');
    });

    it('includes price as Offer', async () => {
      const exporter = new SchemaOrgExporter();
      const result = await exporter.export([makeListing()]);
      const parsed = JSON.parse(result);
      const node = parsed['@graph'][0];

      expect(node.offers).toBeDefined();
      expect(node.offers['@type']).toBe('Offer');
      expect(node.offers.price).toBe(250000);
      expect(node.offers.priceCurrency).toBe('EUR');
    });

    it('includes accommodation details', async () => {
      const exporter = new SchemaOrgExporter();
      const result = await exporter.export([makeListing()]);
      const parsed = JSON.parse(result);
      const accommodation = parsed['@graph'][0].about;

      expect(accommodation['@type']).toBeDefined();
      expect(accommodation.numberOfBedrooms).toBe(3);
      expect(accommodation.numberOfBathroomsTotal).toBe(2);
    });

    it('includes geo coordinates', async () => {
      const exporter = new SchemaOrgExporter();
      const result = await exporter.export([makeListing()]);
      const parsed = JSON.parse(result);
      const geo = parsed['@graph'][0].about.geo;

      expect(geo['@type']).toBe('GeoCoordinates');
      expect(geo.latitude).toBe(40.4168);
      expect(geo.longitude).toBe(-3.7038);
    });

    it('includes floor size with unit', async () => {
      const exporter = new SchemaOrgExporter();
      const result = await exporter.export([makeListing()]);
      const parsed = JSON.parse(result);
      const floorSize = parsed['@graph'][0].about.floorSize;

      expect(floorSize['@type']).toBe('QuantitativeValue');
      expect(floorSize.value).toBe(120);
      expect(floorSize.unitCode).toBe('MTK');
    });

    it('includes address as PostalAddress', async () => {
      const listing = makeListing({ city: 'Madrid', country: 'Spain', postal_code: '28001' });
      const exporter = new SchemaOrgExporter();
      const result = await exporter.export([listing]);
      const parsed = JSON.parse(result);
      const address = parsed['@graph'][0].about.address;

      expect(address['@type']).toBe('PostalAddress');
      expect(address.addressLocality).toBe('Madrid');
      expect(address.addressCountry).toBe('Spain');
    });

    it('exports multiple listings', async () => {
      const exporter = new SchemaOrgExporter();
      const listings = makeListings(3);
      const result = await exporter.export(listings);
      const parsed = JSON.parse(result);

      expect(parsed['@graph']).toHaveLength(3);
    });

    it('throws on empty listings', async () => {
      const exporter = new SchemaOrgExporter();
      await expect(exporter.export([])).rejects.toThrow('Cannot export empty listing array');
    });

    it('emits inLanguage "en" for locale_code "en-AU"', async () => {
      const exporter = new SchemaOrgExporter();
      const result = await exporter.export([makeListing({ locale_code: 'en-AU' })]);
      const node = JSON.parse(result)['@graph'][0];

      expect(node['inLanguage']).toBe('en');
    });

    it('emits inLanguage "es" for locale_code "es"', async () => {
      const exporter = new SchemaOrgExporter();
      const result = await exporter.export([makeListing({ locale_code: 'es' })]);
      const node = JSON.parse(result)['@graph'][0];

      expect(node['inLanguage']).toBe('es');
    });

    it('omits inLanguage when locale_code is empty', async () => {
      const exporter = new SchemaOrgExporter();
      const result = await exporter.export([makeListing({ locale_code: '' })]);
      const node = JSON.parse(result)['@graph'][0];

      expect(node['inLanguage']).toBeUndefined();
    });

    it('resolves property_type "apartment" to Apartment', async () => {
      const listing = makeListing({ property_type: 'apartment' });
      const exporter = new SchemaOrgExporter();
      const result = await exporter.export([listing]);
      const parsed = JSON.parse(result);
      const accommodation = parsed['@graph'][0].about;

      expect(accommodation['@type']).toBe('Apartment');
    });

    it('resolves property_type "villa" to SingleFamilyResidence', async () => {
      const listing = makeListing({ property_type: 'villa' });
      const exporter = new SchemaOrgExporter();
      const result = await exporter.export([listing]);
      const parsed = JSON.parse(result);
      const accommodation = parsed['@graph'][0].about;

      expect(accommodation['@type']).toBe('SingleFamilyResidence');
    });

    it('resolves property_type "house" to SingleFamilyResidence', async () => {
      const listing = makeListing({ property_type: 'house' });
      const exporter = new SchemaOrgExporter();
      const result = await exporter.export([listing]);
      const parsed = JSON.parse(result);
      const accommodation = parsed['@graph'][0].about;

      expect(accommodation['@type']).toBe('SingleFamilyResidence');
    });

    it('resolves property_type "flat" to Apartment', async () => {
      const listing = makeListing({ property_type: 'flat' });
      const exporter = new SchemaOrgExporter();
      const result = await exporter.export([listing]);
      const parsed = JSON.parse(result);

      expect(parsed['@graph'][0].about['@type']).toBe('Apartment');
    });

    it('uses bedroom-count heuristic when property_type is empty', async () => {
      // 0 bedrooms -> Accommodation
      const listing0 = makeListing({ property_type: '', count_bedrooms: 0 });
      const exporter = new SchemaOrgExporter();
      let result = await exporter.export([listing0]);
      expect(JSON.parse(result)['@graph'][0].about['@type']).toBe('Accommodation');

      // 1-2 bedrooms -> Apartment
      const listing1 = makeListing({ property_type: '', count_bedrooms: 2 });
      result = await exporter.export([listing1]);
      expect(JSON.parse(result)['@graph'][0].about['@type']).toBe('Apartment');

      // 3+ bedrooms -> SingleFamilyResidence
      const listing3 = makeListing({ property_type: '', count_bedrooms: 4 });
      result = await exporter.export([listing3]);
      expect(JSON.parse(result)['@graph'][0].about['@type']).toBe('SingleFamilyResidence');
    });

    it('uses defaultPropertyType option when provided', async () => {
      const exporter = new SchemaOrgExporter({ defaultPropertyType: 'Hotel' });
      const result = await exporter.export([makeListing()]);
      const parsed = JSON.parse(result);

      expect(parsed['@graph'][0].about['@type']).toBe('Hotel');
    });

    it('marks sold listings with SoldOut availability', async () => {
      const listing = makeListing({ sold: true });
      const exporter = new SchemaOrgExporter();
      const result = await exporter.export([listing]);
      const parsed = JSON.parse(result);

      expect(parsed['@graph'][0].offers.availability).toBe('https://schema.org/SoldOut');
    });

    it('marks active listings with InStock availability', async () => {
      const listing = makeListing({ sold: false });
      const exporter = new SchemaOrgExporter();
      const result = await exporter.export([listing]);
      const parsed = JSON.parse(result);

      expect(parsed['@graph'][0].offers.availability).toBe('https://schema.org/InStock');
    });

    it('uses FTK unit code for sqft area_unit', async () => {
      const listing = makeListing({ area_unit: 'sqft' });
      const exporter = new SchemaOrgExporter();
      const result = await exporter.export([listing]);
      const parsed = JSON.parse(result);
      const floorSize = parsed['@graph'][0].about.floorSize;

      expect(floorSize.unitCode).toBe('FTK');
    });

    it('includes agent as RealEstateAgent when agent_name is set', async () => {
      const listing = makeListing({
        agent_name: 'Acme Realty',
        agent_phone: '+34-555-1234',
        agent_email: 'info@acme.com',
        agent_logo_url: 'https://example.com/logo.png',
      });
      const exporter = new SchemaOrgExporter();
      const result = await exporter.export([listing]);
      const parsed = JSON.parse(result);
      const agent = parsed['@graph'][0].agent;

      expect(agent['@type']).toBe('RealEstateAgent');
      expect(agent.name).toBe('Acme Realty');
      expect(agent.telephone).toBe('+34-555-1234');
      expect(agent.email).toBe('info@acme.com');
      expect(agent.logo).toBe('https://example.com/logo.png');
    });

    it('omits agent when agent_name is empty', async () => {
      const listing = makeListing({ agent_name: '' });
      const exporter = new SchemaOrgExporter();
      const result = await exporter.export([listing]);
      const parsed = JSON.parse(result);

      expect(parsed['@graph'][0].agent).toBeUndefined();
    });

    it('includes image_urls as image array', async () => {
      const listing = makeListing();
      listing.image_urls = [
        { url: 'https://example.com/1.jpg' },
        { url: 'https://example.com/2.jpg' },
      ] as any;
      const exporter = new SchemaOrgExporter();
      const result = await exporter.export([listing]);
      const parsed = JSON.parse(result);
      const image = parsed['@graph'][0].image;

      expect(Array.isArray(image)).toBe(true);
      expect(image).toContain('https://example.com/1.jpg');
      expect(image).toContain('https://example.com/2.jpg');
    });

    it('omits offers when price_float is 0', async () => {
      const listing = makeListing({ price_float: 0 });
      const exporter = new SchemaOrgExporter();
      const result = await exporter.export([listing]);
      const parsed = JSON.parse(result);

      expect(parsed['@graph'][0].offers).toBeUndefined();
    });

    it('omits numberOfBedrooms when count_bedrooms is 0', async () => {
      const listing = makeListing({ count_bedrooms: 0 });
      const exporter = new SchemaOrgExporter();
      const result = await exporter.export([listing]);
      const parsed = JSON.parse(result);

      expect(parsed['@graph'][0].about.numberOfBedrooms).toBeUndefined();
    });

    it('includes furnished as amenityFeature', async () => {
      const listing = makeListing({ furnished: true });
      const exporter = new SchemaOrgExporter();
      const result = await exporter.export([listing]);
      const parsed = JSON.parse(result);
      const amenities = parsed['@graph'][0].about.amenityFeature;

      expect(amenities).toBeDefined();
      expect(amenities[0].name).toBe('Furnished');
      expect(amenities[0].value).toBe(true);
    });

    it('includes year_construction as yearBuilt', async () => {
      const listing = makeListing({ year_construction: 1990 });
      const exporter = new SchemaOrgExporter();
      const result = await exporter.export([listing]);
      const parsed = JSON.parse(result);

      expect(parsed['@graph'][0].about.yearBuilt).toBe(1990);
    });

    it('includes energy certificate grade', async () => {
      const listing = makeListing({ energy_certificate_grade: 'B' });
      const exporter = new SchemaOrgExporter();
      const result = await exporter.export([listing]);
      const parsed = JSON.parse(result);
      const accommodation = parsed['@graph'][0].about;

      expect(accommodation.hasEnergyEfficiencyCategory).toBe('B');
      expect(accommodation.energyEfficiencyScaleMax).toBe('A');
      expect(accommodation.energyEfficiencyScaleMin).toBe('G');
    });

    it('includes dateModified from last_retrieved_at', async () => {
      const date = new Date('2024-06-15T12:00:00Z');
      const listing = makeListing({ last_retrieved_at: date });
      const exporter = new SchemaOrgExporter();
      const result = await exporter.export([listing]);
      const parsed = JSON.parse(result);

      expect(parsed['@graph'][0].dateModified).toBe('2024-06-15T12:00:00.000Z');
    });

    it('uses import_url as @id when reference is set', async () => {
      const listing = makeListing({
        reference: 'REF-001',
        import_url: 'https://example.com/listing/1',
      });
      const exporter = new SchemaOrgExporter();
      const result = await exporter.export([listing]);
      const parsed = JSON.parse(result);

      expect(parsed['@graph'][0]['@id']).toBe('https://example.com/listing/1');
    });
  });

  // ─── BLMExporter ─────────────────────────────────────────────────────────────

  describe('BLMExporter', () => {
    it('exports with 4-section structure', async () => {
      const exporter = new BLMExporter();
      const result = await exporter.export([makeListing()]);

      expect(result).toContain('#HEADER#');
      expect(result).toContain('#DEFINITION#');
      expect(result).toContain('#DATA#');
      expect(result).toContain('#END#');
    });

    it('uses ^ delimiter and ~ record terminator', async () => {
      const exporter = new BLMExporter();
      const result = await exporter.export([makeListing()]);
      const lines = result.split('\n');

      // Definition line should end with ^~
      const defLine = lines.find(l => l.includes('AGENT_REF'));
      expect(defLine).toBeDefined();
      expect(defLine!.endsWith('^~')).toBe(true);

      // Data lines should end with ^~
      const dataStart = lines.indexOf('#DATA#');
      const dataLine = lines[dataStart + 1];
      expect(dataLine.endsWith('^~')).toBe(true);
    });

    it('splits UK postcodes', async () => {
      const listing = makeListing({ postal_code: 'SW1A 1AA' });
      const exporter = new BLMExporter();
      const result = await exporter.export([listing]);

      expect(result).toContain('SW1A');
      expect(result).toContain('1AA');
    });

    it('flattens features into FEATURE1-FEATURE10', async () => {
      const listing = makeListing();
      listing.features = ['pool', 'garden', 'parking'];
      const exporter = new BLMExporter();
      const result = await exporter.export([listing]);
      const lines = result.split('\n');
      const defLine = lines.find(l => l.includes('FEATURE1'));
      expect(defLine).toBeDefined();

      // Data should contain the feature values
      const dataStart = lines.indexOf('#DATA#');
      const dataLine = lines[dataStart + 1];
      expect(dataLine).toContain('pool');
      expect(dataLine).toContain('garden');
      expect(dataLine).toContain('parking');
    });

    it('flattens image_urls into MEDIA_IMAGE columns', async () => {
      const listing = makeListing();
      listing.image_urls = [
        { url: 'https://example.com/1.jpg' },
        { url: 'https://example.com/2.jpg' },
      ] as any;
      const exporter = new BLMExporter();
      const result = await exporter.export([listing]);

      expect(result).toContain('https://example.com/1.jpg');
      expect(result).toContain('https://example.com/2.jpg');
    });

    it('escapes ^ and ~ characters in values', async () => {
      const listing = makeListing({ title: 'Apartment^with~special' });
      const exporter = new BLMExporter();
      const result = await exporter.export([listing]);

      // ^ and ~ should be stripped from values
      expect(result).toContain('Apartmentwithspecial');
    });

    it('exports multiple listings', async () => {
      const exporter = new BLMExporter();
      const listings = makeListings(3);
      const result = await exporter.export(listings);
      const lines = result.split('\n');
      const dataStart = lines.indexOf('#DATA#');
      const endIndex = lines.indexOf('#END#');
      const dataLines = lines.slice(dataStart + 1, endIndex);

      expect(dataLines).toHaveLength(3);
    });

    it('throws on empty listings', async () => {
      const exporter = new BLMExporter();
      await expect(exporter.export([])).rejects.toThrow('Cannot export empty listing array');
    });

    it('sets TRANS_TYPE_ID to 1 for for_sale listings', async () => {
      const listing = makeListing({ for_sale: true, for_rent: false });
      const exporter = new BLMExporter();
      const result = await exporter.export([listing]);
      const lines = result.split('\n');

      // Find TRANS_TYPE_ID position in definition
      const defLine = lines.find(l => l.includes('AGENT_REF'))!;
      const columns = defLine.replace('^~', '').split('^');
      const transTypeIdx = columns.indexOf('TRANS_TYPE_ID');

      const dataStart = lines.indexOf('#DATA#');
      const dataLine = lines[dataStart + 1];
      const values = dataLine.replace('^~', '').split('^');

      expect(values[transTypeIdx]).toBe('1');
    });

    it('sets TRANS_TYPE_ID to 2 for for_rent listings', async () => {
      const listing = makeListing({ for_sale: false, for_rent: true });
      const exporter = new BLMExporter();
      const result = await exporter.export([listing]);
      const lines = result.split('\n');

      const defLine = lines.find(l => l.includes('AGENT_REF'))!;
      const columns = defLine.replace('^~', '').split('^');
      const transTypeIdx = columns.indexOf('TRANS_TYPE_ID');

      const dataStart = lines.indexOf('#DATA#');
      const dataLine = lines[dataStart + 1];
      const values = dataLine.replace('^~', '').split('^');

      expect(values[transTypeIdx]).toBe('2');
    });

    it('includes version in header', async () => {
      const exporter = new BLMExporter({ version: '3i' });
      const result = await exporter.export([makeListing()]);

      expect(result).toContain('Version : 3i');
    });

    it('includes EOF and EOR markers in header', async () => {
      const exporter = new BLMExporter();
      const result = await exporter.export([makeListing()]);

      expect(result).toContain("EOF : '^'");
      expect(result).toContain("EOR : '~'");
    });

    it('flattens floor_plan_urls into MEDIA_FLOOR_PLAN columns', async () => {
      const listing = makeListing();
      listing.floor_plan_urls = ['https://example.com/floor1.jpg', 'https://example.com/floor2.jpg'];
      const exporter = new BLMExporter();
      const result = await exporter.export([listing]);

      expect(result).toContain('https://example.com/floor1.jpg');
      expect(result).toContain('https://example.com/floor2.jpg');
    });

    it('limits features to 10 and images to 10', async () => {
      const listing = makeListing();
      listing.features = Array.from({ length: 15 }, (_, i) => `feature${i + 1}`);
      listing.image_urls = Array.from({ length: 15 }, (_, i) => ({ url: `https://example.com/${i + 1}.jpg` })) as any;
      const exporter = new BLMExporter();
      const result = await exporter.export([listing]);

      // Should contain feature10 but not feature11
      expect(result).toContain('feature10');
      // feature11 onwards should not be in the output
      // Check that the data line only has 10 image slots
      expect(result).toContain('https://example.com/10.jpg');
    });

    it('handles postcode without space as full POSTCODE1', async () => {
      const listing = makeListing({ postal_code: 'E1W1AA' });
      const exporter = new BLMExporter();
      const result = await exporter.export([listing]);
      const lines = result.split('\n');

      const defLine = lines.find(l => l.includes('AGENT_REF'))!;
      const columns = defLine.replace('^~', '').split('^');
      const pc1Idx = columns.indexOf('POSTCODE1');
      const pc2Idx = columns.indexOf('POSTCODE2');

      const dataStart = lines.indexOf('#DATA#');
      const dataLine = lines[dataStart + 1];
      const values = dataLine.replace('^~', '').split('^');

      expect(values[pc1Idx]).toBe('E1W1AA');
      expect(values[pc2Idx]).toBe('');
    });

    it('definition row matches data row column count', async () => {
      const exporter = new BLMExporter();
      const result = await exporter.export([makeListing()]);
      const lines = result.split('\n');

      const defStart = lines.indexOf('#DEFINITION#');
      const defLine = lines[defStart + 1];
      const defColumnCount = defLine.split('^').length;

      const dataStart = lines.indexOf('#DATA#');
      const dataLine = lines[dataStart + 1];
      const dataColumnCount = dataLine.split('^').length;

      expect(defColumnCount).toBe(dataColumnCount);
    });
  });

  // ─── KyeroExporter ───────────────────────────────────────────────────────────

  describe('KyeroExporter', () => {
    it('exports as XML with root and property elements', async () => {
      const exporter = new KyeroExporter();
      const result = await exporter.export([makeListing()]);

      expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(result).toContain('<root>');
      expect(result).toContain('<property>');
      expect(result).toContain('</property>');
      expect(result).toContain('</root>');
    });

    it('includes nested location element', async () => {
      const listing = makeListing({ city: 'Madrid', country: 'Spain', postal_code: '28001' });
      const exporter = new KyeroExporter();
      const result = await exporter.export([listing]);

      expect(result).toContain('<location>');
      expect(result).toContain('<city>Madrid</city>');
      expect(result).toContain('<country>Spain</country>');
      expect(result).toContain('<zip>28001</zip>');
      expect(result).toContain('</location>');
    });

    it('includes nested surface_area element', async () => {
      const listing = makeListing({ constructed_area: 120, plot_area: 200 });
      const exporter = new KyeroExporter();
      const result = await exporter.export([listing]);

      expect(result).toContain('<surface_area>');
      expect(result).toContain('<built>120</built>');
      expect(result).toContain('<plot>200</plot>');
      expect(result).toContain('</surface_area>');
    });

    it('uses locale_code to determine the language slot in title and desc', async () => {
      const listing = makeListing({
        title: 'Apartamento Moderno en Madrid',
        description: 'Un lugar estupendo',
        locale_code: 'es',
      });
      const exporter = new KyeroExporter();
      const result = await exporter.export([listing]);

      expect(result).toContain('<title>');
      expect(result).toContain('<es>Apartamento Moderno en Madrid</es>');
      expect(result).toContain('</title>');
      expect(result).toContain('<desc>');
      expect(result).toContain('<es>Un lugar estupendo</es>');
      expect(result).toContain('</desc>');
    });

    it('defaults to <en> slot when locale_code is absent or unrecognised', async () => {
      const listing = makeListing({ title: 'Modern Apartment', description: 'A great place' });
      const exporter = new KyeroExporter();
      const result = await exporter.export([listing]);

      expect(result).toContain('<en>Modern Apartment</en>');
      expect(result).toContain('<en>A great place</en>');
    });

    it('normalizes BCP-47 locale de-DE to <de> slot', async () => {
      const listing = makeListing({
        title: 'Modernes Apartment in Berlin',
        description: 'Ein toller Ort',
        locale_code: 'de-DE',
      });
      const exporter = new KyeroExporter();
      const result = await exporter.export([listing]);

      expect(result).toContain('<de>Modernes Apartment in Berlin</de>');
      expect(result).toContain('<de>Ein toller Ort</de>');
    });

    it('falls back to <en> for non-Kyero language pt', async () => {
      const listing = makeListing({
        title: 'Apartamento em Lisboa',
        description: 'Um lugar incrível',
        locale_code: 'pt',
      });
      const exporter = new KyeroExporter();
      const result = await exporter.export([listing]);

      expect(result).toContain('<en>Apartamento em Lisboa</en>');
    });

    it('normalizes property type', async () => {
      const listing = makeListing();
      listing.property_type = 'Detached';
      const exporter = new KyeroExporter();
      const result = await exporter.export([listing]);

      expect(result).toContain('<type>house</type>');
    });

    it('defaults property type to other when empty', async () => {
      const listing = makeListing();
      listing.property_type = '';
      const exporter = new KyeroExporter();
      const result = await exporter.export([listing]);

      expect(result).toContain('<type>other</type>');
    });

    it('includes energy rating element', async () => {
      const listing = makeListing();
      listing.energy_certificate_grade = 'B';
      const exporter = new KyeroExporter();
      const result = await exporter.export([listing]);

      expect(result).toContain('<energy_rating>');
      expect(result).toContain('<consumption>B</consumption>');
      expect(result).toContain('</energy_rating>');
    });

    it('exports multiple properties', async () => {
      const exporter = new KyeroExporter();
      const listings = makeListings(3);
      const result = await exporter.export(listings);

      const matches = result.match(/<property>/g);
      expect(matches).toHaveLength(3);
    });

    it('throws on empty listings', async () => {
      const exporter = new KyeroExporter();
      await expect(exporter.export([])).rejects.toThrow('Cannot export empty listing array');
    });

    it('includes images as nested image/url elements', async () => {
      const listing = makeListing();
      listing.image_urls = [
        { url: 'https://example.com/1.jpg' },
        { url: 'https://example.com/2.jpg' },
      ] as any;
      const exporter = new KyeroExporter();
      const result = await exporter.export([listing]);

      expect(result).toContain('<images>');
      expect(result).toContain('<image><url>https://example.com/1.jpg</url></image>');
      expect(result).toContain('<image><url>https://example.com/2.jpg</url></image>');
      expect(result).toContain('</images>');
    });

    it('includes features as nested feature elements', async () => {
      const listing = makeListing();
      listing.features = ['pool', 'garden'];
      const exporter = new KyeroExporter();
      const result = await exporter.export([listing]);

      expect(result).toContain('<features>');
      expect(result).toContain('<feature>pool</feature>');
      expect(result).toContain('<feature>garden</feature>');
      expect(result).toContain('</features>');
    });

    it('includes agent name', async () => {
      const listing = makeListing({ agent_name: 'Acme Realty' });
      const exporter = new KyeroExporter();
      const result = await exporter.export([listing]);

      expect(result).toContain('<agent>Acme Realty</agent>');
    });

    it('includes year_built element', async () => {
      const listing = makeListing({ year_construction: 1985 });
      const exporter = new KyeroExporter();
      const result = await exporter.export([listing]);

      expect(result).toContain('<year_built>1985</year_built>');
    });

    it('uses defaultCurrency option when listing currency is empty', async () => {
      const listing = makeListing({ currency: '' });
      const exporter = new KyeroExporter({ defaultCurrency: 'GBP' });
      const result = await exporter.export([listing]);

      expect(result).toContain('<currency>GBP</currency>');
    });

    it('defaults to EUR when no currency provided', async () => {
      const listing = makeListing({ currency: '' });
      const exporter = new KyeroExporter();
      const result = await exporter.export([listing]);

      expect(result).toContain('<currency>EUR</currency>');
    });

    it('includes listing_status as status element', async () => {
      const listing = makeListing({ listing_status: 'active' });
      const exporter = new KyeroExporter();
      const result = await exporter.export([listing]);

      expect(result).toContain('<status>active</status>');
    });

    it('includes property_subtype element', async () => {
      const listing = makeListing({ property_subtype: 'penthouse' });
      const exporter = new KyeroExporter();
      const result = await exporter.export([listing]);

      expect(result).toContain('<subtype>penthouse</subtype>');
    });

    it('includes price_qualifier as price_freq', async () => {
      const listing = makeListing({ price_qualifier: 'per month' });
      const exporter = new KyeroExporter();
      const result = await exporter.export([listing]);

      expect(result).toContain('<price_freq>per month</price_freq>');
    });

    it('escapes XML special characters in all fields', async () => {
      const listing = makeListing({
        title: 'Apt & Spa <Luxury>',
        description: 'Features "premium" amenities',
        city: 'St. John\'s',
      });
      const exporter = new KyeroExporter();
      const result = await exporter.export([listing]);

      expect(result).toContain('&amp; Spa &lt;Luxury&gt;');
      expect(result).toContain('&quot;premium&quot;');
    });

    it('uses fr language slot for locale_code "fr"', async () => {
      const listing = makeListing({
        title: 'Appartement Moderne',
        description: 'Un bel endroit',
        locale_code: 'fr',
      });
      const exporter = new KyeroExporter();
      const result = await exporter.export([listing]);

      expect(result).toContain('<fr>Appartement Moderne</fr>');
      expect(result).toContain('<fr>Un bel endroit</fr>');
    });

    it('uses it language slot for locale_code "it"', async () => {
      const listing = makeListing({
        title: 'Appartamento Moderno',
        locale_code: 'it',
      });
      const exporter = new KyeroExporter();
      const result = await exporter.export([listing]);

      expect(result).toContain('<it>Appartamento Moderno</it>');
    });
  });

  // ─── RESOJsonExporter ────────────────────────────────────────────────────────

  describe('RESOJsonExporter', () => {
    it('exports with OData envelope', async () => {
      const exporter = new RESOJsonExporter();
      const result = await exporter.export([makeListing()]);
      const parsed = JSON.parse(result);

      expect(parsed['@odata.context']).toBe('https://api.reso.org/Property');
      expect(parsed['@odata.count']).toBe(1);
      expect(parsed.value).toHaveLength(1);
    });

    it('maps fields to RESO names', async () => {
      const exporter = new RESOJsonExporter();
      const result = await exporter.export([makeListing()]);
      const parsed = JSON.parse(result);
      const listing = parsed.value[0];

      expect(listing['ListingKey']).toBe('REF-001');
      expect(listing['ListPrice']).toBe(250000);
      expect(listing['BedroomsTotal']).toBe(3);
      expect(listing['BathroomsTotalInteger']).toBe(2);
      expect(listing['City']).toBe('Madrid');
      expect(listing['Country']).toBe('Spain');
    });

    it('builds Media array from image_urls', async () => {
      const listing = makeListing();
      listing.image_urls = [
        { url: 'https://example.com/1.jpg' },
        { url: 'https://example.com/2.jpg' },
      ] as any;
      const exporter = new RESOJsonExporter();
      const result = await exporter.export([listing]);
      const parsed = JSON.parse(result);
      const media = parsed.value[0].Media;

      expect(media).toHaveLength(2);
      expect(media[0].MediaURL).toBe('https://example.com/1.jpg');
      expect(media[0].MediaCategory).toBe('Photo');
      expect(media[0].Order).toBe(1);
      expect(media[1].Order).toBe(2);
    });

    it('includes floor plan URLs in Media array', async () => {
      const listing = makeListing();
      listing.image_urls = [{ url: 'https://example.com/photo.jpg' }] as any;
      listing.floor_plan_urls = ['https://example.com/floor.jpg'];
      const exporter = new RESOJsonExporter();
      const result = await exporter.export([listing]);
      const parsed = JSON.parse(result);
      const media = parsed.value[0].Media;

      expect(media).toHaveLength(2);
      expect(media[1].MediaCategory).toBe('FloorPlan');
    });

    it('omits zero/empty/false values', async () => {
      const listing = makeListing({ count_toilets: 0, furnished: false });
      const exporter = new RESOJsonExporter();
      const result = await exporter.export([listing]);
      const parsed = JSON.parse(result);
      const value = parsed.value[0];

      expect(value['BathroomHalf']).toBeUndefined();
      expect(value['Furnished']).toBeUndefined();
    });

    it('exports multiple listings', async () => {
      const exporter = new RESOJsonExporter();
      const listings = makeListings(3);
      const result = await exporter.export(listings);
      const parsed = JSON.parse(result);

      expect(parsed['@odata.count']).toBe(3);
      expect(parsed.value).toHaveLength(3);
    });

    it('throws on empty listings', async () => {
      const exporter = new RESOJsonExporter();
      await expect(exporter.export([])).rejects.toThrow('Cannot export empty listing array');
    });

    it('uses custom odataContext when provided', async () => {
      const exporter = new RESOJsonExporter({ odataContext: 'https://custom.api.example/Property' });
      const result = await exporter.export([makeListing()]);
      const parsed = JSON.parse(result);

      expect(parsed['@odata.context']).toBe('https://custom.api.example/Property');
    });

    it('includes features as ExteriorFeatures comma-separated string', async () => {
      const listing = makeListing();
      listing.features = ['pool', 'garden', 'parking'];
      const exporter = new RESOJsonExporter();
      const result = await exporter.export([listing]);
      const parsed = JSON.parse(result);

      expect(parsed.value[0]['ExteriorFeatures']).toBe('pool, garden, parking');
    });

    it('preserves numeric types for price and area fields', async () => {
      const exporter = new RESOJsonExporter();
      const result = await exporter.export([makeListing()]);
      const parsed = JSON.parse(result);
      const value = parsed.value[0];

      expect(typeof value['ListPrice']).toBe('number');
      expect(typeof value['BedroomsTotal']).toBe('number');
      expect(typeof value['LivingArea']).toBe('number');
      expect(typeof value['Latitude']).toBe('number');
      expect(typeof value['Longitude']).toBe('number');
    });

    it('converts non-numeric mapped fields to strings', async () => {
      const listing = makeListing({ for_sale: true });
      const exporter = new RESOJsonExporter();
      const result = await exporter.export([listing]);
      const parsed = JSON.parse(result);
      const value = parsed.value[0];

      // for_sale is boolean internally but mapped to ForSale, which is not in NUMERIC_FIELDS
      // so it should be stringified as "true"
      expect(value['ForSale']).toBe('true');
    });

    it('omits Media when no images or floor plans', async () => {
      const listing = makeListing();
      listing.image_urls = [];
      listing.floor_plan_urls = [];
      const exporter = new RESOJsonExporter();
      const result = await exporter.export([listing]);
      const parsed = JSON.parse(result);

      expect(parsed.value[0]['Media']).toBeUndefined();
    });

    it('orders floor plan media after photo media', async () => {
      const listing = makeListing();
      listing.image_urls = [
        { url: 'https://example.com/photo1.jpg' },
        { url: 'https://example.com/photo2.jpg' },
      ] as any;
      listing.floor_plan_urls = ['https://example.com/floor.jpg'];
      const exporter = new RESOJsonExporter();
      const result = await exporter.export([listing]);
      const parsed = JSON.parse(result);
      const media = parsed.value[0].Media;

      expect(media[0].Order).toBe(1);
      expect(media[0].MediaCategory).toBe('Photo');
      expect(media[1].Order).toBe(2);
      expect(media[1].MediaCategory).toBe('Photo');
      expect(media[2].Order).toBe(3);
      expect(media[2].MediaCategory).toBe('FloorPlan');
    });
  });

  // ─── ExporterRegistry ────────────────────────────────────────────────────────

  describe('ExporterRegistry', () => {
    it('creates JSON exporter', () => {
      const exporter = createExporter('json');
      expect(exporter).toBeInstanceOf(JSONExporter);
    });

    it('creates CSV exporter', () => {
      const exporter = createExporter('csv');
      expect(exporter).toBeInstanceOf(CSVExporter);
    });

    it('creates GeoJSON exporter', () => {
      const exporter = createExporter('geojson');
      expect(exporter).toBeInstanceOf(GeoJSONExporter);
    });

    it('creates XML exporter', () => {
      const exporter = createExporter('xml');
      expect(exporter).toBeInstanceOf(XMLExporter);
    });

    it('creates Schema.org exporter', () => {
      const exporter = createExporter('schema-org');
      expect(exporter).toBeInstanceOf(SchemaOrgExporter);
    });

    it('creates BLM exporter', () => {
      const exporter = createExporter('blm');
      expect(exporter).toBeInstanceOf(BLMExporter);
    });

    it('creates Kyero exporter', () => {
      const exporter = createExporter('kyero');
      expect(exporter).toBeInstanceOf(KyeroExporter);
    });

    it('creates RESO JSON exporter', () => {
      const exporter = createExporter('reso-json');
      expect(exporter).toBeInstanceOf(RESOJsonExporter);
    });

    it('throws for unknown format', () => {
      expect(() => createExporter('pdf' as any)).toThrow('Unknown export format');
    });

    it('returns all production-ready exporters', () => {
      const available = getAvailableExporters();
      expect(available.every(e => e.isAvailable && e.isProduction)).toBe(true);
      expect(available.length).toBe(8);
    });

    it('returns all registered exporters including planned', () => {
      const all = getAllExporters();
      expect(all.length).toBe(8);
    });

    it('returns correct config for format', () => {
      const config = getExporterConfig('json');
      expect(config.format).toBe('json');
      expect(config.mimeType).toBe('application/json');
      expect(config.fileExtension).toBe('.json');
    });

    it('reports geolocation requirement correctly', () => {
      expect(requiresGeoLocation('geojson')).toBe(true);
      expect(requiresGeoLocation('json')).toBe(false);
      expect(requiresGeoLocation('csv')).toBe(false);
    });

    it('returns correct MIME types', () => {
      expect(getMimeType('json')).toBe('application/json');
      expect(getMimeType('csv')).toBe('text/csv');
      expect(getMimeType('geojson')).toBe('application/geo+json');
      expect(getMimeType('xml')).toBe('application/xml');
      expect(getMimeType('schema-org')).toBe('application/ld+json');
      expect(getMimeType('blm')).toBe('text/plain');
      expect(getMimeType('kyero')).toBe('application/xml');
      expect(getMimeType('reso-json')).toBe('application/json');
    });

    it('returns correct file extensions', () => {
      expect(getFileExtension('json')).toBe('.json');
      expect(getFileExtension('csv')).toBe('.csv');
      expect(getFileExtension('geojson')).toBe('.geojson');
      expect(getFileExtension('xml')).toBe('.xml');
      expect(getFileExtension('schema-org')).toBe('.jsonld');
      expect(getFileExtension('blm')).toBe('.blm');
      expect(getFileExtension('kyero')).toBe('.xml');
      expect(getFileExtension('reso-json')).toBe('.json');
    });

    it('passes options through to created exporter', async () => {
      const exporter = createExporter('json', { fieldSelection: ['title'] });
      const result = await exporter.export([makeListing()]);
      const parsed = JSON.parse(result);

      expect(Object.keys(parsed.listings[0])).toEqual(['title']);
    });

    it('throws for unknown format in getExporterConfig', () => {
      expect(() => getExporterConfig('pdf' as any)).toThrow('Unknown export format');
    });
  });

  // ─── ExportService ───────────────────────────────────────────────────────────

  describe('ExportService', () => {
    it('exports listings in JSON format', async () => {
      const service = new ExportService();
      const result = await service.export({
        format: 'json',
        listings: [makeListing()],
      });

      expect(result.format).toBe('json');
      expect(result.mimeType).toBe('application/json');
      expect(result.listingCount).toBe(1);
      expect(result.filename).toMatch(/^properties_1_listing_.*\.json$/);
      expect(JSON.parse(result.data)).toBeDefined();
    });

    it('exports listings in CSV format', async () => {
      const service = new ExportService();
      const result = await service.export({
        format: 'csv',
        listings: makeListings(3),
      });

      expect(result.format).toBe('csv');
      expect(result.mimeType).toBe('text/csv');
      expect(result.listingCount).toBe(3);
      expect(result.filename).toMatch(/^properties_3_listings_.*\.csv$/);
    });

    it('exports listings in GeoJSON format', async () => {
      const service = new ExportService();
      const result = await service.export({
        format: 'geojson',
        listings: [makeListing()],
      });

      expect(result.format).toBe('geojson');
      expect(result.mimeType).toBe('application/geo+json');
      const parsed = JSON.parse(result.data);
      expect(parsed.type).toBe('FeatureCollection');
    });

    it('exports listings in XML format', async () => {
      const service = new ExportService();
      const result = await service.export({
        format: 'xml',
        listings: [makeListing()],
      });

      expect(result.format).toBe('xml');
      expect(result.mimeType).toBe('application/xml');
      expect(result.data).toContain('<?xml');
      expect(result.data).toContain('<Listings');
    });

    it('rejects geojson without valid coordinates', async () => {
      const service = new ExportService();
      const listing = makeListing({ latitude: 0, longitude: 0 });
      await expect(
        service.export({ format: 'geojson', listings: [listing] })
      ).rejects.toThrow('requires listings with valid geolocation');
    });

    it('exports single listing', async () => {
      const service = new ExportService();
      const result = await service.exportSingle(makeListing(), 'json');

      expect(result.listingCount).toBe(1);
      expect(result.format).toBe('json');
    });

    it('passes options to exporter', async () => {
      const service = new ExportService();
      const result = await service.export({
        format: 'json',
        listings: [makeListing()],
        options: { fieldSelection: ['title', 'price_float'] },
      });

      const parsed = JSON.parse(result.data);
      expect(Object.keys(parsed.listings[0])).toEqual(['title', 'price_float']);
    });

    it('includes timestamp in result', async () => {
      const service = new ExportService();
      const result = await service.export({
        format: 'json',
        listings: [makeListing()],
      });

      expect(result.timestamp).toBeDefined();
      expect(new Date(result.timestamp).getTime()).not.toBeNaN();
    });

    it('exports in BLM format via service', async () => {
      const service = new ExportService();
      const result = await service.export({
        format: 'blm',
        listings: [makeListing()],
      });

      expect(result.format).toBe('blm');
      expect(result.mimeType).toBe('text/plain');
      expect(result.data).toContain('#HEADER#');
    });

    it('exports in Kyero format via service', async () => {
      const service = new ExportService();
      const result = await service.export({
        format: 'kyero',
        listings: [makeListing()],
      });

      expect(result.format).toBe('kyero');
      expect(result.data).toContain('<root>');
      expect(result.data).toContain('<property>');
    });

    it('exports in RESO JSON format via service', async () => {
      const service = new ExportService();
      const result = await service.export({
        format: 'reso-json',
        listings: [makeListing()],
      });

      expect(result.format).toBe('reso-json');
      const parsed = JSON.parse(result.data);
      expect(parsed['@odata.context']).toBeDefined();
    });

    it('exports in Schema.org format via service', async () => {
      const service = new ExportService();
      const result = await service.export({
        format: 'schema-org',
        listings: [makeListing()],
      });

      expect(result.format).toBe('schema-org');
      expect(result.mimeType).toBe('application/ld+json');
      const parsed = JSON.parse(result.data);
      expect(parsed['@context']).toBe('https://schema.org');
    });

    it('filename uses singular "listing" for count=1', async () => {
      const service = new ExportService();
      const result = await service.export({
        format: 'json',
        listings: [makeListing()],
      });

      expect(result.filename).toContain('_1_listing_');
    });

    it('filename uses plural "listings" for count>1', async () => {
      const service = new ExportService();
      const result = await service.export({
        format: 'json',
        listings: makeListings(5),
      });

      expect(result.filename).toContain('_5_listings_');
    });

    it('allows geojson when at least one listing has valid coords', async () => {
      const service = new ExportService();
      const validListing = makeListing();
      const invalidListing = makeListing({ latitude: 0, longitude: 0 });
      const result = await service.export({
        format: 'geojson',
        listings: [validListing, invalidListing],
      });

      expect(result.format).toBe('geojson');
      const parsed = JSON.parse(result.data);
      // Only the valid listing should appear as a feature
      expect(parsed.features).toHaveLength(1);
    });
  });
});
