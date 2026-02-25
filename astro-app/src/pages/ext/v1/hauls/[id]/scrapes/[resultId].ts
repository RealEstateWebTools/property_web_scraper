import type { APIRoute } from 'astro';
import { isValidHaulId } from '@lib/services/haul-id.js';
import { getHaul, removeScrapeFromHaul } from '@lib/services/haul-store.js';
import { authenticateApiKey } from '@lib/services/auth.js';
import { canModifyHaul, userIdFromAuth } from '@lib/services/haul-access.js';
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

  const haul = await getHaul(id);
  if (!haul) {
    return errorResponse(ApiErrorCode.NOT_FOUND, 'Haul not found or expired', request);
  }
  const auth = await authenticateApiKey(request);
  const requesterUserId = userIdFromAuth(auth);
  if (!canModifyHaul(haul, requesterUserId)) {
    return errorResponse(ApiErrorCode.NOT_FOUND, 'Haul not found or expired', request);
  }

  try {
    const { haul: updatedHaul, removed } = await removeScrapeFromHaul(id, resultId);
    if (!removed) {
      return errorResponse(ApiErrorCode.NOT_FOUND, 'Scrape not found in haul', request);
    }
    return successResponse({
      removed: true,
      scrape_count: updatedHaul.scrapes.length,
    }, request);
  } catch {
    return errorResponse(ApiErrorCode.NOT_FOUND, 'Haul not found or expired', request);
  }
};
