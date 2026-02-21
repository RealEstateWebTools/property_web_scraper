/**
 * Webhooks API — /public_api/v1/webhooks
 *
 * POST — Register a webhook
 * GET  — List registered webhooks
 * DELETE — Unregister a webhook
 */

import type { APIRoute } from 'astro';
import { apiGuard } from '@lib/services/api-guard.js';
import {
  errorResponse, successResponse, corsPreflightResponse,
  ApiErrorCode,
} from '@lib/services/api-response.js';
import { logActivity } from '@lib/services/activity-logger.js';
import {
  registerWebhook,
  removeWebhook,
  listWebhooks,
  type WebhookEvent,
} from '@lib/services/webhook-service.js';

const VALID_EVENTS: WebhookEvent[] = ['extraction.completed', 'extraction.failed'];

export const OPTIONS: APIRoute = ({ request }) => corsPreflightResponse(request);

/**
 * POST /public_api/v1/webhooks — Register a new webhook.
 *
 * Body: { url: string, events: string[], secret?: string }
 */
export const POST: APIRoute = async ({ request }) => {
  const startTime = Date.now();
  const path = '/public_api/v1/webhooks';

  const guard = await apiGuard(request);
  if (!guard.ok) return guard.response;

  let body: { url?: string; events?: string[]; secret?: string };
  try {
    body = await request.json();
  } catch {
    return errorResponse(ApiErrorCode.INVALID_REQUEST, 'Invalid JSON body', request);
  }

  const { url, events, secret } = body;

  if (!url) {
    return errorResponse(ApiErrorCode.INVALID_REQUEST, 'Missing required field: url', request);
  }

  // Validate URL format
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return errorResponse(ApiErrorCode.INVALID_URL, 'Webhook URL must use HTTP or HTTPS', request);
    }
  } catch {
    return errorResponse(ApiErrorCode.INVALID_URL, 'Invalid webhook URL', request);
  }

  // Validate events
  if (!events || !Array.isArray(events) || events.length === 0) {
    return errorResponse(
      ApiErrorCode.INVALID_REQUEST,
      `Missing or empty events array. Valid events: ${VALID_EVENTS.join(', ')}`,
      request,
    );
  }

  const invalidEvents = events.filter(e => !VALID_EVENTS.includes(e as WebhookEvent));
  if (invalidEvents.length > 0) {
    return errorResponse(
      ApiErrorCode.INVALID_REQUEST,
      `Invalid events: ${invalidEvents.join(', ')}. Valid: ${VALID_EVENTS.join(', ')}`,
      request,
    );
  }

  const registration = await registerWebhook(url, events as WebhookEvent[], secret);

  logActivity({
    level: 'info',
    category: 'webhook',
    message: `Webhook registered: ${registration.id} → ${url}`,
    method: 'POST',
    path,
    statusCode: 201,
    durationMs: Date.now() - startTime,
  });

  // Don't expose the secret in the response
  const { secret: _secret, ...safeRegistration } = registration;

  return successResponse({
    webhook: { ...safeRegistration, has_secret: !!secret },
  }, request, 201);
};

/**
 * GET /public_api/v1/webhooks — List registered webhooks.
 */
export const GET: APIRoute = async ({ request }) => {
  const guard = await apiGuard(request);
  if (!guard.ok) return guard.response;

  const webhooks = await listWebhooks();

  // Strip secrets from response
  const safeWebhooks = webhooks.map(({ secret, ...rest }) => ({
    ...rest,
    has_secret: !!secret,
  }));

  return successResponse({ webhooks: safeWebhooks }, request);
};

/**
 * DELETE /public_api/v1/webhooks?id=... — Remove a webhook.
 */
export const DELETE: APIRoute = async ({ request }) => {
  const startTime = Date.now();
  const path = '/public_api/v1/webhooks';

  const guard = await apiGuard(request);
  if (!guard.ok) return guard.response;

  const id = new URL(request.url).searchParams.get('id');
  if (!id) {
    return errorResponse(ApiErrorCode.INVALID_REQUEST, 'Missing query parameter: id', request);
  }

  const removed = await removeWebhook(id);

  if (!removed) {
    return errorResponse(ApiErrorCode.NOT_FOUND, `Webhook not found: ${id}`, request);
  }

  logActivity({
    level: 'info',
    category: 'webhook',
    message: `Webhook removed: ${id}`,
    method: 'DELETE',
    path,
    statusCode: 200,
    durationMs: Date.now() - startTime,
  });

  return successResponse({ removed: true, id }, request);
};
