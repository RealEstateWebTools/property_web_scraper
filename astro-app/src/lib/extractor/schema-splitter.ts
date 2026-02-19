export interface SplitSchema {
  assetData: Record<string, unknown>;
  listingData: Record<string, unknown>;
  unmapped: Record<string, unknown>;
}

const ASSET_FIELDS = new Set([
  'reference', 'address_string',
  'street_number', 'street_name', 'street_address', 'postal_code',
  'province', 'city', 'region', 'country',
  'latitude', 'longitude',
  'constructed_area', 'plot_area', 'area_unit',
  'count_bedrooms', 'count_bathrooms', 'count_toilets', 'count_garages',
  'year_construction', 'energy_rating', 'energy_performance',
  'image_urls', 'main_image_url', 'features',
  'property_type', 'property_subtype', 'tenure',
  'energy_certificate_grade', 'floor_plan_urls',
]);

const LISTING_FIELDS = new Set([
  'title', 'description',
  'price_string', 'price_float', 'price_cents', 'price_currency',
  'currency', 'locale_code',
  'for_sale', 'for_rent', 'for_rent_short_term', 'for_rent_long_term',
  'furnished', 'sold', 'reserved',
  'listing_status', 'price_qualifier',
  'agent_name', 'agent_phone', 'agent_email', 'agent_logo_url',
]);

/**
 * Split a property hash into asset data (physical property) and listing data (commercial).
 * Fields not in either set go into unmapped.
 */
export function splitPropertyHash(hash: Record<string, unknown>): SplitSchema {
  const assetData: Record<string, unknown> = {};
  const listingData: Record<string, unknown> = {};
  const unmapped: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(hash)) {
    if (ASSET_FIELDS.has(key)) {
      assetData[key] = value;
    } else if (LISTING_FIELDS.has(key)) {
      listingData[key] = value;
    } else {
      unmapped[key] = value;
    }
  }

  return { assetData, listingData, unmapped };
}
