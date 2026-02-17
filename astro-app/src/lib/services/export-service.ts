/**
 * Export Service
 * High-level service for orchestrating exports
 */

import type { Listing } from '../models/listing.js';
import {
  createExporter,
  type ExportFormat,
  getExporterConfig,
  getMimeType,
  getFileExtension,
  requiresGeoLocation,
} from '../exporters/exporter-registry.js';
import type { ExportOptions } from '../exporters/base-exporter.js';

export interface ExportRequest {
  format: ExportFormat;
  listings: Listing[];
  options?: ExportOptions;
}

export interface ExportResult {
  data: string;
  mimeType: string;
  filename: string;
  listingCount: number;
  format: ExportFormat;
  timestamp: string;
}

export interface BatchExportRequest {
  format: ExportFormat;
  listingIds: string[];
  options?: ExportOptions;
  // Callback to fetch listings by ID
  fetchListing: (id: string) => Promise<Listing>;
}

/**
 * Main export service
 */
export class ExportService {
  /**
   * Export listings in specified format
   */
  async export(request: ExportRequest): Promise<ExportResult> {
    const { format, listings, options } = request;

    // Validate format
    const config = getExporterConfig(format);
    if (!config.isAvailable) {
      throw new Error(`Export format '${format}' is not yet available`);
    }

    // Validate geolocation requirement
    if (requiresGeoLocation(format)) {
      const hasGeoLocation = listings.some(
        l =>
          l.latitude !== 0 &&
          l.longitude !== 0 &&
          l.latitude >= -90 &&
          l.latitude <= 90 &&
          l.longitude >= -180 &&
          l.longitude <= 180
      );

      if (!hasGeoLocation) {
        throw new Error(
          `Format '${format}' requires listings with valid geolocation data`
        );
      }
    }

    // Create exporter
    const exporter = createExporter(format, options);

    // Export
    const data = await exporter.export(listings);

    // Build result
    return {
      data,
      mimeType: getMimeType(format),
      filename: this.buildFilename(format, listings.length),
      listingCount: listings.length,
      format,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Export single listing
   */
  async exportSingle(listing: Listing, format: ExportFormat): Promise<ExportResult> {
    return this.export({
      format,
      listings: [listing],
    });
  }

  /**
   * Stream export for large datasets
   */
  async *exportStream(request: ExportRequest) {
    const { format, listings, options } = request;

    // Validate
    const config = getExporterConfig(format);
    if (!config.isAvailable) {
      throw new Error(`Export format '${format}' is not yet available`);
    }

    const exporter = createExporter(format, options);

    // Stream export
    if ('exportStream' in exporter) {
      yield* (exporter.exportStream(listings) as AsyncGenerator<string>);
    } else {
      // Fallback to non-streaming
      yield await exporter.export(listings);
    }
  }

  /**
   * Build filename for export
   */
  private buildFilename(format: ExportFormat, count: number): string {
    const ext = getFileExtension(format);
    const timestamp = new Date().toISOString().slice(0, 10);
    const countStr = count === 1 ? 'listing' : 'listings';

    return `properties_${count}_${countStr}_${timestamp}${ext}`;
  }

  /**
   * Get export metadata
   */
  getExportMetadata(format: ExportFormat) {
    return getExporterConfig(format);
  }

  /**
   * Batch export listings (for large datasets)
   */
  async exportBatch(request: BatchExportRequest): Promise<ExportResult> {
    const { listingIds, fetchListing, format, options } = request;

    if (listingIds.length === 0) {
      throw new Error('No listings to export');
    }

    // Fetch all listings
    const listings = await Promise.all(
      listingIds.map(id => fetchListing(id))
    );

    return this.export({
      format,
      listings,
      options,
    });
  }
}

// Singleton instance
let serviceInstance: ExportService | null = null;

export function getExportService(): ExportService {
  if (!serviceInstance) {
    serviceInstance = new ExportService();
  }
  return serviceInstance;
}
