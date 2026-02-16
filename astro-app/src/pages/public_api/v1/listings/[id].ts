import type { APIRoute } from 'astro';
import { authenticateApiKey } from '@lib/services/auth.js';
import { initKV, getListing } from '@lib/services/listing-store.js';
import { checkRateLimit } from '@lib/services/rate-limiter.js';
import { errorResponse, successResponse, corsPreflightResponse, ApiErrorCode } from '@lib/services/api-response.js';

export const OPTIONS: APIRoute = () => corsPreflightResponse();

export const GET: APIRoute = async ({ params, request, locals }) => {
  initKV((locals as any).runtime?.env?.RESULTS);

  const auth = authenticateApiKey(request);
  if (!auth.authorized) return auth.errorResponse!;

  const rateCheck = checkRateLimit(request);
  if (!rateCheck.allowed) return rateCheck.errorResponse!;

  const listing = params.id ? await getListing(params.id) : undefined;

  if (!listing) {
    return errorResponse(ApiErrorCode.LISTING_NOT_FOUND, 'Listing not found');
  }

  return successResponse({ listing: listing.asJson() });
};
