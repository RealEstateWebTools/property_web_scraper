/**
 * GET /public_api/v1/listings/history?url=...
 *
 * Returns historical price snapshots for a listing URL.
 * Query params:
 *   url          — listing URL (required)
 *   limit        — max snapshots to return (optional, default all)
 *   changes_only — if "true", return only price-change events
 */

import type { APIRoute } from 'astro';
import { authenticateApiKey } from '@lib/services/auth.js';
import { checkRateLimit } from '@lib/services/rate-limiter.js';
import {
  errorResponse, successResponse, corsPreflightResponse,
  ApiErrorCode,
} from '@lib/services/api-response.js';
import { getHistory, getPriceChanges } from '@lib/services/price-history.js';

export const OPTIONS: APIRoute = ({ request }) => corsPreflightResponse(request);

export const GET: APIRoute = async ({ request }) => {
  const auth = await authenticateApiKey(request);
  if (!auth.authorized) return auth.errorResponse!;

  const rateCheck = await checkRateLimit(request, auth.tier, auth.userId);
  if (!rateCheck.allowed) return rateCheck.errorResponse!;

  const params = new URL(request.url).searchParams;
  const url = params.get('url');

  if (!url) {
    return errorResponse(
      ApiErrorCode.MISSING_URL,
      'Missing required query parameter: url',
      request,
    );
  }

  const changesOnly = params.get('changes_only') === 'true';
  const limitStr = params.get('limit');
  const limit = limitStr ? parseInt(limitStr, 10) : undefined;

  if (changesOnly) {
    const changes = await getPriceChanges(url);
    return successResponse({
      url,
      change_count: changes.length,
      changes,
    }, request);
  }

  const history = await getHistory(url, limit);
  return successResponse(history, request);
};
