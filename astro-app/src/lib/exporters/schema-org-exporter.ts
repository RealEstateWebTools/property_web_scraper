/**
 * Schema.org / JSON-LD Exporter
 * Exports listings as JSON-LD using Schema.org RealEstateListing / Residence types
 */

import { BaseExporter, type ExportOptions } from './base-exporter.js';
import type { Listing } from '../models/listing.js';
import { primaryLanguage } from '../utils/locale.js';

export interface SchemaOrgExportOptions extends ExportOptions {
  /** Use SingleFamilyResidence vs Apartment etc */
  defaultPropertyType?: string;
}

export class SchemaOrgExporter extends BaseExporter {
  protected format = 'schema-org';

  constructor(options: SchemaOrgExportOptions = {}) {
    super({
      fieldSelection: 'all',
      pretty: true,
      ...options,
    });
  }

  async export(listings: Listing[]): Promise<string> {
    this.validateListings(listings);
    this.resetTimer();

    const graph = listings.map(listing => this.listingToJsonLd(listing));

    const output = {
      '@context': 'https://schema.org',
      '@graph': graph,
    };

    const indent = this.options.pretty ? 2 : undefined;
    return JSON.stringify(output, null, indent);
  }

  private listingToJsonLd(listing: Listing): Record<string, unknown> {
    const node: Record<string, unknown> = {
      '@type': 'RealEstateListing',
    };

    if (listing.reference) {
      node['@id'] = listing.import_url || `urn:pws:listing:${listing.reference}`;
    }

    if (listing.title) node['name'] = listing.title;
    if (listing.description) node['description'] = listing.description;
    if (listing.import_url) node['url'] = listing.import_url;
    if (listing.locale_code) node['inLanguage'] = primaryLanguage(listing.locale_code);

    // Price as Offer
    if (listing.price_float > 0) {
      node['offers'] = {
        '@type': 'Offer',
        'price': listing.price_float,
        'priceCurrency': listing.currency || 'EUR',
        'availability': listing.sold
          ? 'https://schema.org/SoldOut'
          : 'https://schema.org/InStock',
      };
    }

    // Property as Residence/Accommodation
    const accommodation: Record<string, unknown> = {
      '@type': this.resolvePropertyType(listing),
    };

    if (listing.address_string || listing.city || listing.country) {
      const address: Record<string, unknown> = { '@type': 'PostalAddress' };
      if (listing.street_address) address['streetAddress'] = listing.street_address;
      if (listing.city) address['addressLocality'] = listing.city;
      if (listing.province) address['addressRegion'] = listing.province;
      if (listing.postal_code) address['postalCode'] = listing.postal_code;
      if (listing.country) address['addressCountry'] = listing.country;
      accommodation['address'] = address;
    }

    if (listing.latitude && listing.longitude) {
      accommodation['geo'] = {
        '@type': 'GeoCoordinates',
        'latitude': listing.latitude,
        'longitude': listing.longitude,
      };
    }

    if (listing.count_bedrooms > 0) {
      accommodation['numberOfBedrooms'] = listing.count_bedrooms;
    }
    if (listing.count_bathrooms > 0) {
      accommodation['numberOfBathroomsTotal'] = listing.count_bathrooms;
    }
    if (listing.constructed_area > 0) {
      accommodation['floorSize'] = {
        '@type': 'QuantitativeValue',
        'value': listing.constructed_area,
        'unitCode': listing.area_unit === 'sqft' ? 'FTK' : 'MTK',
      };
    }
    if (listing.year_construction > 0) {
      accommodation['yearBuilt'] = listing.year_construction;
    }
    if (listing.furnished) {
      accommodation['amenityFeature'] = [
        { '@type': 'LocationFeatureSpecification', 'name': 'Furnished', 'value': true },
      ];
    }

    // Energy certificate grade
    if (listing.energy_certificate_grade) {
      accommodation['energyEfficiencyScaleMax'] = 'A';
      accommodation['energyEfficiencyScaleMin'] = 'G';
      accommodation['hasEnergyEfficiencyCategory'] = listing.energy_certificate_grade;
    }

    node['about'] = accommodation;

    // Agent as RealEstateAgent
    if (listing.agent_name) {
      const agent: Record<string, unknown> = {
        '@type': 'RealEstateAgent',
        'name': listing.agent_name,
      };
      if (listing.agent_phone) agent['telephone'] = listing.agent_phone;
      if (listing.agent_email) agent['email'] = listing.agent_email;
      if (listing.agent_logo_url) agent['logo'] = listing.agent_logo_url;
      node['agent'] = agent;
    }

    // Images
    if (listing.main_image_url) {
      node['image'] = listing.main_image_url;
    }
    if (listing.image_urls && listing.image_urls.length > 0) {
      node['image'] = listing.image_urls.map(img =>
        typeof img === 'string' ? img : (img as any).url
      ).filter(Boolean);
    }

    // Date
    if (listing.last_retrieved_at) {
      node['dateModified'] = listing.last_retrieved_at instanceof Date
        ? listing.last_retrieved_at.toISOString()
        : String(listing.last_retrieved_at);
    }

    return node;
  }

  private resolvePropertyType(listing: Listing): string {
    const defaultType = (this.options as SchemaOrgExportOptions).defaultPropertyType;
    if (defaultType) return defaultType;

    // Use property_type when populated
    if (listing.property_type) {
      const typeMap: Record<string, string> = {
        apartment: 'Apartment',
        flat: 'Apartment',
        house: 'SingleFamilyResidence',
        villa: 'SingleFamilyResidence',
        studio: 'Apartment',
      };
      const lower = listing.property_type.toLowerCase();
      const mapped = typeMap[lower];
      if (mapped) return mapped;
    }

    // Fall back to bedroom-count heuristic
    if (listing.count_bedrooms === 0) return 'Accommodation';
    if (listing.count_bedrooms <= 2) return 'Apartment';
    return 'SingleFamilyResidence';
  }
}
