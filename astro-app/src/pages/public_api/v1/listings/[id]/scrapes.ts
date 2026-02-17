import type { APIRoute } from 'astro';
import { authenticateApiKey } from '@lib/services/auth.js';
import { checkRateLimit } from '@lib/services/rate-limiter.js';
import { errorResponse, successResponse, corsPreflightResponse, ApiErrorCode } from '@lib/services/api-response.js';
import { logActivity } from '@lib/services/activity-logger.js';
import { initScrapeMetadataKV, getScrapeHistoryForListing } from '@lib/services/scrape-metadata.js';

export const OPTIONS: APIRoute = ({ request }) => corsPreflightResponse(request);

export const GET: APIRoute = async ({ params, request, locals }) => {
  const startTime = Date.now();
  const path = `/public_api/v1/listings/${params.id}/scrapes`;

  const auth = await authenticateApiKey(request);
  if (!auth.authorized) return auth.errorResponse!;

  const rateCheck = checkRateLimit(request, auth.tier, auth.userId);
  if (!rateCheck.allowed) return rateCheck.errorResponse!;

  const id = params.id;
  if (!id) {
    logActivity({
      level: 'warn',
      category: 'api_request',
      message: 'GET scrapes: missing listing ID',
      method: 'GET',
      path,
      statusCode: 400,
      durationMs: Date.now() - startTime,
      errorCode: ApiErrorCode.MISSING_URL,
    });
    return errorResponse(ApiErrorCode.MISSING_URL, 'Missing listing ID', request);
  }

  initScrapeMetadataKV((locals as any).runtime?.env?.RESULTS);

  const url = new URL(request.url);
  const limitParam = url.searchParams.get('limit');
  const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 10, 1), 50) : 10;

  const scrapes = await getScrapeHistoryForListing(id, limit);

  logActivity({
    level: 'info',
    category: 'api_request',
    message: `GET scrapes: OK (${scrapes.length} records)`,
    method: 'GET',
    path,
    statusCode: 200,
    durationMs: Date.now() - startTime,
  });

  return successResponse({ scrapes }, request);
};
