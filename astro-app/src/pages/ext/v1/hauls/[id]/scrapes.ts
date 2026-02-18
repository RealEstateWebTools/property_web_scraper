import type { APIRoute } from 'astro';
import { isValidHaulId } from '@lib/services/haul-id.js';
import { getHaul, addScrapeToHaul, initHaulKV } from '@lib/services/haul-store.js';
import type { HaulScrape } from '@lib/services/haul-store.js';
import { validateUrl } from '@lib/services/url-validator.js';
import { findByName } from '@lib/extractor/mapping-loader.js';
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

  initHaulKV((globalThis as any).__kvNamespace ?? undefined);

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

  // Validate URL
  const validation = await validateUrl(url);
  if (!validation.valid) {
    return errorResponse(mapValidatorError(validation.errorCode), validation.errorMessage!, request);
  }

  const importHost = validation.importHost!;
  const scraperMapping = findByName(importHost.scraper_name);
  if (!scraperMapping) {
    return errorResponse(ApiErrorCode.MISSING_SCRAPER, 'No scraper mapping found', request);
  }

  // Run extraction
  const extractionResult = await runExtraction({ html, url, scraperMapping, importHost });
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
  };

  const { added } = await addScrapeToHaul(id, scrape);
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
  }, request, 201);
};
