/**
 * POST /public_api/v1/signup — Self-service account creation.
 *
 * No auth required. Takes { email }, creates a user + API key,
 * returns the raw key once (it is never retrievable again).
 *
 * If the email already has an account, a new key is added to the
 * existing account — useful when the user has lost their key.
 */

import type { APIRoute } from 'astro';
import {
  errorResponse, successResponse, corsPreflightResponse,
  ApiErrorCode,
} from '@lib/services/api-response.js';
import {
  getUser, createUser, generateApiKey,
} from '@lib/services/api-key-service.js';

export const OPTIONS: APIRoute = ({ request }) => corsPreflightResponse(request);

async function emailToUserId(email: string): Promise<string> {
  const data = new TextEncoder().encode(email.toLowerCase().trim());
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 12);
}

export const POST: APIRoute = async ({ request }) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return errorResponse(ApiErrorCode.INVALID_REQUEST, 'Invalid JSON body', request);
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email || !email.includes('@') || !email.includes('.')) {
    return errorResponse(ApiErrorCode.INVALID_REQUEST, 'A valid email address is required', request);
  }

  const userId = await emailToUserId(email);

  // Create user if they don't already exist
  const existing = await getUser(userId);
  if (!existing) {
    await createUser(userId, email);
  }

  // Always generate a new key — raw key shown once
  const { rawKey } = await generateApiKey(userId, 'default');

  return successResponse({ api_key: rawKey, tier: 'free' }, request, 201);
};
