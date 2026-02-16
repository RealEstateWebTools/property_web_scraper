import type { APIRoute } from 'astro';
import { authenticateApiKey } from '@lib/services/auth.js';
import { validateUrl } from '@lib/services/url-validator.js';
import { extractFromHtml } from '@lib/extractor/html-extractor.js';
import { findByName } from '@lib/extractor/mapping-loader.js';
import { Listing } from '@lib/models/listing.js';
import { WhereChain } from '@lib/firestore/base-model.js';
import { checkRateLimit } from '@lib/services/rate-limiter.js';
import {
  errorResponse, successResponse, corsPreflightResponse,
  ApiErrorCode, mapValidatorError,
} from '@lib/services/api-response.js';
import { logActivity } from '@lib/services/activity-logger.js';
import type { ScraperMapping } from '@lib/extractor/mapping-loader.js';

const MAX_HTML_SIZE = 10_000_000; // 10 MB

function countAvailableFields(mapping: ScraperMapping): number {
  let count = 0;
  if (mapping.textFields) count += Object.keys(mapping.textFields).length;
  if (mapping.intFields) count += Object.keys(mapping.intFields).length;
  if (mapping.floatFields) count += Object.keys(mapping.floatFields).length;
  if (mapping.booleanFields) count += Object.keys(mapping.booleanFields).length;
  if (mapping.images) count += mapping.images.length;
  if (mapping.features) count += mapping.features.length;
  return count;
}

function countExtractedFields(props: Record<string, unknown>): number {
  let count = 0;
  for (const [, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === '' || value === 0 || value === false) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    count++;
  }
  return count;
}

export const OPTIONS: APIRoute = () => corsPreflightResponse();

/**
 * GET /public_api/v1/listings?url=...
 */
export const GET: APIRoute = async ({ request }) => {
  const startTime = Date.now();
  const path = '/public_api/v1/listings';

  const auth = authenticateApiKey(request);
  if (!auth.authorized) return auth.errorResponse!;

  const rateCheck = checkRateLimit(request);
  if (!rateCheck.allowed) return rateCheck.errorResponse!;

  const url = new URL(request.url).searchParams.get('url');
  const validation = await validateUrl(url);
  if (!validation.valid) {
    const resp = errorResponse(mapValidatorError(validation.errorCode), validation.errorMessage!);
    logActivity({
      level: 'warn',
      category: 'api_request',
      message: `GET listings: ${validation.errorMessage}`,
      method: 'GET',
      path,
      statusCode: resp.status,
      durationMs: Date.now() - startTime,
      errorCode: mapValidatorError(validation.errorCode),
    });
    return resp;
  }

  const importHost = validation.importHost!;
  const scraperMapping = findByName(importHost.scraper_name);
  if (!scraperMapping) {
    logActivity({
      level: 'warn',
      category: 'api_request',
      message: 'GET listings: No scraper mapping found',
      method: 'GET',
      path,
      statusCode: 500,
      durationMs: Date.now() - startTime,
      errorCode: ApiErrorCode.MISSING_SCRAPER,
    });
    return errorResponse(ApiErrorCode.MISSING_SCRAPER, 'No scraper mapping found');
  }

  let listing: Listing;
  try {
    const chain = new WhereChain(Listing as any, { import_url: url! });
    listing = await chain.firstOrCreate();
  } catch {
    listing = new Listing();
    listing.assignAttributes({ import_url: url! });
  }

  logActivity({
    level: 'info',
    category: 'api_request',
    message: 'GET listings: OK',
    method: 'GET',
    path,
    statusCode: 200,
    durationMs: Date.now() - startTime,
  });

  return successResponse({
    retry_duration: 0,
    urls_remaining: 0,
    listings: [listing.asJson()],
  });
};

/**
 * POST /public_api/v1/listings
 */
