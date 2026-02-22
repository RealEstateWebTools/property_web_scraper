import type { APIRoute } from 'astro';
import { authenticateApiKey, validateUrlLength, MAX_HTML_SIZE } from '@lib/services/auth.js';
import { apiGuard } from '@lib/services/api-guard.js';
import { validateUrl } from '@lib/services/url-validator.js';
import { findByName } from '@lib/extractor/mapping-loader.js';
import { Listing } from '@lib/models/listing.js';
import { WhereChain } from '@lib/firestore/base-model.js';
import { checkRateLimit } from '@lib/services/rate-limiter.js';
import {
  errorResponse, successResponse, corsPreflightResponse,
  ApiErrorCode, mapValidatorError,
} from '@lib/services/api-response.js';
import { logActivity } from '@lib/services/activity-logger.js';
import { recordDeadLetter } from '@lib/services/dead-letter.js';
import { findPortalByHost } from '@lib/services/portal-registry.js';
import { fireWebhooks } from '@lib/services/webhook-service.js';
import { recordUsage } from '@lib/services/usage-meter.js';
import { normalizePropertyType } from '@lib/extractor/property-type-normalizer.js';
import { detectListingType } from '@lib/extractor/listing-type-detector.js';
import type { SplitSchema } from '@lib/extractor/schema-splitter.js';
import type { PortalConfig } from '@lib/services/portal-registry.js';
import { runExtraction, countAvailableFields, countExtractedFields } from '@lib/services/extraction-runner.js';

/**
 * Build PWB-formatted response from extraction result.
 * Transforms the flat extracted properties into PWB's {asset_data, listing_data, images} structure.
 */
function buildPwbResponse(
  splitSchema: SplitSchema,
  props: Record<string, unknown>,
  sourceUrl: string,
  portal: PortalConfig | undefined,
  extractionRate: number,
): Record<string, unknown> {
  const { assetData, listingData } = splitSchema;

  const assetResult: Record<string, unknown> = {
    reference: assetData.reference,
    street_address: assetData.street_address,
    city: assetData.city,
    region: assetData.region || assetData.province,
    postal_code: assetData.postal_code,
    country: assetData.country || portal?.country,
    latitude: assetData.latitude,
    longitude: assetData.longitude,
    prop_type_key: normalizePropertyType(
      (props.property_type as string) || (props.title as string),
    ),
    count_bedrooms: assetData.count_bedrooms,
    count_bathrooms: assetData.count_bathrooms,
    count_garages: assetData.count_garages,
    constructed_area: assetData.constructed_area,
    plot_area: assetData.plot_area,
    year_construction: assetData.year_construction,
    energy_rating: assetData.energy_rating,
    energy_performance: assetData.energy_performance,
  };

  const listingType = detectListingType(props, sourceUrl);

  const listingResult: Record<string, unknown> = {
    title: listingData.title,
    description: listingData.description,
    price_sale_current: props.for_sale ? listingData.price_float : 0,
    price_rental_monthly: (props.for_rent_long_term || props.for_rent_short_term) ? listingData.price_float : 0,
    currency: listingData.currency || portal?.currency,
    listing_type: listingType,
    furnished: listingData.furnished,
    for_sale: listingData.for_sale,
    for_rent_long_term: listingData.for_rent_long_term,
    for_rent_short_term: listingData.for_rent_short_term,
    features: assetData.features,
  };

  // Flatten image_urls from [{url: "..."}] to ["..."]
  const rawImages = assetData.image_urls;
  let images: string[] = [];
  if (Array.isArray(rawImages)) {
    images = rawImages.map((img: unknown) => {
      if (typeof img === 'string') return img;
      if (img && typeof img === 'object' && 'url' in img) return (img as { url: string }).url;
      return '';
    }).filter(Boolean);
  }

  return {
    portal: portal?.slug,
    extraction_rate: extractionRate,
    data: {
      asset_data: assetResult,
      listing_data: listingResult,
      images,
    },
  };
}

export const OPTIONS: APIRoute = ({ request }) => corsPreflightResponse(request);

/**
 * GET /public_api/v1/listings?url=...
 */
