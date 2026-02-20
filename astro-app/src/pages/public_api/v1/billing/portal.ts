/**
 * POST /public_api/v1/billing/portal
 *
 * Creates a Stripe Customer Portal session for managing billing.
 * Body: { return_url: string }
 */

import type { APIRoute } from 'astro';
import { authenticateApiKey } from '@lib/services/auth.js';
import { checkRateLimit } from '@lib/services/rate-limiter.js';
import {
  errorResponse, successResponse, corsPreflightResponse,
  ApiErrorCode,
} from '@lib/services/api-response.js';
import { createPortalSession } from '@lib/services/stripe-service.js';

export const OPTIONS: APIRoute = ({ request }) => corsPreflightResponse(request);

export const POST: APIRoute = async ({ request }) => {
  const auth = await authenticateApiKey(request);
  if (!auth.authorized) return auth.errorResponse!;

  const rateCheck = await checkRateLimit(request, auth.tier, auth.userId);
  if (!rateCheck.allowed) return rateCheck.errorResponse!;

  if (!auth.userId || auth.userId === 'anonymous') {
    return errorResponse(
      ApiErrorCode.UNAUTHORIZED,
      'Portal access requires authentication with a personal API key',
      request,
    );
  }

  let body: { return_url?: string };
  try {
    body = await request.json();
  } catch {
    return errorResponse(ApiErrorCode.INVALID_REQUEST, 'Invalid JSON body', request);
  }

  const { return_url } = body;
  if (!return_url) {
    return errorResponse(ApiErrorCode.INVALID_REQUEST, 'Missing return_url', request);
  }

  try {
    const session = await createPortalSession(auth.userId, return_url);
    return successResponse({ portal: session }, request);
  } catch (err) {
    return errorResponse(
      ApiErrorCode.INTERNAL_ERROR,
      err instanceof Error ? err.message : 'Portal session creation failed',
      request,
    );
  }
};
