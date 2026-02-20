import { describe, it, expect } from 'vitest';
import { ExportService, getExportService } from '../../src/lib/services/export-service.js';
import { Listing } from '../../src/lib/models/listing.js';

function makeListing(overrides: Record<string, unknown> = {}): Listing {
  const listing = new Listing();
  listing.assignAttributes({
    title: 'Test House',
    price_string: '£250,000',
    price_float: 250000,
    city: 'London',
    import_url: 'https://example.com/listing/1',
    latitude: 51.5074,
    longitude: -0.1278,
    ...overrides,
  });
  return listing;
}

describe('ExportService', () => {
  describe('export()', () => {
    it('exports listings as JSON', async () => {
      const service = new ExportService();
      const result = await service.export({
        format: 'json',
        listings: [makeListing()],
      });

      expect(result.format).toBe('json');
      expect(result.mimeType).toBe('application/json');
      expect(result.listingCount).toBe(1);
      expect(result.data).toBeTruthy();
      expect(result.filename).toContain('.json');
      expect(result.timestamp).toBeTruthy();
    });

    it('exports listings as CSV', async () => {
      const service = new ExportService();
      const result = await service.export({
        format: 'csv',
        listings: [makeListing(), makeListing({ title: 'House 2' })],
      });

      expect(result.format).toBe('csv');
      expect(result.mimeType).toBe('text/csv');
      expect(result.listingCount).toBe(2);
      expect(result.filename).toContain('.csv');
    });

    it('exports listings as XML', async () => {
      const service = new ExportService();
      const result = await service.export({
        format: 'xml',
        listings: [makeListing()],
      });

      expect(result.format).toBe('xml');
      expect(result.mimeType).toBe('application/xml');
      expect(result.filename).toContain('.xml');
    });

    it('exports GeoJSON when listings have valid coordinates', async () => {
      const service = new ExportService();
      const result = await service.export({
        format: 'geojson',
        listings: [makeListing({ latitude: 51.5, longitude: -0.12 })],
      });

      expect(result.format).toBe('geojson');
      expect(result.mimeType).toBe('application/geo+json');
      expect(result.filename).toContain('.geojson');
    });

    it('throws when GeoJSON requested without valid coordinates', async () => {
      const service = new ExportService();

      await expect(
        service.export({
          format: 'geojson',
          listings: [makeListing({ latitude: 0, longitude: 0 })],
        }),
      ).rejects.toThrow('requires listings with valid geolocation data');
    });

    it('filename includes listing count and date', async () => {
      const service = new ExportService();
      const result = await service.export({
        format: 'json',
        listings: [makeListing(), makeListing()],
      });

      expect(result.filename).toMatch(/properties_2_listings_\d{4}-\d{2}-\d{2}\.json/);
    });

    it('filename uses singular for single listing', async () => {
      const service = new ExportService();
      const result = await service.export({
        format: 'json',
        listings: [makeListing()],
      });

      expect(result.filename).toMatch(/properties_1_listing_\d{4}-\d{2}-\d{2}\.json/);
    });
  });

  describe('exportSingle()', () => {
    it('exports a single listing', async () => {
      const service = new ExportService();
      const result = await service.exportSingle(makeListing(), 'json');

      expect(result.listingCount).toBe(1);
      expect(result.format).toBe('json');
    });
  });

  describe('exportBatch()', () => {
    it('fetches and exports listings by ID', async () => {
      const listings: Record<string, Listing> = {
        'id-1': makeListing({ title: 'House 1' }),
        'id-2': makeListing({ title: 'House 2' }),
      };

      const service = new ExportService();
      const result = await service.exportBatch({
        format: 'json',
        listingIds: ['id-1', 'id-2'],
        fetchListing: async (id) => listings[id],
      });

      expect(result.listingCount).toBe(2);
      expect(result.format).toBe('json');
    });

    it('throws when no listing IDs provided', async () => {
      const service = new ExportService();

      await expect(
        service.exportBatch({
          format: 'json',
          listingIds: [],
          fetchListing: async () => makeListing(),
        }),
      ).rejects.toThrow('No listings to export');
    });
  });

  describe('exportStream()', () => {
    it('yields exported data', async () => {
      const service = new ExportService();
      const chunks: string[] = [];

      for await (const chunk of service.exportStream({
        format: 'json',
        listings: [makeListing()],
      })) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.join('')).toBeTruthy();
    });
  });

  describe('getExportMetadata()', () => {
    it('returns config for JSON format', () => {
      const service = new ExportService();
      const meta = service.getExportMetadata('json');

      expect(meta.format).toBe('json');
      expect(meta.label).toBe('JSON');
      expect(meta.isAvailable).toBe(true);
      expect(meta.mimeType).toBe('application/json');
    });

    it('returns config for CSV format', () => {
      const service = new ExportService();
      const meta = service.getExportMetadata('csv');

      expect(meta.format).toBe('csv');
      expect(meta.isAvailable).toBe(true);
    });

    it('returns requiresGeoLocation for geojson', () => {
      const service = new ExportService();
      const meta = service.getExportMetadata('geojson');

      expect(meta.requiresGeoLocation).toBe(true);
    });
  });

  describe('getExportService() singleton', () => {
    it('returns an ExportService instance', () => {
      const service = getExportService();
      expect(service).toBeInstanceOf(ExportService);
    });

    it('returns the same instance on repeated calls', () => {
      const a = getExportService();
      const b = getExportService();
      expect(a).toBe(b);
    });
  });
});