export const GET: APIRoute = async ({ request }) => {
  const startTime = Date.now();
  const path = '/public_api/v1/listings';

  const guard = await apiGuard(request, 'api');
  if (!guard.ok) return guard.response;
  const { auth } = guard;

  const url = new URL(request.url).searchParams.get('url');
  if (url) {
    try {
      validateUrlLength(url);
    } catch (error) {
      const resp = errorResponse(ApiErrorCode.INVALID_URL, error instanceof Error ? error.message : 'Invalid URL', request);
      logActivity({
        level: 'warn',
        category: 'api_request',
        message: `GET listings: ${error instanceof Error ? error.message : 'Invalid URL'}`,
        method: 'GET',
        path,
        statusCode: resp.status,
        durationMs: Date.now() - startTime,
        errorCode: ApiErrorCode.INVALID_URL,
      });
      return resp;
    }
  }

  const validation = await validateUrl(url);
  if (!validation.valid) {
    const resp = errorResponse(mapValidatorError(validation.errorCode), validation.errorMessage!, request);
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
    return errorResponse(ApiErrorCode.MISSING_SCRAPER, 'No scraper mapping found', request);
  }

  let listing: Listing;
  try {
    const chain = new WhereChain(Listing as any, { import_url: url! });
    listing = await chain.firstOrCreate() as unknown as Listing;
  } catch {
    listing = new Listing();
    listing.assignAttributes({ import_url: url! });
  }

  const visibility = (listing as any).visibility || 'published';
  if (visibility !== 'published' && visibility !== 'pending') {
    return errorResponse(ApiErrorCode.INVALID_URL, 'Listing is not available', request);
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
  }, request);
};

/**
 * POST /public_api/v1/listings
 */
