import { BaseModel, type AttributeDefinition } from '../firestore/base-model.js';
import { sanitizePropertyHash } from '../extractor/field-processors.js';
import type { ImageInfo } from '../types/image-info.js';
import type { ExtractionDiagnostics } from '../extractor/html-extractor.js';
import { supplementaryDataService } from '../services/supplementary-data-links.js';

export interface MergeDiff {
  fieldsChanged: string[];
  fieldsAdded: string[];
  fieldsOverwritten: string[];
  wasExistingListing: boolean;
}

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
    description_html: { type: 'string' },
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
    visibility: { type: 'string', default: 'published' },
    confidence_score: { type: 'float', default: 1.0 },
    manual_override: { type: 'boolean', default: false },
    import_history: { type: 'hash', default: {} },
    // Diagnostic summary fields (persisted for admin queries)
    scraper_name: { type: 'string' },
    quality_grade: { type: 'string' },
    quality_label: { type: 'string' },
    extraction_rate: { type: 'float', default: 0 },
    weighted_extraction_rate: { type: 'float', default: 0 },
    extractable_fields: { type: 'integer', default: 0 },
    populated_extractable_fields: { type: 'integer', default: 0 },
    meets_expectation: { type: 'boolean', default: false },
    critical_fields_missing: { type: 'array', default: [] },
    // Interoperability fields
    property_type: { type: 'string' },
    property_subtype: { type: 'string' },
    tenure: { type: 'string' },
    listing_status: { type: 'string' },
    agent_name: { type: 'string' },
    agent_phone: { type: 'string' },
    agent_email: { type: 'string' },
    agent_logo_url: { type: 'string' },
    price_qualifier: { type: 'string' },
    floor_plan_urls: { type: 'array', default: [] },
    energy_certificate_grade: { type: 'string' },
    supplementary_data_links: { type: 'array', default: [] },
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
  description_html = '';
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
  visibility: 'published' | 'pending' | 'spam' | 'hidden' = 'published';
  confidence_score = 1.0;
  manual_override = false;
  import_history: Record<string, unknown> = {};
  // Diagnostic summary fields
  scraper_name = '';
  quality_grade = '';
  quality_label = '';
  extraction_rate = 0;
  weighted_extraction_rate = 0;
  extractable_fields = 0;
  populated_extractable_fields = 0;
  meets_expectation = false;
  critical_fields_missing: string[] = [];
  // Interoperability fields
  property_type = '';
  property_subtype = '';
  tenure = '';
  listing_status = '';
  agent_name = '';
  agent_phone = '';
  agent_email = '';
  agent_logo_url = '';
  price_qualifier = '';
  floor_plan_urls: string[] = [];
  energy_certificate_grade = '';
  supplementary_data_links: Array<{ title: string; url: string; category?: string; icon?: string }> = [];

  /**
   * Returns a JSON-safe hash of public listing attributes.
   * Port of Ruby Listing#as_json.
   */
  override asJson(only?: string[]): Record<string, unknown> {
    const json = super.asJson(only || [
      'import_url', 'reference', 'price_string', 'price_float',
      'price_cents', 'price_currency',
      'title', 'description', 'description_html', 'locale_code', 'area_unit', 'plot_area', 'constructed_area',
      'year_construction', 'count_bedrooms', 'count_bathrooms',
      'count_toilets', 'count_garages', 'currency',
      'street_number', 'street_name', 'street_address', 'postal_code',
      'city', 'province', 'region', 'country',
      'address_string', 'longitude', 'latitude',
      'for_sale', 'for_rent', 'main_image_url',
      'last_retrieved_at', 'image_urls', 'features', 'unknown_fields',
      'visibility', 'confidence_score', 'manual_override',
      'property_type', 'property_subtype', 'tenure', 'listing_status',
      'agent_name', 'agent_phone', 'agent_email', 'agent_logo_url',
      'price_qualifier', 'floor_plan_urls', 'energy_certificate_grade',
      'supplementary_data_links'
    ]);
    
    return json;
  }

  /**
   * Field-level merge: incoming listing data is merged into an existing listing
   * using category-specific rules. Returns a diff describing what changed.
   */
  static mergeIntoListing(existing: Listing, incoming: Listing): MergeDiff {
    const diff: MergeDiff = {
      fieldsChanged: [],
      fieldsAdded: [],
      fieldsOverwritten: [],
      wasExistingListing: true,
    };

    const IMMUTABLE: Set<string> = new Set(['import_url', 'import_host_slug']);

    const LATEST_WINS: Set<string> = new Set([
      'price_string', 'price_float', 'price_cents', 'price_currency', 'currency',
      'sold', 'reserved', 'for_sale', 'for_rent',
      'for_rent_short_term', 'for_rent_long_term',
      'last_retrieved_at', 'deleted_at', 'active_from',
      'available_to_rent_from', 'available_to_rent_till',
      'listing_status', 'price_qualifier',
    ]);

    const PREFER_RICHER: Set<string> = new Set(['description', 'description_html']);

    const ARRAY_FIELDS: Set<string> = new Set([
      'image_urls', 'features', 'related_urls', 'floor_plan_urls',
      'supplementary_data_links'
    ]);

    const NUMERIC_FIELDS: Set<string> = new Set([
      'count_bedrooms', 'count_bathrooms', 'count_toilets', 'count_garages',
      'constructed_area', 'plot_area', 'year_construction',
      'energy_rating', 'energy_performance',
      'latitude', 'longitude', 're_agent_id',
      'price_float', 'price_cents',
    ]);

    const rec = existing as unknown as Record<string, unknown>;
    const inc = incoming as unknown as Record<string, unknown>;

    for (const key of Object.keys(Listing._attributeDefinitions)) {
      if (IMMUTABLE.has(key) || key === 'import_history') continue;

      const existingVal = rec[key];
      const incomingVal = inc[key];

      if (ARRAY_FIELDS.has(key)) {
        const merged = Listing._mergeArray(key, existingVal, incomingVal);
        if (merged !== undefined) {
          const had = Array.isArray(existingVal) && existingVal.length > 0;
          rec[key] = merged;
          diff.fieldsChanged.push(key);
          if (!had) {
            diff.fieldsAdded.push(key);
          } else {
            diff.fieldsOverwritten.push(key);
          }
        }
        continue;
      }

      if (LATEST_WINS.has(key)) {
        // For latest-wins fields that are also numeric, skip if incoming is default
        // Price fields are always overwritten by latest
        if (incomingVal !== existingVal) {
          const had = Listing._isPopulated(existingVal);
          rec[key] = incomingVal;
          diff.fieldsChanged.push(key);
          if (!had && Listing._isPopulated(incomingVal)) {
            diff.fieldsAdded.push(key);
          } else if (had) {
            diff.fieldsOverwritten.push(key);
          }
        }
        continue;
      }

      if (PREFER_RICHER.has(key)) {
        const existingStr = typeof existingVal === 'string' ? existingVal : '';
        const incomingStr = typeof incomingVal === 'string' ? incomingVal : '';
        if (incomingStr.length > existingStr.length) {
          rec[key] = incomingStr;
          diff.fieldsChanged.push(key);
          if (!existingStr) {
            diff.fieldsAdded.push(key);
          } else {
            diff.fieldsOverwritten.push(key);
          }
        }
        continue;
      }

      if (NUMERIC_FIELDS.has(key) && !LATEST_WINS.has(key)) {
        const existingNum = typeof existingVal === 'number' ? existingVal : 0;
        const incomingNum = typeof incomingVal === 'number' ? incomingVal : 0;
        if (incomingNum !== 0 && incomingNum !== existingNum) {
          rec[key] = incomingNum;
          diff.fieldsChanged.push(key);
          if (existingNum === 0) {
            diff.fieldsAdded.push(key);
          } else {
            diff.fieldsOverwritten.push(key);
          }
        }
        continue;
      }

      // Default: prefer non-empty (text fields)
      const existingStr = typeof existingVal === 'string' ? existingVal : '';
      const incomingStr = typeof incomingVal === 'string' ? incomingVal : '';
      if (incomingStr && incomingStr !== existingStr) {
        rec[key] = incomingStr;
        diff.fieldsChanged.push(key);
        if (!existingStr) {
          diff.fieldsAdded.push(key);
        } else {
          diff.fieldsOverwritten.push(key);
        }
      }
    }

    // Record merge in import_history
    existing.import_history[new Date().toISOString()] = {
      action: 'merge',
      fieldsChanged: diff.fieldsChanged.length,
      fieldsAdded: diff.fieldsAdded.length,
      fieldsOverwritten: diff.fieldsOverwritten.length,
    };

    return diff;
  }

  /** Merge arrays by field type. Returns merged array or undefined if no change. */
  private static _mergeArray(
    key: string,
    existing: unknown,
    incoming: unknown,
  ): unknown[] | undefined {
    const existingArr = Array.isArray(existing) ? existing : [];
    const incomingArr = Array.isArray(incoming) ? incoming : [];

    if (incomingArr.length === 0) return undefined;

    if (key === 'image_urls') {
      // If incoming has strictly more items, prefer incoming outright
      if (incomingArr.length > existingArr.length) return incomingArr;
      // Otherwise union by URL
      const seen = new Set<string>();
      const merged: ImageInfo[] = [];
      for (const img of [...existingArr, ...incomingArr]) {
        const url = typeof img === 'string' ? img : (img as ImageInfo)?.url;
        if (url && !seen.has(url)) {
          seen.add(url);
          merged.push(typeof img === 'string' ? { url: img } : img);
        }
      }
      if (merged.length === existingArr.length) return undefined;
      return merged;
    }

    if (key === 'features') {
      if (incomingArr.length > existingArr.length) return incomingArr;
      const seen = new Set<string>();
      const merged: string[] = [];
      for (const f of [...existingArr, ...incomingArr]) {
        const lower = String(f).toLowerCase();
        if (!seen.has(lower)) {
          seen.add(lower);
          merged.push(String(f));
        }
      }
      if (merged.length === existingArr.length) return undefined;
      return merged;
    }

    // related_urls and other arrays: union by value
    if (incomingArr.length > existingArr.length) return incomingArr;
    const seen = new Set(existingArr.map(String));
    const merged = [...existingArr];
    for (const item of incomingArr) {
      if (!seen.has(String(item))) {
        seen.add(String(item));
        merged.push(item);
      }
    }
    if (merged.length === existingArr.length) return undefined;
    return merged;
  }

  /** Check if a value is "populated" (non-empty, non-zero, non-null) */
  private static _isPopulated(val: unknown): boolean {
    if (val === null || val === undefined || val === '' || val === 0 || val === false) return false;
    if (Array.isArray(val) && val.length === 0) return false;
    return true;
  }

  /**
   * Update a listing from a scraped property hash.
   * Port of Ruby Listing.update_from_hash.
   */
  static updateFromHash(listing: Listing, propertyHash: Record<string, unknown>): void {
    const sanitized = sanitizePropertyHash({ ...propertyHash });

    const stdAttributes = [
      'reference', 'title', 'description', 'description_html', 'price_string', 'price_float',
      'area_unit', 'currency', 'country', 'longitude', 'latitude',
      'main_image_url', 'for_rent', 'for_sale', 'image_urls',
      'for_rent_short_term', 'for_rent_long_term',
      'street_address', 'address_string', 'locale_code',
      'city', 'province', 'region', 'postal_code', 'features',
      'property_type', 'property_subtype', 'tenure', 'listing_status',
      'agent_name', 'agent_phone', 'agent_email', 'agent_logo_url',
      'price_qualifier', 'floor_plan_urls', 'energy_certificate_grade',
    ];

    const listingRec = listing as unknown as Record<string, unknown>;
    for (const attr of stdAttributes) {
      if (attr in sanitized) {
        listingRec[attr] = sanitized[attr];
      }
    }

    const numericAttributes = [
      'year_construction', 'constructed_area',
      'count_bedrooms', 'count_bathrooms',
      'count_toilets', 'count_garages',
    ];

    for (const attr of numericAttributes) {
      if (attr in sanitized) {
        listingRec[attr] = sanitized[attr] || 0;
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

    // Refresh supplementary links after location/fields have been updated
    listing.supplementary_data_links = supplementaryDataService.generateLinks(listing);
  }

  /**
   * Copy diagnostic summary fields onto a listing so they persist to Firestore.
   */
  static applyDiagnostics(listing: Listing, diag: ExtractionDiagnostics): void {
    listing.scraper_name = diag.scraperName;
    listing.quality_grade = diag.qualityGrade ?? '';
    listing.quality_label = diag.qualityLabel ?? '';
    listing.extraction_rate = diag.extractionRate ?? 0;
    listing.weighted_extraction_rate = diag.weightedExtractionRate ?? 0;
    listing.extractable_fields = diag.extractableFields ?? 0;
    listing.populated_extractable_fields = diag.populatedExtractableFields ?? 0;
    listing.meets_expectation = diag.meetsExpectation ?? false;
    listing.critical_fields_missing = diag.criticalFieldsMissing ?? [];
  }
}
