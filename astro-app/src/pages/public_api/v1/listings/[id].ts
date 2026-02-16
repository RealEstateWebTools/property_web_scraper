import type { APIRoute } from 'astro';
import { authenticateApiKey } from '@lib/services/auth.js';
import { initKV, getListing } from '@lib/services/listing-store.js';
import { checkRateLimit } from '@lib/services/rate-limiter.js';
import { errorResponse, successResponse, corsPreflightResponse, ApiErrorCode } from '@lib/services/api-response.js';
import { logActivity } from '@lib/services/activity-logger.js';

export const OPTIONS: APIRoute = () => corsPreflightResponse();

export const GET: APIRoute = async ({ params, request, locals }) => {
  const startTime = Date.now();
  const path = `/public_api/v1/listings/${params.id}`;

  initKV((locals as any).runtime?.env?.RESULTS);

  const auth = authenticateApiKey(request);
  if (!auth.authorized) return auth.errorResponse!;

  const rateCheck = checkRateLimit(request);
  if (!rateCheck.allowed) return rateCheck.errorResponse!;

  const listing = params.id ? await getListing(params.id) : undefined;

  if (!listing) {
    logActivity({
      level: 'warn',
      category: 'api_request',
      message: `GET listing: not found (${params.id})`,
      method: 'GET',
      path,
      statusCode: 404,
      durationMs: Date.now() - startTime,
      errorCode: ApiErrorCode.LISTING_NOT_FOUND,
    });
    return errorResponse(ApiErrorCode.LISTING_NOT_FOUND, 'Listing not found');
  }

  logActivity({
    level: 'info',
    category: 'api_request',
    message: `GET listing: OK (${params.id})`,
    method: 'GET',
    path,
    statusCode: 200,
    durationMs: Date.now() - startTime,
  });

  return successResponse({ listing: listing.asJson() });
};
