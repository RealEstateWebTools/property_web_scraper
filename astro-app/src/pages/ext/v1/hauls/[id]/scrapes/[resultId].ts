import type { APIRoute } from 'astro';
import { isValidHaulId } from '@lib/services/haul-id.js';
import { removeScrapeFromHaul } from '@lib/services/haul-store.js';
import {
  errorResponse, successResponse, corsPreflightResponse, ApiErrorCode,
} from '@lib/services/api-response.js';

export const OPTIONS: APIRoute = ({ request }) => corsPreflightResponse(request);

/**
 * DELETE /ext/v1/hauls/{id}/scrapes/{resultId} — Remove a scrape from a haul.
 */
export const DELETE: APIRoute = async ({ params, request }) => {
  const { id, resultId } = params;
  if (!id || !isValidHaulId(id)) {
    return errorResponse(ApiErrorCode.INVALID_REQUEST, 'Invalid haul ID format', request);
  }
  if (!resultId) {
    return errorResponse(ApiErrorCode.INVALID_REQUEST, 'Missing result ID', request);
  }

  try {
    const { haul, removed } = await removeScrapeFromHaul(id, resultId);
    if (!removed) {
      return errorResponse(ApiErrorCode.NOT_FOUND, 'Scrape not found in haul', request);
    }
    return successResponse({
      removed: true,
      scrape_count: haul.scrapes.length,
    }, request);
  } catch {
    return errorResponse(ApiErrorCode.NOT_FOUND, 'Haul not found or expired', request);
  }
};
