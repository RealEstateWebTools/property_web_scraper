/**
 * GeoJSON Exporter
 * Exports listings as GeoJSON for mapping applications
 */

import { BaseExporter, type ExportOptions } from './base-exporter.js';
import type { Listing } from '../models/listing.js';

export interface GeoJSONExportOptions extends ExportOptions {
  includeImages?: boolean;
  maxPropertiesPerFeature?: number;
}

export interface GeoJSONFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: Record<string, unknown>;
}

export interface GeoJSONExport {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

export class GeoJSONExporter extends BaseExporter {
  protected format = 'geojson';

  constructor(options: GeoJSONExportOptions = {}) {
    super({
      includeMetadata: false, // Not standard in GeoJSON
      fieldSelection: 'essential',
      ...options,
    });
  }

  /**
   * Export listings as GeoJSON FeatureCollection
   */
  async export(listings: Listing[]): Promise<string> {
    this.validateListings(listings);

    const features = listings
      .filter(listing => this.isValidGeoLocation(listing))
      .map(listing => this.listingToFeature(listing));

    const geoJson: GeoJSONExport = {
      type: 'FeatureCollection',
      features,
    };

    return JSON.stringify(geoJson, null, 2);
  }

  /**
   * Convert single listing to GeoJSON Feature
   */
  private listingToFeature(listing: Listing): GeoJSONFeature {
    const properties = this.extractProperties(listing);

    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [listing.longitude, listing.latitude],
      },
      properties,
    };
  }

  /**
   * Extract properties for GeoJSON feature
   */
  private extractProperties(listing: Listing): Record<string, unknown> {
    return {
      reference: listing.reference,
      title: listing.title,
      price_float: listing.price_float,
      currency: listing.currency,
      bedrooms: listing.count_bedrooms,
      bathrooms: listing.count_bathrooms,
      area: listing.constructed_area,
      area_unit: listing.area_unit,
      city: listing.city,
      address: listing.address_string,
      country: listing.country,
      main_image_url: listing.main_image_url,
      source_url: listing.import_url,
      source_portal: listing.import_host_slug,
      scraped_date: listing.last_retrieved_at?.toISOString(),
      for_sale: listing.for_sale,
      for_rent: listing.for_rent,
      furnished: listing.furnished,
    };
  }

  /**
   * Check if listing has valid geolocation
   */
  private isValidGeoLocation(listing: Listing): boolean {
    return (
      typeof listing.latitude === 'number' &&
      typeof listing.longitude === 'number' &&
      listing.latitude >= -90 &&
      listing.latitude <= 90 &&
      listing.longitude >= -180 &&
      listing.longitude <= 180 &&
      (listing.latitude !== 0 || listing.longitude !== 0)
    );
  }

  /**
   * Export with additional image features
   */
  async exportWithImages(listings: Listing[]): Promise<string> {
    this.validateListings(listings);

    const features: GeoJSONFeature[] = [];

    for (const listing of listings) {
      if (!this.isValidGeoLocation(listing)) continue;

      // Main location feature
      features.push(this.listingToFeature(listing));

      // Optional: Add additional properties as separate features if multiple images
      if (listing.image_urls && listing.image_urls.length > 1) {
        const imageFeature: GeoJSONFeature = {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [listing.longitude, listing.latitude],
          },
          properties: {
            reference: listing.reference,
            type: 'gallery',
            images: listing.image_urls.map(img => ({
              url: typeof img === 'string' ? img : (img as any).url,
              title: listing.title,
            })),
          },
        };
        features.push(imageFeature);
      }
    }

    const geoJson: GeoJSONExport = {
      type: 'FeatureCollection',
      features,
    };

    return JSON.stringify(geoJson, null, 2);
  }

  /**
   * Stream GeoJSON
   */
  async *exportStream(listings: Listing[]): AsyncGenerator<string> {
    const validListings = listings.filter(l => this.isValidGeoLocation(l));

    yield '{\n';
    yield '  "type": "FeatureCollection",\n';
    yield '  "features": [\n';

    for (let i = 0; i < validListings.length; i++) {
      const feature = this.listingToFeature(validListings[i]);
      const isLast = i === validListings.length - 1;

      yield `    ${JSON.stringify(feature)}${isLast ? '' : ','}`;
      if (i % 10 === 9) yield '\n';
    }

    yield '\n  ]\n';
    yield '}\n';
  }
}