export const POST: APIRoute = async ({ request }) => {
  const startTime = Date.now();
  const path = '/public_api/v1/listings';

  const auth = await authenticateApiKey(request);
  if (!auth.authorized) return auth.errorResponse!;

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
    return errorResponse(ApiErrorCode.UNSUPPORTED_CONTENT_TYPE, 'Content-Type must be application/json or multipart/form-data', request);
  }

  let url: string | null = null;
  let html: string | null = null;

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    url = formData.get('url') as string || null;
    const htmlFile = formData.get('html_file');
    if (htmlFile && htmlFile instanceof File) {
      if (htmlFile.size > MAX_HTML_SIZE) {
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
        return errorResponse(ApiErrorCode.PAYLOAD_TOO_LARGE, 'HTML payload exceeds 10MB limit', request);
      }
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
    return errorResponse(ApiErrorCode.PAYLOAD_TOO_LARGE, 'HTML payload exceeds 10MB limit', request);
  }

  // Rate limit with endpoint-specific multipliers (after body parsing)
  const endpointClass = html ? 'html_extract' as const : 'url_extract' as const;
  const rateCheck = await checkRateLimit(request, auth.tier, auth.userId, endpointClass);
  if (!rateCheck.allowed) return rateCheck.errorResponse!;

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
    return errorResponse(ApiErrorCode.MISSING_URL, 'Please provide a url', request);
  }

  try {
    validateUrlLength(url);
  } catch (error) {
    const resp = errorResponse(ApiErrorCode.INVALID_URL, error instanceof Error ? error.message : 'Invalid URL', request);
    logActivity({
      level: 'warn',
      category: 'api_request',
      message: `POST listings: ${error instanceof Error ? error.message : 'Invalid URL'}`,
      method: 'POST',
      path,
      statusCode: resp.status,
      durationMs: Date.now() - startTime,
      errorCode: ApiErrorCode.INVALID_URL,
    });
    return resp;
  }

  const validation = await validateUrl(url);
  if (!validation.valid) {
    const resp = errorResponse(mapValidatorError(validation.errorCode), validation.errorMessage!, request);
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

  // Block URL-only requests for portals that require JS rendering
  if (!html) {
    try {
      const parsedUrl = new URL(url);
      const portal = findPortalByHost(parsedUrl.hostname);
      if (portal?.requiresJsRendering) {
        logActivity({
          level: 'warn',
          category: 'api_request',
          message: `POST listings: fetch blocked for ${portal.scraperName}`,
          method: 'POST',
          path,
          statusCode: 422,
          durationMs: Date.now() - startTime,
          errorCode: ApiErrorCode.FETCH_BLOCKED,
        });
        return errorResponse(
          ApiErrorCode.FETCH_BLOCKED,
          'This portal blocks server-side fetching. Please provide the fully-rendered HTML in the request body.',
          request,
        );
      }
    } catch { /* URL parse failed, continue to normal flow */ }
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
    return errorResponse(ApiErrorCode.MISSING_SCRAPER, 'No scraper mapping found', request);
  }

  let listing: Listing;
  try {
    const chain = new WhereChain(Listing as any, { import_url: url });
    listing = await chain.firstOrCreate() as unknown as Listing;
  } catch {
    listing = new Listing();
    listing.assignAttributes({ import_url: url });
  }

  let extraction: Record<string, unknown> | undefined;

  if (html) {
    const apiSourceType = contentType.includes('multipart/form-data') ? 'api_multipart_html' as const : 'api_json_html' as const;
    const extractionResult = await runExtraction({ html, url, scraperMapping, importHost, sourceType: apiSourceType });

    if (extractionResult) {
      const { listing: extractedListing, resultId, resultsUrl, fieldsExtracted, fieldsAvailable, diagnostics, rawProps, splitSchema } = extractionResult;

      // Update the Firestore-backed listing with extracted data
      listing.import_host_slug = importHost.slug;
      listing.last_retrieved_at = new Date();
      Listing.updateFromHash(listing, rawProps);
      listing.price_cents = extractedListing.price_cents;
      listing.price_currency = extractedListing.price_currency;
      try { await listing.save(); } catch { /* Firestore unavailable */ }

      extraction = {
        fields_extracted: fieldsExtracted,
        fields_available: fieldsAvailable,
        scraper_used: importHost.scraper_name,
        diagnostics,
        results_url: resultsUrl,
        result_id: resultId,
        ...(splitSchema ? { split_schema: splitSchema } : {}),
        _rawProps: rawProps,
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

      // Fire webhooks asynchronously (fire-and-forget)
      fireWebhooks('extraction.completed', {
        listing_url: url,
        scraper: importHost.scraper_name,
        quality_grade: diagnostics?.qualityGrade || 'F',
        success_classification: diagnostics?.successClassification || 'failed',
        extraction_rate: diagnostics?.extractionRate || 0,
        expected_extraction_rate: diagnostics?.expectedExtractionRate,
        expectation_status: diagnostics?.expectationStatus,
        expectation_gap: diagnostics?.expectationGap,
        fields_extracted: fieldsExtracted,
        fields_available: fieldsAvailable,
        properties: rawProps,
      }).catch((err) => {
        logActivity({ level: 'error', category: 'system', message: '[Listings] Webhook delivery failed: ' + ((err as Error).message || err) });
        recordDeadLetter({ source: 'webhook', operation: `fireWebhooks(${url})`, error: (err as Error).message || String(err), context: { url, event: 'extraction.completed' }, attempts: 1 }).catch(() => {});
      });

      // Price history and scrape metadata now handled by runExtraction

      // Record usage for billing/quota (fire-and-forget)
      if (auth.userId) {
        recordUsage(auth.userId).catch((err) => {
          logActivity({ level: 'error', category: 'system', message: '[Listings] Usage recording failed: ' + ((err as Error).message || err) });
          recordDeadLetter({ source: 'usage', operation: `recordUsage(${auth.userId})`, error: (err as Error).message || String(err), context: { userId: auth.userId, url }, attempts: 1 }).catch(() => {});
        });
      }
    }
  }

  // Check for format=pwb query parameter
  const requestUrl = new URL(request.url);
  const format = requestUrl.searchParams.get('format');

  if (format === 'pwb' && extraction && extraction.split_schema) {
    const parsedUrl = new URL(url);
    const portal = findPortalByHost(parsedUrl.hostname);
    const props = (extraction as any)._rawProps || {};
    const pwbData = buildPwbResponse(
      extraction.split_schema as SplitSchema,
      props,
      url,
      portal,
      extraction.diagnostics
        ? (extraction.diagnostics as any).extractionRate || 0
        : 0,
    );

    logActivity({
      level: 'info',
      category: 'api_request',
      message: `POST listings: OK (pwb format, extracted ${extraction.fields_extracted} fields)`,
      method: 'POST',
      path,
      statusCode: 200,
      durationMs: Date.now() - startTime,
    });

    return successResponse(pwbData, request);
  }

  const response: Record<string, unknown> = {
    retry_duration: 0,
    urls_remaining: 0,
    listings: [listing.asJson()],
  };

  if (extraction) {
    // Strip internal _rawProps before sending in standard response
    const { _rawProps, ...publicExtraction } = extraction;
    response.extraction = publicExtraction;
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

  return successResponse(response, request);
};
