import type { APIRoute } from 'astro';
import { isValidHaulId } from '@lib/services/haul-id.js';
import { getHaul, addScrapeToHaul } from '@lib/services/haul-store.js';
import type { HaulScrape } from '@lib/services/haul-store.js';
import { validateUrl, UNSUPPORTED } from '@lib/services/url-validator.js';
import { findByName } from '@lib/extractor/mapping-loader.js';
import { ImportHost } from '@lib/models/import-host.js';
import { MAX_HTML_SIZE } from '@lib/services/auth.js';
import { runExtraction } from '@lib/services/extraction-runner.js';
import {
  errorResponse, successResponse, corsPreflightResponse,
  ApiErrorCode, mapValidatorError,
} from '@lib/services/api-response.js';

export const OPTIONS: APIRoute = ({ request }) => corsPreflightResponse(request);

/**
 * POST /ext/v1/hauls/{id}/scrapes — Add a scrape to a haul. No auth required.
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

  let url: string;
  let html: string;
  try {
    const body = await request.json();
    url = body.url;
    html = body.html;
  } catch {
    return errorResponse(ApiErrorCode.INVALID_REQUEST, 'Invalid JSON body', request);
  }

  if (!url) {
    return errorResponse(ApiErrorCode.MISSING_URL, 'Please provide a url', request);
  }
  if (!html) {
    return errorResponse(ApiErrorCode.INVALID_REQUEST, 'Please provide html content', request);
  }
  if (html.length > MAX_HTML_SIZE) {
    return errorResponse(ApiErrorCode.PAYLOAD_TOO_LARGE, 'HTML payload exceeds 10MB limit', request);
  }

  // Validate URL — fall back to generic_real_estate for unknown hosts
  const validation = await validateUrl(url);
  let importHost = validation.importHost;

  if (!validation.valid && validation.errorCode === UNSUPPORTED) {
    const genericMapping = findByName('generic_real_estate');
    if (genericMapping) {
      importHost = new ImportHost();
      importHost.host = new URL(url).hostname;
      importHost.scraper_name = 'generic_real_estate';
      importHost.slug = 'generic';
    }
  } else if (!validation.valid) {
    return errorResponse(mapValidatorError(validation.errorCode), validation.errorMessage!, request);
  }

  if (!importHost) {
    return errorResponse(ApiErrorCode.MISSING_SCRAPER, 'No scraper mapping found', request);
  }

  const scraperMapping = findByName(importHost.scraper_name);
  if (!scraperMapping) {
    return errorResponse(ApiErrorCode.MISSING_SCRAPER, 'No scraper mapping found', request);
  }

  // Run extraction
  const extractionResult = await runExtraction({ html, url, scraperMapping, importHost, sourceType: 'manual_html' });
  if (!extractionResult) {
    return errorResponse(ApiErrorCode.INVALID_REQUEST, 'Extraction failed — no data could be extracted', request);
  }

  const { listing, resultId, resultsUrl, fieldsExtracted, fieldsAvailable, diagnostics } = extractionResult;

  const grade = diagnostics?.qualityGrade || 'F';
  const extractionRate = diagnostics?.extractionRate || 0;

  const scrape: HaulScrape = {
    resultId,
    title: listing.title || 'Untitled',
    grade,
    price: listing.price_string || '',
    extractionRate,
    createdAt: new Date().toISOString(),
    url,
    // Enriched fields — omit zero/empty values to save space
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
    import_host_slug: importHost.slug || undefined,
    for_sale: listing.for_sale || undefined,
    for_rent: listing.for_rent || undefined,
    features: listing.features?.length ? listing.features : undefined,
    description: listing.description ? listing.description.slice(0, 500) : undefined,
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
  };

  const { added, replaced } = await addScrapeToHaul(id, scrape);
  if (!added) {
    return errorResponse(ApiErrorCode.INVALID_REQUEST, 'Haul is full (20/20 scrapes)', request);
  }

  return successResponse({
    scrape: {
      result_id: resultId,
      title: scrape.title,
      grade,
      rate: extractionRate,
      price: scrape.price,
      fields_extracted: fieldsExtracted,
      fields_available: fieldsAvailable,
    },
    haul_url: `/haul/${id}`,
    results_url: resultsUrl,
    was_existing_listing: extractionResult.wasExistingListing,
    replaced,
  }, request, 201);
};
