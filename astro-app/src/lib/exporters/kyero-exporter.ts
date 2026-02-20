/**
 * Kyero XML Exporter (Spanish market)
 * Exports listings in Kyero XML feed format with nested location, surface_area,
 * multilingual descriptions, images, features, and energy rating elements.
 */

import { BaseExporter, type ExportOptions } from './base-exporter.js';
import type { Listing } from '../models/listing.js';
import { normalizePropertyType } from '../extractor/property-type-normalizer.js';
import { primaryLanguage } from '../utils/locale.js';

export interface KyeroExportOptions extends ExportOptions {
  defaultCurrency?: string;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const KYERO_LANGUAGES = new Set(['en', 'es', 'de', 'fr', 'it']);

export class KyeroExporter extends BaseExporter {
  protected format = 'kyero';

  constructor(options: KyeroExportOptions = {}) {
    super({
      fieldSelection: 'all',
      ...options,
    });
  }

  async export(listings: Listing[]): Promise<string> {
    this.validateListings(listings);
    this.resetTimer();

    const lines: string[] = [];
    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push('<root>');

    for (const listing of listings) {
      lines.push('  <property>');
      this.writePropertyElements(listing, lines);
      lines.push('  </property>');
    }

    lines.push('</root>');
    return lines.join('\n');
  }

  private writePropertyElements(listing: Listing, lines: string[]): void {
    // Determine language slot from locale_code; fall back to 'en'
    const baseLang = listing.locale_code ? primaryLanguage(listing.locale_code) : '';
    const lang = KYERO_LANGUAGES.has(baseLang) ? baseLang : 'en';

    // Core fields
    if (listing.reference) {
      lines.push(`    <ref>${escapeXml(listing.reference)}</ref>`);
    }
    if (listing.import_url) {
      lines.push(`    <url>${escapeXml(listing.import_url)}</url>`);
    }

    // Price
    if (listing.price_float > 0) {
      lines.push(`    <price>${listing.price_float}</price>`);
    }
    const currency = listing.currency || (this.options as KyeroExportOptions).defaultCurrency || 'EUR';
    lines.push(`    <currency>${escapeXml(currency)}</currency>`);

    if (listing.price_qualifier) {
      lines.push(`    <price_freq>${escapeXml(listing.price_qualifier)}</price_freq>`);
    }

    // Property type (normalized)
    const rawType = listing.property_type || '';
    const normalizedType = normalizePropertyType(rawType);
    lines.push(`    <type>${escapeXml(normalizedType)}</type>`);

    if (listing.property_subtype) {
      lines.push(`    <subtype>${escapeXml(listing.property_subtype)}</subtype>`);
    }

    if (listing.listing_status) {
      lines.push(`    <status>${escapeXml(listing.listing_status)}</status>`);
    }

    // Rooms
    if (listing.count_bedrooms > 0) {
      lines.push(`    <beds>${listing.count_bedrooms}</beds>`);
    }
    if (listing.count_bathrooms > 0) {
      lines.push(`    <baths>${listing.count_bathrooms}</baths>`);
    }

    // Location
    lines.push('    <location>');
    if (listing.city) lines.push(`      <city>${escapeXml(listing.city)}</city>`);
    if (listing.province) lines.push(`      <province>${escapeXml(listing.province)}</province>`);
    if (listing.region) lines.push(`      <area>${escapeXml(listing.region)}</area>`);
    if (listing.country) lines.push(`      <country>${escapeXml(listing.country)}</country>`);
    if (listing.postal_code) lines.push(`      <zip>${escapeXml(listing.postal_code)}</zip>`);
    if (listing.address_string) lines.push(`      <detail>${escapeXml(listing.address_string)}</detail>`);
    if (listing.latitude) lines.push(`      <latitude>${listing.latitude}</latitude>`);
    if (listing.longitude) lines.push(`      <longitude>${listing.longitude}</longitude>`);
    lines.push('    </location>');

    // Surface area
    if (listing.constructed_area > 0 || listing.plot_area > 0) {
      lines.push('    <surface_area>');
      if (listing.constructed_area > 0) {
        lines.push(`      <built>${listing.constructed_area}</built>`);
      }
      if (listing.plot_area > 0) {
        lines.push(`      <plot>${listing.plot_area}</plot>`);
      }
      lines.push('    </surface_area>');
    }

    if (listing.year_construction > 0) {
      lines.push(`    <year_built>${listing.year_construction}</year_built>`);
    }

    // Title and description in the listing's native language (per locale_code)
    lines.push('    <title>');
    if (listing.title) {
      lines.push(`      <${lang}>${escapeXml(listing.title)}</${lang}>`);
    }
    lines.push('    </title>');

    lines.push('    <desc>');
    if (listing.description) {
      lines.push(`      <${lang}>${escapeXml(listing.description)}</${lang}>`);
    }
    lines.push('    </desc>');

    // Images
    if (listing.image_urls && listing.image_urls.length > 0) {
      lines.push('    <images>');
      for (const img of listing.image_urls) {
        const url = typeof img === 'string' ? img : (img as any).url;
        if (url) {
          lines.push(`      <image><url>${escapeXml(url)}</url></image>`);
        }
      }
      lines.push('    </images>');
    }

    // Features
    if (listing.features && listing.features.length > 0) {
      lines.push('    <features>');
      for (const feature of listing.features) {
        lines.push(`      <feature>${escapeXml(String(feature))}</feature>`);
      }
      lines.push('    </features>');
    }

    // Energy rating
    if (listing.energy_certificate_grade) {
      lines.push('    <energy_rating>');
      lines.push(`      <consumption>${escapeXml(listing.energy_certificate_grade)}</consumption>`);
      lines.push('    </energy_rating>');
    }

    // Agent
    if (listing.agent_name) {
      lines.push(`    <agent>${escapeXml(listing.agent_name)}</agent>`);
    }
  }
}
