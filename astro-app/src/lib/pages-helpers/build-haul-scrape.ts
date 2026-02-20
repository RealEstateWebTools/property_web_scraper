/**
 * Build a HaulScrape from a stored Listing and its diagnostics.
 * Shared between add-result endpoint and scrape-handler.
 */

import type { HaulScrape } from '@lib/services/haul-store.js';

export function buildHaulScrapeFromListing(
  resultId: string,
  listing: any,
  diagnostics: any,
): HaulScrape {
  const grade = diagnostics?.qualityGrade || 'F';
  const extractionRate = diagnostics?.extractionRate || 0;
  let importHostSlug: string | undefined;
  try {
    importHostSlug = new URL(listing.import_url || '').hostname.split('.').slice(-2, -1)[0] || undefined;
  } catch {
    importHostSlug = undefined;
  }

  return {
    resultId,
    title: listing.title || 'Untitled',
    grade,
    price: listing.price_string || '',
    extractionRate,
    createdAt: new Date().toISOString(),
    url: listing.import_url || '',
    price_float: listing.price_float || undefined,
    currency: listing.currency || undefined,
    count_bedrooms: listing.count_bedrooms || undefined,
    count_bathrooms: listing.count_bathrooms || undefined,
    constructed_area: listing.constructed_area || undefined,
    area_unit: listing.area_unit !== 'sqmt' ? listing.area_unit : undefined,
    latitude: listing.latitude || undefined,
    longitude: listing.longitude || undefined,
    city: listing.city || undefined,
    country: listing.country || undefined,
    address_string: listing.address_string || undefined,
    main_image_url: listing.main_image_url || undefined,
    import_host_slug: listing.import_host_slug || importHostSlug,
    for_sale: listing.for_sale || undefined,
    for_rent: listing.for_rent || undefined,
    features: listing.features?.length ? listing.features : undefined,
    description: listing.description ? String(listing.description).slice(0, 500) : undefined,
    description_html: (listing.description_html && listing.description_html.length <= 1000)
      ? listing.description_html : undefined,
    property_type: listing.property_type || undefined,
    property_subtype: listing.property_subtype || undefined,
    tenure: listing.tenure || undefined,
    listing_status: listing.listing_status || undefined,
    agent_name: listing.agent_name || undefined,
    agent_phone: listing.agent_phone || undefined,
    agent_email: listing.agent_email || undefined,
    agent_logo_url: listing.agent_logo_url || undefined,
    price_qualifier: listing.price_qualifier || undefined,
    floor_plan_urls: listing.floor_plan_urls?.length ? listing.floor_plan_urls : undefined,
    energy_certificate_grade: listing.energy_certificate_grade || undefined,
    locale_code: listing.locale_code || undefined,
  };
}
