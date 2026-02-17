/**
 * POST /public_api/v1/stripe-webhook
 *
 * Receives Stripe webhook events and processes subscription lifecycle changes.
 * Verifies webhook signature before processing.
 */

import type { APIRoute } from 'astro';
import { corsPreflightResponse } from '@lib/services/api-response.js';
import { logActivity } from '@lib/services/activity-logger.js';
import { verifyWebhookSignature, handleWebhookEvent } from '@lib/services/stripe-service.js';

export const OPTIONS: APIRoute = ({ request }) => corsPreflightResponse(request);

export const POST: APIRoute = async ({ request }) => {
  const startTime = Date.now();
  const path = '/public_api/v1/stripe-webhook';

  // Read raw body for signature verification
  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature') || '';

  // Verify webhook signature
  const isValid = await verifyWebhookSignature(rawBody, signature);
  if (!isValid) {
    logActivity({
      level: 'warn',
      category: 'stripe',
      message: 'Webhook signature verification failed',
      method: 'POST',
      path,
      statusCode: 400,
      durationMs: Date.now() - startTime,
    });
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Parse the event
  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Process the event
  const result = await handleWebhookEvent(event);

  logActivity({
    level: result.handled ? 'info' : 'debug',
    category: 'stripe',
    message: `Webhook ${event.type}: ${result.action || 'processed'}`,
    method: 'POST',
    path,
    statusCode: 200,
    durationMs: Date.now() - startTime,
  });

  return new Response(JSON.stringify({ received: true, ...result }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