export const POST: APIRoute = async ({ request }) => {
  const startTime = Date.now();
  const path = '/public_api/v1/listings';

  const auth = authenticateApiKey(request);
  if (!auth.authorized) return auth.errorResponse!;

  const rateCheck = checkRateLimit(request);
  if (!rateCheck.allowed) return rateCheck.errorResponse!;

  const contentType = request.headers.get('content-type') || '';

  if (!contentType.includes('multipart/form-data') && !contentType.includes('application/json')) {
    logActivity({
      level: 'warn',
      category: 'api_request',
      message: 'POST listings: unsupported content type',
      method: 'POST',
      path,
      statusCode: 415,
      durationMs: Date.now() - startTime,
      errorCode: ApiErrorCode.UNSUPPORTED_CONTENT_TYPE,
    });
    return errorResponse(ApiErrorCode.UNSUPPORTED_CONTENT_TYPE, 'Content-Type must be application/json or multipart/form-data');
  }

  let url: string | null = null;
  let html: string | null = null;

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    url = formData.get('url') as string || null;
    const htmlFile = formData.get('html_file');
    if (htmlFile && htmlFile instanceof File) {
      html = await htmlFile.text();
    } else {
      html = formData.get('html') as string || null;
    }
  } else if (contentType.includes('application/json')) {
    const body = await request.json();
    url = body.url || null;
    html = body.html || null;
  }

  if (html && html.length > MAX_HTML_SIZE) {
    logActivity({
      level: 'warn',
      category: 'api_request',
      message: 'POST listings: payload too large',
      method: 'POST',
      path,
      statusCode: 413,
      durationMs: Date.now() - startTime,
      errorCode: ApiErrorCode.PAYLOAD_TOO_LARGE,
    });
    return errorResponse(ApiErrorCode.PAYLOAD_TOO_LARGE, 'HTML payload exceeds 10MB limit');
  }

  if (!url) {
    logActivity({
      level: 'warn',
      category: 'api_request',
      message: 'POST listings: missing URL',
      method: 'POST',
      path,
      statusCode: 400,
      durationMs: Date.now() - startTime,
      errorCode: ApiErrorCode.MISSING_URL,
    });
    return errorResponse(ApiErrorCode.MISSING_URL, 'Please provide a url');
  }

  const validation = await validateUrl(url);
  if (!validation.valid) {
    const resp = errorResponse(mapValidatorError(validation.errorCode), validation.errorMessage!);
    logActivity({
      level: 'warn',
      category: 'api_request',
      message: `POST listings: ${validation.errorMessage}`,
      method: 'POST',
      path,
      statusCode: resp.status,
      durationMs: Date.now() - startTime,
      errorCode: mapValidatorError(validation.errorCode),
    });
    return resp;
  }

  const importHost = validation.importHost!;
  const scraperMapping = findByName(importHost.scraper_name);
  if (!scraperMapping) {
    logActivity({
      level: 'warn',
      category: 'api_request',
      message: 'POST listings: No scraper mapping found',
      method: 'POST',
      path,
      statusCode: 500,
      durationMs: Date.now() - startTime,
      errorCode: ApiErrorCode.MISSING_SCRAPER,
    });
    return errorResponse(ApiErrorCode.MISSING_SCRAPER, 'No scraper mapping found');
  }

  let listing: Listing;
  try {
    const chain = new WhereChain(Listing as any, { import_url: url });
    listing = await chain.firstOrCreate();
  } catch {
    listing = new Listing();
    listing.assignAttributes({ import_url: url });
  }

  let extraction: Record<string, unknown> | undefined;

  if (html) {
    const result = extractFromHtml({
      html,
      sourceUrl: url,
      scraperMapping,
    });

    if (result.success && result.properties.length > 0) {
      listing.import_host_slug = importHost.slug;
      listing.last_retrieved_at = new Date();
      Listing.updateFromHash(listing, result.properties[0]);
      try { await listing.save(); } catch { /* Firestore unavailable */ }

      const fieldsExtracted = countExtractedFields(result.properties[0]);
      const fieldsAvailable = countAvailableFields(scraperMapping);

      extraction = {
        fields_extracted: fieldsExtracted,
        fields_available: fieldsAvailable,
        scraper_used: importHost.scraper_name,
        diagnostics: result.diagnostics,
      };

      if (fieldsExtracted === 0) {
        logActivity({
          level: 'warn',
          category: 'extraction',
          message: `Extraction returned 0 fields for ${importHost.scraper_name}`,
          sourceUrl: url,
          scraperName: importHost.scraper_name,
          fieldsFound: 0,
          fieldsAvailable,
        });
      }

      logActivity({
        level: 'info',
        category: 'extraction',
        message: `Extraction via API: ${fieldsExtracted}/${fieldsAvailable} fields`,
        sourceUrl: url,
        scraperName: importHost.scraper_name,
        fieldsFound: fieldsExtracted,
        fieldsAvailable,
      });
    }
  }

  const response: Record<string, unknown> = {
    retry_duration: 0,
    urls_remaining: 0,
    listings: [listing.asJson()],
  };

  if (extraction) {
    response.extraction = extraction;
  }

  logActivity({
    level: 'info',
    category: 'api_request',
    message: `POST listings: OK${extraction ? ` (extracted ${extraction.fields_extracted} fields)` : ''}`,
    method: 'POST',
    path,
    statusCode: 200,
    durationMs: Date.now() - startTime,
  });

  return successResponse(response);
};
