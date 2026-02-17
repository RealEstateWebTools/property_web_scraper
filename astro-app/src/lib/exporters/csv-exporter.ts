/**
 * CSV Exporter
 * Exports listings as CSV format compatible with spreadsheets
 */

import { BaseExporter, type ExportOptions } from './base-exporter.js';
import type { Listing } from '../models/listing.js';

export interface CSVExportOptions extends ExportOptions {
  fieldSelection?: 'essential' | 'all' | string[];
  delimiter?: ',' | ';' | '\t';
  includeHeader?: boolean;
  quoteChar?: '"' | "'";
  encoding?: 'utf-8' | 'utf-8-bom';
  nestedArrayHandling?: 'json-string' | 'first-item' | 'count';
}

export class CSVExporter extends BaseExporter {
  protected format = 'csv';
  protected delimiter: string = ',';
  protected quoteChar: string = '"';
  protected nestedArrayHandling: string = 'json-string';

  constructor(options: CSVExportOptions = {}) {
    super({
      fieldSelection: 'essential',
      includeHeader: true,
      ...options,
    });

    this.delimiter = options.delimiter || ',';
    this.quoteChar = options.quoteChar || '"';
    this.nestedArrayHandling = options.nestedArrayHandling || 'json-string';
  }

  /**
   * Export listings as CSV
   */
  async export(listings: Listing[]): Promise<string> {
    this.validateListings(listings);

    const fields = this.getFieldsToExport();
    let csv = '';

    // Add BOM if specified
    if (this.options.encoding === 'utf-8-bom') {
      csv = '\uFEFF';
    }

    // Add header
    if (this.options.includeHeader) {
      csv += this.escapeCSVRow(fields) + '\n';
    }

    // Add data rows
    for (const listing of listings) {
      const values = fields.map(field => this.getCellValue(listing, field));
      csv += this.escapeCSVRow(values) + '\n';
    }

    return csv;
  }

  /**
   * Get value for CSV cell, handling different data types
   */
  private getCellValue(listing: Listing, field: string): string {
    const value = (listing as any)[field];

    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }

    if (value instanceof Date) {
      return this.formatDate(value)?.toString() || '';
    }

    if (Array.isArray(value)) {
      return this.handleArrayValue(value);
    }

    if (typeof value === 'object') {
      return this.handleObjectValue(value);
    }

    return String(value);
  }

  /**
   * Handle array values (images, features, etc.)
   */
  private handleArrayValue(arr: unknown[]): string {
    if (arr.length === 0) return '';

    switch (this.nestedArrayHandling) {
      case 'first-item':
        return String(arr[0]);

      case 'count':
        return String(arr.length);

      case 'json-string':
      default:
        return JSON.stringify(arr);
    }
  }

  /**
   * Handle object values
   */
  private handleObjectValue(obj: Record<string, unknown>): string {
    return JSON.stringify(obj);
  }

  /**
   * Escape CSV row and return as quoted fields
   */
  private escapeCSVRow(values: string[]): string {
    return values
      .map(value => this.escapeCSVField(value))
      .join(this.delimiter);
  }

  /**
   * Escape individual CSV field value
   */
  private escapeCSVField(value: string): string {
    // If value contains special chars, quote it
    if (
      value.includes(this.delimiter) ||
      value.includes(this.quoteChar) ||
      value.includes('\n') ||
      value.includes('\r')
    ) {
      // Escape quote characters by doubling them
      const escaped = value.replace(
        new RegExp(this.quoteChar, 'g'),
        this.quoteChar + this.quoteChar
      );
      return `${this.quoteChar}${escaped}${this.quoteChar}`;
    }

    return value;
  }

  /**
   * Generate streaming CSV (for large datasets)
   */
  async *exportStream(listings: Listing[]): AsyncGenerator<string> {
    const fields = this.getFieldsToExport();

    // Header
    if (this.options.includeHeader) {
      yield this.escapeCSVRow(fields) + '\n';
    }

    // Rows (yield in chunks)
    for (let i = 0; i < listings.length; i++) {
      const listing = listings[i];
      const values = fields.map(field => this.getCellValue(listing, field));
      yield this.escapeCSVRow(values) + '\n';

      // Yield every 100 rows for streaming efficiency
      if ((i + 1) % 100 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
  }
}
