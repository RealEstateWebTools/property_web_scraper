import { BaseModel, type AttributeDefinition } from '../firestore/base-model.js';
import { sanitizePropertyHash } from '../extractor/field-processors.js';
import type { ImageInfo } from '../types/image-info.js';

/**
 * Represents a scraped real estate listing.
 * Port of Ruby PropertyWebScraper::Listing.
 */
export class Listing extends BaseModel {
  static override _collectionName = 'listings';
  static override _documentIdField: string | null = null;
  static override _attributeDefinitions: Record<string, AttributeDefinition> = {
    reference: { type: 'string' },
    import_url: { type: 'string' },
    import_host_slug: { type: 'string' },
    re_agent_id: { type: 'integer' },
    price_string: { type: 'string' },
    price_float: { type: 'float', default: 0 },
    currency: { type: 'string' },
    price_cents: { type: 'integer', default: 0 },
    price_currency: { type: 'string' },
    title: { type: 'string' },
    description: { type: 'string' },
    locale_code: { type: 'string' },
    area_unit: { type: 'string', default: 'sqmt' },
    plot_area: { type: 'float', default: 0 },
    constructed_area: { type: 'float', default: 0 },
    year_construction: { type: 'integer', default: 0 },
    count_bedrooms: { type: 'integer', default: 0 },
    count_bathrooms: { type: 'float', default: 0 },
    count_toilets: { type: 'integer', default: 0 },
    count_garages: { type: 'integer', default: 0 },
    energy_rating: { type: 'integer' },
    energy_performance: { type: 'float' },
    title_es: { type: 'string' },
    description_es: { type: 'string' },
    title_de: { type: 'string' },
    description_de: { type: 'string' },
    title_fr: { type: 'string' },
    description_fr: { type: 'string' },
    title_it: { type: 'string' },
    description_it: { type: 'string' },
    furnished: { type: 'boolean', default: false },
    sold: { type: 'boolean', default: false },
    reserved: { type: 'boolean', default: false },
    for_rent_short_term: { type: 'boolean', default: false },
    for_rent_long_term: { type: 'boolean', default: false },
    for_sale: { type: 'boolean', default: false },
    for_rent: { type: 'boolean', default: false },
    deleted_at: { type: 'datetime' },
    active_from: { type: 'datetime' },
    available_to_rent_from: { type: 'datetime' },
    available_to_rent_till: { type: 'datetime' },
    last_retrieved_at: { type: 'datetime' },
    address_string: { type: 'string' },
    street_number: { type: 'string' },
    street_name: { type: 'string' },
    street_address: { type: 'string' },
    postal_code: { type: 'string' },
    province: { type: 'string' },
    city: { type: 'string' },
    region: { type: 'string' },
    country: { type: 'string' },
    latitude: { type: 'float' },
    longitude: { type: 'float' },
    main_image_url: { type: 'string' },
    image_urls: { type: 'array', default: [] },
    related_urls: { type: 'array', default: [] },
    features: { type: 'array', default: [] },
    unknown_fields: { type: 'array', default: [] },
    import_history: { type: 'hash', default: {} },
  };

  // All declared attribute properties
  reference = '';
  import_url = '';
  import_host_slug = '';
  re_agent_id = 0;
  price_string = '';
  price_float = 0;
  currency = '';
  price_cents = 0;
  price_currency = '';
  title = '';
  description = '';
  locale_code = '';
  area_unit = 'sqmt';
  plot_area = 0;
  constructed_area = 0;
  year_construction = 0;
  count_bedrooms = 0;
  count_bathrooms = 0;
  count_toilets = 0;
  count_garages = 0;
  energy_rating = 0;
  energy_performance = 0;
  title_es = '';
  description_es = '';
  title_de = '';
  description_de = '';
  title_fr = '';
  description_fr = '';
  title_it = '';
  description_it = '';
  furnished = false;
  sold = false;
  reserved = false;
  for_rent_short_term = false;
  for_rent_long_term = false;
  for_sale = false;
  for_rent = false;
  deleted_at: Date | null = null;
  active_from: Date | null = null;
  available_to_rent_from: Date | null = null;
  available_to_rent_till: Date | null = null;
  last_retrieved_at: Date | null = null;
  address_string = '';
  street_number = '';
  street_name = '';
  street_address = '';
  postal_code = '';
  province = '';
  city = '';
  region = '';
  country = '';
  latitude = 0;
  longitude = 0;
  main_image_url = '';
  image_urls: ImageInfo[] = [];
  related_urls: string[] = [];
  features: string[] = [];
  unknown_fields: string[] = [];
  import_history: Record<string, unknown> = {};

  /**
   * Returns a JSON-safe hash of public listing attributes.
   * Port of Ruby Listing#as_json.
   */
  override asJson(): Record<string, unknown> {
    return super.asJson([
      'import_url', 'reference', 'price_string', 'price_float',
      'price_cents', 'price_currency',
      'title', 'description', 'area_unit', 'plot_area', 'constructed_area',
      'year_construction', 'count_bedrooms', 'count_bathrooms',
      'count_toilets', 'count_garages', 'currency',
      'street_number', 'street_name', 'street_address', 'postal_code',
      'city', 'province', 'region', 'country',
      'address_string', 'longitude', 'latitude',
      'for_sale', 'for_rent', 'main_image_url',
      'last_retrieved_at', 'image_urls', 'features', 'unknown_fields',
    ]);
  }

  /**
   * Update a listing from a scraped property hash.
   * Port of Ruby Listing.update_from_hash.
   */
  static updateFromHash(listing: Listing, propertyHash: Record<string, unknown>): void {
    const sanitized = sanitizePropertyHash({ ...propertyHash });

    const stdAttributes = [
      'reference', 'title', 'description', 'price_string', 'price_float',
      'area_unit', 'currency', 'country', 'longitude', 'latitude',
      'main_image_url', 'for_rent', 'for_sale', 'image_urls',
      'for_rent_short_term', 'for_rent_long_term',
      'street_address', 'address_string', 'locale_code',
      'city', 'province', 'region', 'postal_code', 'features',
    ];

    for (const attr of stdAttributes) {
      if (attr in sanitized) {
        (listing as Record<string, unknown>)[attr] = sanitized[attr];
      }
    }

    const numericAttributes = [
      'year_construction', 'constructed_area',
      'count_bedrooms', 'count_bathrooms',
      'count_toilets', 'count_garages',
    ];

    for (const attr of numericAttributes) {
      if (attr in sanitized) {
        (listing as Record<string, unknown>)[attr] = sanitized[attr] || 0;
      }
    }

    if (Array.isArray(sanitized['image_urls'])) {
      listing.image_urls = (sanitized['image_urls'] as unknown[]).map((item) => {
        if (typeof item === 'string') return { url: item };
        if (typeof item === 'object' && item !== null && 'url' in item) return item as ImageInfo;
        return null;
      }).filter((img): img is ImageInfo => img !== null);
    } else {
      listing.image_urls = [];
    }
  }
}
