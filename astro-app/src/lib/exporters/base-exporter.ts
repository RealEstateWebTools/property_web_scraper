/**
 * Base Exporter Class
 * Abstract class that all format exporters extend
 */

import type { Listing } from '../models/listing.js';

export interface ExportOptions {
  pretty?: boolean;
  includeMetadata?: boolean;
  dateFormat?: 'ISO8601' | 'unix' | 'localized';
  fieldSelection?: 'all' | 'essential' | string[];
  [key: string]: unknown;
}

export interface ExportMetadata {
  export_version: string;
  export_date: string;
  source_platform: string;
  total_listings: number;
  scraper_version: string;
  duration_ms: number;
  quality_grades?: Record<string, number>;
}

export abstract class BaseExporter {
  protected format: string = '';
  protected options: ExportOptions = {};
  protected startTime: number = Date.now();

  constructor(options: ExportOptions = {}) {
    this.options = {
      pretty: false,
      includeMetadata: true,
      dateFormat: 'ISO8601',
      fieldSelection: 'all',
      ...options,
    };
  }

  /**
   * Main export method - override in subclasses
   */
  abstract export(listings: Listing[]): Promise<string>;

  /**
   * Validate listings before export
   */
  protected validateListings(listings: Listing[]): void {
    if (!Array.isArray(listings)) {
      throw new Error('Listings must be an array');
    }
    if (listings.length === 0) {
      throw new Error('Cannot export empty listing array');
    }
  }

  /**
   * Get essential fields (subset)
   */
  protected getEssentialFields(): string[] {
    return [
      'reference',
      'title',
      'price_float',
      'currency',
      'count_bedrooms',
      'count_bathrooms',
      'constructed_area',
      'city',
      'country',
      'latitude',
      'longitude',
      'main_image_url',
      'import_url',
      'last_retrieved_at',
    ];
  }

  /**
   * All exportable listing fields (mirrors Listing model attributes)
   */
  protected getAllFields(): string[] {
    return [
      'reference', 'import_url', 'import_host_slug',
      'price_string', 'price_float', 'currency', 'price_cents', 'price_currency',
      'title', 'description', 'locale_code',
      'area_unit', 'plot_area', 'constructed_area', 'year_construction',
      'count_bedrooms', 'count_bathrooms', 'count_toilets', 'count_garages',
      'energy_rating', 'energy_performance',
      'furnished', 'sold', 'reserved',
      'for_rent_short_term', 'for_rent_long_term', 'for_sale', 'for_rent',
      'address_string', 'street_number', 'street_name', 'street_address',
      'postal_code', 'province', 'city', 'region', 'country',
      'latitude', 'longitude',
      'main_image_url', 'image_urls', 'related_urls', 'features',
      'last_retrieved_at', 'deleted_at', 'active_from',
      'available_to_rent_from', 'available_to_rent_till',
    ];
  }

  /**
   * Determine which fields to export
   */
  protected getFieldsToExport(): string[] {
    const fieldSelection = this.options.fieldSelection || 'essential';

    if (fieldSelection === 'all') {
      return this.getAllFields();
    }

    if (fieldSelection === 'essential') {
      return this.getEssentialFields();
    }

    if (Array.isArray(fieldSelection)) {
      return fieldSelection;
    }

    return this.getEssentialFields();
  }

  /**
   * Extract values from listing for specified fields
   */
  protected extractFieldValues(
    listing: Listing,
    fields: string[]
  ): Record<string, unknown> {
    const values: Record<string, unknown> = {};

    for (const field of fields) {
      if (field in listing) {
        values[field] = (listing as any)[field];
      }
    }

    this.ensureImageConsistency(values);

    return values;
  }

  private ensureImageConsistency(values: Record<string, unknown>): void {
    if (!("main_image_url" in values) || !("image_urls" in values)) {
      return;
    }

    const mainImageUrl = typeof values.main_image_url === 'string'
      ? values.main_image_url.trim()
      : '';

    if (!mainImageUrl) {
      return;
    }

    const rawImageUrls = Array.isArray(values.image_urls) ? values.image_urls : [];
    const hasMainImageInArray = rawImageUrls.some((item) => {
      if (typeof item === 'string') {
        return item === mainImageUrl;
      }
      if (item && typeof item === 'object' && 'url' in item) {
        return (item as { url?: unknown }).url === mainImageUrl;
      }
      return false;
    });

    if (rawImageUrls.length === 0 || !hasMainImageInArray) {
      values.image_urls = [{ url: mainImageUrl }, ...rawImageUrls];
    }
  }

  /**
   * Build export metadata
   */
  protected buildMetadata(totalListings: number): ExportMetadata {
    return {
      export_version: '1.0',
      export_date: new Date().toISOString(),
      source_platform: 'PropertyWebScraper',
      total_listings: totalListings,
      scraper_version: '5.0.0',
      duration_ms: Date.now() - this.startTime,
    };
  }

  /**
   * Format date value based on options
   */
  protected formatDate(date: Date | null): string | number | null {
    if (!date) return null;

    const dateFormat = this.options.dateFormat || 'ISO8601';

    switch (dateFormat) {
      case 'unix':
        return Math.floor(date.getTime() / 1000);
      case 'localized':
        return date.toLocaleString();
      case 'ISO8601':
      default:
        return date.toISOString();
    }
  }

  /**
   * Reset timer for duration calculation
   */
  protected resetTimer(): void {
    this.startTime = Date.now();
  }
}
