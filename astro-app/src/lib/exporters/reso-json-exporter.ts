/**
 * RESO JSON Exporter (US/Canadian market)
 * Exports listings as OData-style JSON mimicking RESO Web API responses.
 */

import { BaseExporter, type ExportOptions } from './base-exporter.js';
import type { Listing } from '../models/listing.js';
import { getMappingsForStandard } from './field-mappings.js';

export interface RESOJsonExportOptions extends ExportOptions {
  odataContext?: string;
}

/** Fields that should remain numeric in RESO output */
const NUMERIC_FIELDS = new Set([
  'price_float', 'price_cents',
  'count_bedrooms', 'count_bathrooms', 'count_toilets', 'count_garages',
  'constructed_area', 'plot_area', 'year_construction',
  'energy_rating', 'energy_performance',
  'latitude', 'longitude',
]);

/** Fields to skip (handled specially or not relevant for RESO) */
const SKIP_FIELDS = new Set([
  'image_urls', 'features', 'main_image_url', 'floor_plan_urls',
]);

export class RESOJsonExporter extends BaseExporter {
  protected format = 'reso-json';

  constructor(options: RESOJsonExportOptions = {}) {
    super({
      fieldSelection: 'all',
      ...options,
    });
  }

  async export(listings: Listing[]): Promise<string> {
    this.validateListings(listings);
    this.resetTimer();

    const context = (this.options as RESOJsonExportOptions).odataContext
      || 'https://api.reso.org/Property';

    const value = listings.map(listing => this.listingToRESO(listing));

    const output = {
      '@odata.context': context,
      '@odata.count': listings.length,
      value,
    };

    return JSON.stringify(output, null, 2);
  }

  private listingToRESO(listing: Listing): Record<string, unknown> {
    const resoMappings = getMappingsForStandard('reso');
    const fields = this.getFieldsToExport();
    const result: Record<string, unknown> = {};
    const rec = listing as unknown as Record<string, unknown>;

    for (const field of fields) {
      if (SKIP_FIELDS.has(field)) continue;

      const resoName = resoMappings[field];
      if (!resoName) continue;

      const value = rec[field];

      // Omit zero/empty/false values (RESO convention)
      if (value == null || value === '' || value === false) continue;
      if (typeof value === 'number' && value === 0) continue;

      if (NUMERIC_FIELDS.has(field)) {
        result[resoName] = value;
      } else if (value instanceof Date) {
        result[resoName] = value.toISOString();
      } else {
        result[resoName] = String(value);
      }
    }

    // Media array (images + floor plans)
    const media = this.buildMediaArray(listing);
    if (media.length > 0) {
      result['Media'] = media;
    }

    // Features as string array
    if (listing.features && listing.features.length > 0) {
      result['ExteriorFeatures'] = listing.features.join(', ');
    }

    return result;
  }

  private buildMediaArray(listing: Listing): Record<string, unknown>[] {
    const media: Record<string, unknown>[] = [];
    let order = 1;

    if (listing.image_urls && listing.image_urls.length > 0) {
      for (const img of listing.image_urls) {
        const url = typeof img === 'string' ? img : (img as any).url;
        if (url) {
          media.push({
            MediaURL: url,
            MediaCategory: 'Photo',
            Order: order++,
          });
        }
      }
    }

    if (listing.floor_plan_urls && listing.floor_plan_urls.length > 0) {
      for (const url of listing.floor_plan_urls) {
        media.push({
          MediaURL: url,
          MediaCategory: 'FloorPlan',
          Order: order++,
        });
      }
    }

    return media;
  }
}
