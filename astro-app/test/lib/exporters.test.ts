import { describe, it, expect } from 'vitest';
import { Listing } from '../../src/lib/models/listing.js';
import { JSONExporter } from '../../src/lib/exporters/json-exporter.js';
import { CSVExporter } from '../../src/lib/exporters/csv-exporter.js';
import { GeoJSONExporter } from '../../src/lib/exporters/geojson-exporter.js';
import { XMLExporter } from '../../src/lib/exporters/xml-exporter.js';
import { SchemaOrgExporter } from '../../src/lib/exporters/schema-org-exporter.js';
import { ICalExporter } from '../../src/lib/exporters/ical-exporter.js';
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
    price_float: 250000,
    price_string: '250,000',
    currency: 'EUR',
    count_bedrooms: 3,
    count_bathrooms: 2,
    constructed_area: 120,
    area_unit: 'sqmt',
    city: 'Madrid',
    country: 'Spain',
    latitude: 40.4168,
    longitude: -3.7038,
    main_image_url: 'https://example.com/img.jpg',
    import_url: 'https://example.com/listing/1',
    for_sale: true,
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
  });

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
  });

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
  });

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
  });

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
  });

  describe('ICalExporter', () => {
    it('exports listings as valid iCalendar', async () => {
      const listing = makeListing({ last_retrieved_at: new Date('2024-01-15') });
      const exporter = new ICalExporter();
      const result = await exporter.export([listing]);

      expect(result).toContain('BEGIN:VCALENDAR');
      expect(result).toContain('VERSION:2.0');
      expect(result).toContain('PRODID:-//PropertyWebScraper//Export//EN');
      expect(result).toContain('END:VCALENDAR');
    });

    it('creates VEVENT entries for listings', async () => {
      const listing = makeListing({ last_retrieved_at: new Date('2024-01-15') });
      const exporter = new ICalExporter();
      const result = await exporter.export([listing]);

      expect(result).toContain('BEGIN:VEVENT');
      expect(result).toContain('END:VEVENT');
      expect(result).toContain('UID:REF-001@propertyscraper');
    });

    it('includes listing title as summary', async () => {
      const listing = makeListing({ last_retrieved_at: new Date('2024-01-15') });
      const exporter = new ICalExporter();
      const result = await exporter.export([listing]);

      expect(result).toContain('SUMMARY:Modern Apartment in Madrid');
    });

    it('includes location from address', async () => {
      const listing = makeListing({
        address_string: '123 Main St, Madrid',
        last_retrieved_at: new Date('2024-01-15'),
      });
      const exporter = new ICalExporter();
      const result = await exporter.export([listing]);

      expect(result).toContain('LOCATION:123 Main St\\, Madrid');
    });

    it('includes geo coordinates', async () => {
      const listing = makeListing({ last_retrieved_at: new Date('2024-01-15') });
      const exporter = new ICalExporter();
      const result = await exporter.export([listing]);

      expect(result).toContain('GEO:40.4168;-3.7038');
    });

    it('includes URL', async () => {
      const listing = makeListing({ last_retrieved_at: new Date('2024-01-15') });
      const exporter = new ICalExporter();
      const result = await exporter.export([listing]);

      expect(result).toContain('URL:https://example.com/listing/1');
    });

    it('uses CRLF line endings', async () => {
      const listing = makeListing({ last_retrieved_at: new Date('2024-01-15') });
      const exporter = new ICalExporter();
      const result = await exporter.export([listing]);

      expect(result).toContain('\r\n');
    });

    it('exports multiple events', async () => {
      const listings = makeListings(3).map(l => {
        l.last_retrieved_at = new Date('2024-01-15');
        return l;
      });
      const exporter = new ICalExporter();
      const result = await exporter.export(listings);

      const eventCount = (result.match(/BEGIN:VEVENT/g) || []).length;
      expect(eventCount).toBe(3);
    });

    it('throws on empty listings', async () => {
      const exporter = new ICalExporter();
      await expect(exporter.export([])).rejects.toThrow('Cannot export empty listing array');
    });
  });

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

    it('creates iCalendar exporter', () => {
      const exporter = createExporter('icalendar');
      expect(exporter).toBeInstanceOf(ICalExporter);
    });

    it('throws for unknown format', () => {
      expect(() => createExporter('pdf' as any)).toThrow('Unknown export format');
    });

    it('returns all production-ready exporters', () => {
      const available = getAvailableExporters();
      expect(available.every(e => e.isAvailable && e.isProduction)).toBe(true);
      expect(available.length).toBe(6);
    });

    it('returns all registered exporters including planned', () => {
      const all = getAllExporters();
      expect(all.length).toBe(6);
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
      expect(getMimeType('icalendar')).toBe('text/calendar');
    });

    it('returns correct file extensions', () => {
      expect(getFileExtension('json')).toBe('.json');
      expect(getFileExtension('csv')).toBe('.csv');
      expect(getFileExtension('geojson')).toBe('.geojson');
      expect(getFileExtension('xml')).toBe('.xml');
      expect(getFileExtension('schema-org')).toBe('.jsonld');
      expect(getFileExtension('icalendar')).toBe('.ics');
    });
  });

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
  });
});
