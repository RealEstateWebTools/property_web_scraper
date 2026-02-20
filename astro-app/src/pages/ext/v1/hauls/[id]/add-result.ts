import type { APIRoute } from 'astro';
import { isValidHaulId } from '@lib/services/haul-id.js';
import { getHaul, addScrapeToHaul } from '@lib/services/haul-store.js';
import { getListing, getDiagnostics } from '@lib/services/listing-store.js';
import { buildHaulScrapeFromListing } from '@lib/pages-helpers/build-haul-scrape.js';
import {
  errorResponse, successResponse, corsPreflightResponse,
  ApiErrorCode,
} from '@lib/services/api-response.js';

// Re-export for backward compatibility (used by scrapes.ts and tests)
export { buildHaulScrapeFromListing };

export const OPTIONS: APIRoute = ({ request }) => corsPreflightResponse(request);

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
