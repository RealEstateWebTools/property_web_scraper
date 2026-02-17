/**
 * JSON Exporter
 * Exports listings as formatted JSON with metadata
 */

import { BaseExporter, type ExportOptions, type ExportMetadata } from './base-exporter.js';
import type { Listing } from '../models/listing.js';

export interface JSONExportOptions extends ExportOptions {
  pretty?: boolean;
  includeMetadata?: boolean;
}

export interface JSONExport {
  export_version: string;
  export_date: string;
  source_platform: string;
  metadata?: ExportMetadata;
  listings: Record<string, unknown>[];
}

export class JSONExporter extends BaseExporter {
  protected format = 'json';

  constructor(options: JSONExportOptions = {}) {
    super({
      pretty: true, // JSON is typically pretty-printed
      includeMetadata: true,
      ...options,
    });
  }

  /**
   * Export listings as JSON
   */
  async export(listings: Listing[]): Promise<string> {
    this.validateListings(listings);
    this.resetTimer();

    const fields = this.getFieldsToExport();
    const exportData: JSONExport = {
      export_version: '1.0',
      export_date: new Date().toISOString(),
      source_platform: 'PropertyWebScraper',
      listings: listings.map(listing => this.extractFieldValues(listing, fields)),
    };

    if (this.options.includeMetadata) {
      exportData.metadata = this.buildMetadata(listings.length);
    }

    const indent = this.options.pretty ? 2 : undefined;
    return JSON.stringify(exportData, null, indent);
  }

  /**
   * Export single listing as JSON
   */
  async exportSingle(listing: Listing): Promise<string> {
    const fields = this.getFieldsToExport();
    const listingData = this.extractFieldValues(listing, fields);

    const data: Record<string, unknown> = {
      export_version: '1.0',
      export_date: new Date().toISOString(),
      source_platform: 'PropertyWebScraper',
      listing: listingData,
    };

    if (this.options.includeMetadata) {
      data.metadata = this.buildMetadata(1);
    }

    const indent = this.options.pretty ? 2 : undefined;
    return JSON.stringify(data, null, indent);
  }

  /**
   * Generate streaming JSON (for large datasets)
   */
  async *exportStream(listings: Listing[]): AsyncGenerator<string> {
    const fields = this.getFieldsToExport();
    const indent = this.options.pretty ? '  ' : '';

    yield '{\n';
    yield `  "export_version": "1.0",\n`;
    yield `  "export_date": "${new Date().toISOString()}",\n`;
    yield `  "source_platform": "PropertyWebScraper",\n`;

    if (this.options.includeMetadata) {
      const metadata = this.buildMetadata(listings.length);
      yield `  "metadata": ${JSON.stringify(metadata, null, 2).replace(/\n/g, '\n  ')},\n`;
    }

    yield `  "listings": [\n`;

    for (let i = 0; i < listings.length; i++) {
      const listing = listings[i];
      const listingData = this.extractFieldValues(listing, fields);
      const isLast = i === listings.length - 1;

      yield `    ${JSON.stringify(listingData)}${isLast ? '' : ','}`;
      if (i % 10 === 9) yield '\n'; // Newline every 10 items
    }

    yield `\n  ]\n`;
    yield `}\n`;
  }
}
