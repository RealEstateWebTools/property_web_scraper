import type { APIRoute } from 'astro';
import { authenticateApiKey } from '@lib/services/auth.js';
import { getListing } from '@lib/services/listing-store.js';
import { errorResponse, successResponse, ApiErrorCode } from '@lib/services/api-response.js';

export const GET: APIRoute = async ({ params, request }) => {
  const auth = authenticateApiKey(request);
  if (!auth.authorized) return auth.errorResponse!;

  const listing = params.id ? getListing(params.id) : undefined;

  if (!listing) {
    return errorResponse(ApiErrorCode.LISTING_NOT_FOUND, 'Listing not found');
  }

  return successResponse({ listing: listing.asJson() });
};
