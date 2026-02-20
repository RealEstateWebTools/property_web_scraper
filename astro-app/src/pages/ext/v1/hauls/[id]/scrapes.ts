import type { APIRoute } from 'astro';
import { isValidHaulId } from '@lib/services/haul-id.js';
import { getHaul } from '@lib/services/haul-store.js';
import { handleScrapeRequest, parseScrapeBody } from '@lib/services/scrape-handler.js';
import {
  errorResponse, corsPreflightResponse,
  ApiErrorCode,
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

  let body: any;
  try {
    body = await request.json();
  } catch {
    return errorResponse(ApiErrorCode.INVALID_REQUEST, 'Invalid JSON body', request);
  }

  const parsed = parseScrapeBody(body, request);
  if (parsed instanceof Response) return parsed;

  return handleScrapeRequest(id, parsed, request);
};
