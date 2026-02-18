/**
 * Exporter Registry
 * Factory and registry for managing all export formats
 */

import { JSONExporter } from './json-exporter.js';
import { CSVExporter } from './csv-exporter.js';
import { GeoJSONExporter } from './geojson-exporter.js';
import { XMLExporter } from './xml-exporter.js';
import { SchemaOrgExporter } from './schema-org-exporter.js';
import { ICalExporter } from './ical-exporter.js';
import { BaseExporter, type ExportOptions } from './base-exporter.js';

export type ExportFormat = 'json' | 'csv' | 'geojson' | 'xml' | 'schema-org' | 'icalendar';

export interface ExporterConfig {
  format: ExportFormat;
  label: string;
  description: string;
  fileExtension: string;
  mimeType: string;
  isAvailable: boolean;
  isProduction: boolean; // Ready for production use
  requiresGeoLocation?: boolean;
}

/**
 * Registry of all available exporters
 */
export const EXPORTER_REGISTRY: Record<ExportFormat, ExporterConfig> = {
  json: {
    format: 'json',
    label: 'JSON',
    description: 'JSON format for API integration and data pipelines',
    fileExtension: '.json',
    mimeType: 'application/json',
    isAvailable: true,
    isProduction: true,
  },
  csv: {
    format: 'csv',
    label: 'CSV',
    description: 'CSV format for spreadsheets and database import',
    fileExtension: '.csv',
    mimeType: 'text/csv',
    isAvailable: true,
    isProduction: true,
  },
  geojson: {
    format: 'geojson',
    label: 'GeoJSON',
    description: 'GeoJSON format for mapping applications and GIS tools',
    fileExtension: '.geojson',
    mimeType: 'application/geo+json',
    isAvailable: true,
    isProduction: true,
    requiresGeoLocation: true,
  },
  xml: {
    format: 'xml',
    label: 'XML (RETS)',
    description: 'XML format compatible with RETS (US MLS)',
    fileExtension: '.xml',
    mimeType: 'application/xml',
    isAvailable: true,
    isProduction: true,
  },
  'schema-org': {
    format: 'schema-org',
    label: 'Schema.org (JSON-LD)',
    description: 'JSON-LD format for SEO and semantic web integration',
    fileExtension: '.jsonld',
    mimeType: 'application/ld+json',
    isAvailable: true,
    isProduction: true,
  },
  icalendar: {
    format: 'icalendar',
    label: 'iCalendar',
    description: 'iCalendar format for availability and calendar sync',
    fileExtension: '.ics',
    mimeType: 'text/calendar',
    isAvailable: true,
    isProduction: true,
  },
};

/**
 * Factory to create exporter instances
 */
export function createExporter(
  format: ExportFormat,
  options: ExportOptions = {}
): BaseExporter {
  switch (format) {
    case 'json':
      return new JSONExporter(options);

    case 'csv':
      return new CSVExporter(options);

    case 'geojson':
      return new GeoJSONExporter(options);

    case 'xml':
      return new XMLExporter(options);

    case 'schema-org':
      return new SchemaOrgExporter(options);

    case 'icalendar':
      return new ICalExporter(options);

    default:
      throw new Error(`Unknown export format: ${format}`);
  }
}

/**
 * Get all available exporters (production-ready)
 */
export function getAvailableExporters(): ExporterConfig[] {
  return Object.values(EXPORTER_REGISTRY).filter(
    config => config.isAvailable && config.isProduction
  );
}

/**
 * Get all registered exporters (including coming soon)
 */
export function getAllExporters(): ExporterConfig[] {
  return Object.values(EXPORTER_REGISTRY);
}

/**
 * Get specific exporter config
 */
export function getExporterConfig(format: ExportFormat): ExporterConfig {
  const config = EXPORTER_REGISTRY[format];
  if (!config) {
    throw new Error(`Unknown export format: ${format}`);
  }
  return config;
}

/**
 * Check if format requires geolocation
 */
export function requiresGeoLocation(format: ExportFormat): boolean {
  const config = getExporterConfig(format);
  return config.requiresGeoLocation || false;
}

/**
 * Get mime type for format
 */
export function getMimeType(format: ExportFormat): string {
  return getExporterConfig(format).mimeType;
}

/**
 * Get file extension for format
 */
export function getFileExtension(format: ExportFormat): string {
  return getExporterConfig(format).fileExtension;
}
