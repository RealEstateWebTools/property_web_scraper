/**
 * Centralized Field-Mapping Registry
 * Single source of truth mapping internal field names to external standards.
 */

export type MappingStandard = 'reso' | 'schema_org' | 'blm' | 'kyero';

export interface FieldMappingEntry {
  reso?: string;
  schema_org?: string;
  blm?: string;
  kyero?: string;
}

/**
 * Master mapping table: internal field name → external standard names.
 */
const FIELD_MAPPINGS: Record<string, FieldMappingEntry> = {
  reference: {
    reso: 'ListingKey',
    schema_org: '@id',
    blm: 'AGENT_REF',
    kyero: 'ref',
  },
  title: {
    reso: 'ListingTitle',
    schema_org: 'name',
    blm: 'SUMMARY',
    kyero: 'title',
  },
  description: {
    reso: 'PublicRemarks',
    schema_org: 'description',
    blm: 'DESCRIPTION',
    kyero: 'desc',
  },
  price_float: {
    reso: 'ListPrice',
    schema_org: 'offers.price',
    blm: 'PRICE',
    kyero: 'price',
  },
  price_string: {
    reso: 'ListPriceDisplay',
    blm: 'PRICE_DISPLAY',
  },
  currency: {
    reso: 'CurrencyCode',
    schema_org: 'offers.priceCurrency',
    blm: 'CURRENCY',
    kyero: 'currency',
  },
  price_cents: {
    reso: 'ListPriceCents',
  },
  price_currency: {
    reso: 'CurrencyCode',
  },
  price_qualifier: {
    reso: 'ListPriceQualifier',
    blm: 'PRICE_QUALIFIER',
    kyero: 'price_freq',
  },
  count_bedrooms: {
    reso: 'BedroomsTotal',
    schema_org: 'numberOfBedrooms',
    blm: 'BEDROOMS',
    kyero: 'beds',
  },
  count_bathrooms: {
    reso: 'BathroomsTotalInteger',
    schema_org: 'numberOfBathroomsTotal',
    blm: 'BATHROOMS',
    kyero: 'baths',
  },
  count_toilets: {
    reso: 'BathroomHalf',
    blm: 'TOILETS',
  },
  count_garages: {
    reso: 'GarageSpaces',
    blm: 'PARKING',
  },
  constructed_area: {
    reso: 'LivingArea',
    schema_org: 'floorSize.value',
    blm: 'SIZE',
    kyero: 'surface_area.built',
  },
  plot_area: {
    reso: 'LotSizeArea',
    blm: 'PLOT_SIZE',
    kyero: 'surface_area.plot',
  },
  area_unit: {
    reso: 'LivingAreaUnits',
    blm: 'SIZE_UNITS',
  },
  year_construction: {
    reso: 'YearBuilt',
    blm: 'YEAR_BUILT',
    kyero: 'year_built',
  },
  energy_rating: {
    reso: 'GreenBuildingCertification',
    blm: 'EPC_RATING',
  },
  energy_performance: {
    reso: 'GreenEnergyEfficient',
  },
  energy_certificate_grade: {
    reso: 'GreenBuildingCertificationRating',
    blm: 'EPC_LETTER',
    kyero: 'energy_rating.consumption',
  },
  property_type: {
    reso: 'PropertyType',
    schema_org: 'about.@type',
    blm: 'PROP_SUB_ID',
    kyero: 'type',
  },
  property_subtype: {
    reso: 'PropertySubType',
    blm: 'PROP_SUB_ID_2',
    kyero: 'subtype',
  },
  tenure: {
    reso: 'Tenure',
    blm: 'TENURE_TYPE_ID',
  },
  listing_status: {
    reso: 'StandardStatus',
    blm: 'STATUS_ID',
    kyero: 'status',
  },
  agent_name: {
    reso: 'ListAgentFullName',
    blm: 'AGENT_NAME',
    kyero: 'agent',
  },
  agent_phone: {
    reso: 'ListAgentDirectPhone',
    blm: 'AGENT_PHONE',
  },
  agent_email: {
    reso: 'ListAgentEmail',
    blm: 'AGENT_EMAIL',
  },
  agent_logo_url: {
    reso: 'ListOfficeLogo',
    blm: 'AGENT_LOGO',
  },
  address_string: {
    reso: 'UnparsedAddress',
    blm: 'DISPLAY_ADDRESS',
    kyero: 'location.detail',
  },
  street_name: {
    reso: 'StreetName',
    blm: 'ADDRESS_2',
  },
  street_number: {
    reso: 'StreetNumber',
    blm: 'ADDRESS_1',
  },
  street_address: {
    reso: 'StreetAddress',
  },
  postal_code: {
    reso: 'PostalCode',
    blm: 'POSTCODE1',
    kyero: 'location.zip',
  },
  city: {
    reso: 'City',
    schema_org: 'address.addressLocality',
    blm: 'TOWN',
    kyero: 'location.city',
  },
  province: {
    reso: 'StateOrProvince',
    schema_org: 'address.addressRegion',
    blm: 'COUNTY',
    kyero: 'location.province',
  },
  region: {
    reso: 'CountyOrParish',
    blm: 'AREA',
    kyero: 'location.area',
  },
  country: {
    reso: 'Country',
    schema_org: 'address.addressCountry',
    blm: 'COUNTRY',
    kyero: 'location.country',
  },
  latitude: {
    reso: 'Latitude',
    schema_org: 'geo.latitude',
    blm: 'LATITUDE',
    kyero: 'location.latitude',
  },
  longitude: {
    reso: 'Longitude',
    schema_org: 'geo.longitude',
    blm: 'LONGITUDE',
    kyero: 'location.longitude',
  },
  main_image_url: {
    reso: 'MediaURL',
  },
  import_url: {
    reso: 'OriginalListingURL',
    schema_org: 'url',
    blm: 'URL',
    kyero: 'url',
  },
  for_sale: {
    reso: 'ForSale',
    blm: 'TRANS_TYPE_ID',
  },
  for_rent: {
    reso: 'ForLease',
  },
  furnished: {
    reso: 'Furnished',
    blm: 'FURNISHED',
  },
  sold: {
    reso: 'Sold',
  },
  reserved: {
    reso: 'Reserved',
  },
  locale_code: {
    reso: 'ListingLanguage',
  },
  import_host_slug: {
    reso: 'SourceSystem',
  },
};

/**
 * Get the external field name for an internal field in a given standard.
 * Returns undefined if no mapping exists.
 */
export function getFieldName(
  internalField: string,
  standard: MappingStandard,
): string | undefined {
  return FIELD_MAPPINGS[internalField]?.[standard];
}

/**
 * Get all mapped fields for a given standard as { internalName: externalName }.
 */
export function getMappingsForStandard(
  standard: MappingStandard,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [internal, entry] of Object.entries(FIELD_MAPPINGS)) {
    const external = entry[standard];
    if (external) {
      result[internal] = external;
    }
  }
  return result;
}

/**
 * Reverse lookup: given an external field name and standard, find the internal name.
 * Returns undefined if no mapping exists.
 */
export function getInternalFieldName(
  externalField: string,
  standard: MappingStandard,
): string | undefined {
  for (const [internal, entry] of Object.entries(FIELD_MAPPINGS)) {
    if (entry[standard] === externalField) {
      return internal;
    }
  }
  return undefined;
}
