import type { APIRoute } from 'astro';
import { isValidHaulId } from '@lib/services/haul-id.js';
import { getHaul, addScrapeToHaul } from '@lib/services/haul-store.js';
import type { HaulScrape } from '@lib/services/haul-store.js';
import { getListing, getDiagnostics } from '@lib/services/listing-store.js';
import {
  errorResponse, successResponse, corsPreflightResponse,
  ApiErrorCode,
} from '@lib/services/api-response.js';

export const OPTIONS: APIRoute = ({ request }) => corsPreflightResponse(request);

/**
 * Build a HaulScrape from a stored Listing and its diagnostics.
 * Exported for testing.
 */
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
    // Enriched fields
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
    // Interoperability fields
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

/**
 * POST /ext/v1/hauls/{id}/add-result — Add a previously extracted result to a haul.
 * Body: { "resultId": "<listing-store-id>" }
 */
export const POST: APIRoute = async ({ params, request }) => {
  const { id } = params;
  if (!id || !isValidHaulId(id)) {
    return errorResponse(ApiErrorCode.INVALID_REQUEST, 'Invalid haul ID format', request);
  }

  // Check haul exists
  const haul = await getHaul(id);
  if (!haul) {
    return errorResponse(ApiErrorCode.NOT_FOUND, 'Haul not found or expired', request);
  }
  if (haul.scrapes.length >= 20) {
    return errorResponse(ApiErrorCode.INVALID_REQUEST, 'Haul is full (20/20 scrapes)', request);
  }

  // Parse body
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return errorResponse(ApiErrorCode.UNSUPPORTED_CONTENT_TYPE, 'Content-Type must be application/json', request);
  }

  let resultId: string;
  try {
    const body = await request.json();
    resultId = body.resultId;
  } catch {
    return errorResponse(ApiErrorCode.INVALID_REQUEST, 'Invalid JSON body', request);
  }

  if (!resultId || typeof resultId !== 'string') {
    return errorResponse(ApiErrorCode.INVALID_REQUEST, 'Please provide a resultId', request);
  }

  // Look up stored listing
  const listing = await getListing(resultId);
  if (!listing) {
    return errorResponse(ApiErrorCode.NOT_FOUND, 'Result not found or expired', request);
  }

  const diagnostics = await getDiagnostics(resultId);

  const scrape = buildHaulScrapeFromListing(resultId, listing, diagnostics);

  const { added, replaced } = await addScrapeToHaul(id, scrape);
  if (!added) {
    return errorResponse(ApiErrorCode.INVALID_REQUEST, 'Haul is full (20/20 scrapes)', request);
  }

  return successResponse({
    scrape: {
      result_id: resultId,
      title: scrape.title,
      grade: scrape.grade,
      rate: scrape.extractionRate,
      price: scrape.price,
    },
    haul_url: `/haul/${id}`,
    replaced,
  }, request, 201);
};
