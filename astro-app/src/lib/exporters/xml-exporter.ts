/**
 * XML/RETS Exporter
 * Exports listings as RETS-compatible XML
 */

import { BaseExporter, type ExportOptions } from './base-exporter.js';
import type { Listing } from '../models/listing.js';

export interface XMLExportOptions extends ExportOptions {
  includeXmlDeclaration?: boolean;
}

/** Map listing fields to RETS standard names */
const RETS_FIELD_MAP: Record<string, string> = {
  reference: 'ListingKey',
  title: 'ListingTitle',
  price_float: 'ListPrice',
  price_string: 'ListPriceDisplay',
  currency: 'CurrencyCode',
  count_bedrooms: 'BedroomsTotal',
  count_bathrooms: 'BathroomsTotalInteger',
  count_toilets: 'BathroomHalf',
  count_garages: 'GarageSpaces',
  constructed_area: 'LivingArea',
  area_unit: 'LivingAreaUnits',
  plot_area: 'LotSizeArea',
  year_construction: 'YearBuilt',
  address_string: 'UnparsedAddress',
  street_name: 'StreetName',
  street_number: 'StreetNumber',
  postal_code: 'PostalCode',
  city: 'City',
  province: 'StateOrProvince',
  region: 'CountyOrParish',
  country: 'Country',
  latitude: 'Latitude',
  longitude: 'Longitude',
  description: 'PublicRemarks',
  main_image_url: 'MediaURL',
  import_url: 'OriginalListingURL',
  for_sale: 'ForSale',
  for_rent: 'ForLease',
  furnished: 'Furnished',
  energy_rating: 'GreenBuildingCertification',
};

export class XMLExporter extends BaseExporter {
  protected format = 'xml';

  constructor(options: XMLExportOptions = {}) {
    super({
      fieldSelection: 'all',
      ...options,
    });
  }

  async export(listings: Listing[]): Promise<string> {
    this.validateListings(listings);
    this.resetTimer();

    const fields = this.getFieldsToExport();
    const lines: string[] = [];

    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push('<Listings xmlns="urn:property-web-scraper:rets" count="' + listings.length + '" exportDate="' + escapeXml(new Date().toISOString()) + '">');

    for (const listing of listings) {
      lines.push('  <Listing>');
      for (const field of fields) {
        const value = (listing as any)[field];
        if (value == null || value === '' || value === 0 || value === false) continue;

        const retsName = RETS_FIELD_MAP[field] || toPascalCase(field);
        const strValue = formatValue(value);
        lines.push(`    <${retsName}>${escapeXml(strValue)}</${retsName}>`);
      }

      // Image URLs as separate elements
      if (listing.image_urls && listing.image_urls.length > 0) {
        lines.push('    <Media>');
        for (const img of listing.image_urls) {
          const url = typeof img === 'string' ? img : (img as any).url;
          if (url) {
            lines.push(`      <MediaURL>${escapeXml(url)}</MediaURL>`);
          }
        }
        lines.push('    </Media>');
      }

      // Features as separate elements
      if (listing.features && listing.features.length > 0) {
        lines.push('    <Features>');
        for (const feature of listing.features) {
          lines.push(`      <Feature>${escapeXml(String(feature))}</Feature>`);
        }
        lines.push('    </Features>');
      }

      lines.push('  </Listing>');
    }

    lines.push('</Listings>');
    return lines.join('\n');
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toPascalCase(str: string): string {
  return str
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function formatValue(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === 'object' && value !== null) return JSON.stringify(value);
  return String(value);
}
