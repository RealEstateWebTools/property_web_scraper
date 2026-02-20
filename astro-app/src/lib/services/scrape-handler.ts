/**
 * Shared scrape handling logic used by both:
 *   - POST /ext/v1/hauls/{id}/scrapes (legacy)
 *   - POST /ext/v1/scrapes (auto-haul)
 */

import { addScrapeToHaul, findExistingScrapeByUrl } from './haul-store.js';
import type { HaulScrape } from './haul-store.js';
import { validateUrl, UNSUPPORTED } from './url-validator.js';
import { findByName } from '@lib/extractor/mapping-loader.js';
import { ImportHost } from '@lib/models/import-host.js';
import { MAX_HTML_SIZE } from './auth.js';
import { runExtraction } from './extraction-runner.js';
import { getListingByUrl, getDiagnostics } from './listing-store.js';
import { buildHaulScrapeFromListing } from '@lib/pages-helpers/build-haul-scrape.js';
import {
  errorResponse, successResponse,
  ApiErrorCode, mapValidatorError,
} from './api-response.js';

export interface ScrapeInput {
  url: string;
  html: string;
}

/**
 * Parse and validate the JSON body of a scrape request.
 * Returns the parsed input or an error Response.
 */
export function parseScrapeBody(body: any, request: Request): ScrapeInput | Response {
  const url = body.url;
  const html = body.html;

  if (!url) {
    return errorResponse(ApiErrorCode.MISSING_URL, 'Please provide a url', request);
  }
  if (!html) {
    return errorResponse(ApiErrorCode.INVALID_REQUEST, 'Please provide html content', request);
  }
  if (html.length > MAX_HTML_SIZE) {
    return errorResponse(ApiErrorCode.PAYLOAD_TOO_LARGE, 'HTML payload exceeds 10MB limit', request);
  }

  return { url, html };
}

/**
 * Run the full scrape flow for a given haul: duplicate checks, URL validation,
 * extraction, HaulScrape building, and persistence.
 *
 * Returns a Response ready to send to the client.
 */
export async function handleScrapeRequest(
  haulId: string,
  input: ScrapeInput,
  request: Request,
): Promise<Response> {
  const { url, html } = input;

  // Duplicate check -- reject if this URL is already in this haul
  const existingScrape = await findExistingScrapeByUrl(haulId, url);
  if (existingScrape) {
    return successResponse({
      duplicate: true,
      message: 'This property has already been scraped',
      existing_scrape: {
        result_id: existingScrape.resultId,
        title: existingScrape.title,
        grade: existingScrape.grade,
        price: existingScrape.price,
        url: existingScrape.url,
      },
      haul_id: haulId,
      haul_url: `/haul/${haulId}`,
      results_url: `/extract/results/${existingScrape.resultId}`,
    }, request, 409);
  }

  // Cross-application duplicate check -- if this URL was already extracted
  // by anyone, skip extraction and add the existing listing to this haul
  const existingListing = await getListingByUrl(url);
  if (existingListing) {
    const diagnostics = await getDiagnostics(existingListing.id);
    const scrape = buildHaulScrapeFromListing(existingListing.id, existingListing.listing, diagnostics);
    const { added } = await addScrapeToHaul(haulId, scrape);
    if (!added) {
      return errorResponse(ApiErrorCode.INVALID_REQUEST, 'Haul is full (20/20 scrapes)', request);
    }
    return successResponse({
      duplicate: true,
      message: 'This property was already extracted -- added existing data to your haul',
      scrape: {
        result_id: existingListing.id,
        title: scrape.title,
        grade: scrape.grade,
        rate: scrape.extractionRate,
        price: scrape.price,
      },
      haul_id: haulId,
      haul_url: `/haul/${haulId}`,
      results_url: `/extract/results/${existingListing.id}`,
      was_existing_listing: true,
    }, request, 200);
  }

  // Validate URL -- fall back to generic_real_estate for unknown hosts
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
    return errorResponse(ApiErrorCode.INVALID_REQUEST, 'Extraction failed -- no data could be extracted', request);
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

  const { added, replaced } = await addScrapeToHaul(haulId, scrape);
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
    haul_id: haulId,
    haul_url: `/haul/${haulId}`,
    results_url: resultsUrl,
    was_existing_listing: extractionResult.wasExistingListing,
    was_unchanged: extractionResult.wasUnchanged,
    replaced,
  }, request, 201);
}
