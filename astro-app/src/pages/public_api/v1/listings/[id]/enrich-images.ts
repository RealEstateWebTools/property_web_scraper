import type { APIRoute } from 'astro';
import { authenticateApiKey } from '@lib/services/auth.js';
import { initKV, getListing, storeListing } from '@lib/services/listing-store.js';
import { checkRateLimit } from '@lib/services/rate-limiter.js';
import { errorResponse, successResponse, corsPreflightResponse, ApiErrorCode } from '@lib/services/api-response.js';
import { enrichImages } from '@lib/services/image-enricher.js';

export const OPTIONS: APIRoute = ({ request }) => corsPreflightResponse(request);

export const POST: APIRoute = async ({ params, request, locals }) => {
  initKV((locals as any).runtime?.env?.RESULTS);

  const auth = await authenticateApiKey(request);
  if (!auth.authorized) return auth.errorResponse!;

  const rateCheck = checkRateLimit(request, auth.tier, auth.userId);
  if (!rateCheck.allowed) return rateCheck.errorResponse!;

  const listing = params.id ? await getListing(params.id) : undefined;
  if (!listing) {
    return errorResponse(ApiErrorCode.LISTING_NOT_FOUND, 'Listing not found', request);
  }

  const images = listing.image_urls || [];
  if (images.length === 0) {
    return successResponse({ image_urls: [] }, request);
  }

  const enriched = await enrichImages(images);
  listing.image_urls = enriched;
  await storeListing(params.id!, listing);

  return successResponse({ image_urls: enriched }, request);
};
