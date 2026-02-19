import type { APIRoute } from 'astro';
import { isValidHaulId } from '@lib/services/haul-id.js';
import { getHaul, initHaulKV } from '@lib/services/haul-store.js';
import { resolveKV } from '@lib/services/kv-resolver.js';
import { errorResponse, successResponse, corsPreflightResponse, ApiErrorCode } from '@lib/services/api-response.js';

export const OPTIONS: APIRoute = ({ request }) => corsPreflightResponse(request);

/**
 * GET /ext/v1/hauls/{id} — Get haul details.
 */
export const GET: APIRoute = async ({ params, request, locals }) => {
  const { id } = params;
  if (!id || !isValidHaulId(id)) {
    return errorResponse(ApiErrorCode.INVALID_REQUEST, 'Invalid haul ID format', request);
  }

  initHaulKV(resolveKV(locals));

  const haul = await getHaul(id);
  if (!haul) {
    return errorResponse(ApiErrorCode.NOT_FOUND, 'Haul not found or expired', request);
  }

  return successResponse({
    haul_id: haul.id,
    created_at: haul.createdAt,
    expires_at: haul.expiresAt,
    scrape_count: haul.scrapes.length,
    scrape_capacity: 20,
    scrapes: haul.scrapes,
  }, request);
};
