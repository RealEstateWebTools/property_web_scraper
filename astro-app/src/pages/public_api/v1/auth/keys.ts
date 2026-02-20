/**
 * /public_api/v1/auth/keys — API Key CRUD
 *
 * GET    — List all keys for the authenticated user
 * POST   — Generate a new API key
 * DELETE — Revoke a key (query param: prefix)
 */

import type { APIRoute } from 'astro';
import { authenticateApiKey } from '@lib/services/auth.js';
import { checkRateLimit } from '@lib/services/rate-limiter.js';
import {
  errorResponse, successResponse, corsPreflightResponse,
  ApiErrorCode,
} from '@lib/services/api-response.js';
import { logActivity } from '@lib/services/activity-logger.js';
import {
  generateApiKey,
  revokeApiKeyByPrefix,
  listUserKeys,
} from '@lib/services/api-key-service.js';

export const OPTIONS: APIRoute = ({ request }) => corsPreflightResponse(request);

/**
 * GET /public_api/v1/auth/keys — List keys for authenticated user.
 */
export const GET: APIRoute = async ({ request }) => {
  const auth = await authenticateApiKey(request);
  if (!auth.authorized) return auth.errorResponse!;

  const rateCheck = await checkRateLimit(request, auth.tier, auth.userId);
  if (!rateCheck.allowed) return rateCheck.errorResponse!;

  if (!auth.userId || auth.userId === 'anonymous') {
    return errorResponse(
      ApiErrorCode.UNAUTHORIZED,
      'Key management requires authentication',
      request,
    );
  }

  const keys = await listUserKeys(auth.userId);

  return successResponse({
    keys: keys.map(k => ({
      prefix: k.prefix,
      label: k.label,
      active: k.active,
      created_at: k.createdAt,
    })),
  }, request);
};

/**
 * POST /public_api/v1/auth/keys — Create a new API key.
 *
 * Body: { label?: string }
 * Response includes the raw key ONCE — it cannot be retrieved again.
 */
export const POST: APIRoute = async ({ request }) => {
  const startTime = Date.now();
  const path = '/public_api/v1/auth/keys';

  const auth = await authenticateApiKey(request);
  if (!auth.authorized) return auth.errorResponse!;

  const rateCheck = await checkRateLimit(request, auth.tier, auth.userId);
  if (!rateCheck.allowed) return rateCheck.errorResponse!;

  if (!auth.userId || auth.userId === 'anonymous') {
    return errorResponse(
      ApiErrorCode.UNAUTHORIZED,
      'Key creation requires authentication',
      request,
    );
  }

  let label = 'default';
  try {
    const body = await request.json();
    if (body.label && typeof body.label === 'string') {
      label = body.label.slice(0, 64); // Limit label length
    }
  } catch {
    // No body or invalid JSON — use default label
  }

  const { rawKey, prefix } = await generateApiKey(auth.userId, label);

  logActivity({
    level: 'info',
    category: 'api_key',
    message: `Key created: ${prefix}... for user ${auth.userId}`,
    method: 'POST',
    path,
    statusCode: 201,
    durationMs: Date.now() - startTime,
  });

  return successResponse({
    key: {
      raw_key: rawKey,
      prefix,
      label,
      note: 'Store this key securely — it will not be shown again.',
    },
  }, request, 201);
};

/**
 * DELETE /public_api/v1/auth/keys?prefix=pws_live_xxxx — Revoke a key.
 */
export const DELETE: APIRoute = async ({ request }) => {
  const startTime = Date.now();
  const path = '/public_api/v1/auth/keys';

  const auth = await authenticateApiKey(request);
  if (!auth.authorized) return auth.errorResponse!;

  if (!auth.userId || auth.userId === 'anonymous') {
    return errorResponse(
      ApiErrorCode.UNAUTHORIZED,
      'Key revocation requires authentication',
      request,
    );
  }

  const prefix = new URL(request.url).searchParams.get('prefix');
  if (!prefix) {
    return errorResponse(
      ApiErrorCode.INVALID_REQUEST,
      'Missing query parameter: prefix',
      request,
    );
  }

  const revoked = await revokeApiKeyByPrefix(auth.userId, prefix);

  if (!revoked) {
    return errorResponse(
      ApiErrorCode.NOT_FOUND,
      `No active key found with prefix: ${prefix}`,
      request,
    );
  }

  logActivity({
    level: 'info',
    category: 'api_key',
    message: `Key revoked: ${prefix}... for user ${auth.userId}`,
    method: 'DELETE',
    path,
    statusCode: 200,
    durationMs: Date.now() - startTime,
  });

  return successResponse({ revoked: true, prefix }, request);
};
