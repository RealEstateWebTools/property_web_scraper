/**
 * GET /public_api/v1/usage
 *
 * Returns usage statistics for the authenticated user.
 * Includes today's count, monthly total, daily breakdown, and quota info.
 */

import type { APIRoute } from 'astro';
import { apiGuard } from '@lib/services/api-guard.js';
import {
  errorResponse, successResponse, corsPreflightResponse,
  ApiErrorCode,
} from '@lib/services/api-response.js';
import { getUsageSummary } from '@lib/services/usage-meter.js';
import type { SubscriptionTier } from '@lib/services/api-key-service.js';

export const OPTIONS: APIRoute = ({ request }) => corsPreflightResponse(request);

export const GET: APIRoute = async ({ request }) => {
  const guard = await apiGuard(request);
  if (!guard.ok) return guard.response;
  const { auth } = guard;

  if (!auth.userId || auth.userId === 'anonymous') {
    return errorResponse(
      ApiErrorCode.UNAUTHORIZED,
      'Usage data requires authentication with a personal API key',
      request,
    );
  }

  const summary = await getUsageSummary(auth.userId, (auth.tier || 'free') as SubscriptionTier);

  return successResponse({
    usage: summary,
  }, request);
};
