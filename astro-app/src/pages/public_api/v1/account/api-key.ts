/**
 * POST /public_api/v1/account/api-key
 *
 * Generates a pws_live_* API key for a verified Firebase user.
 *
 * Authorization: Bearer {Firebase ID token}
 *
 * The Firebase ID token must have email_verified == true.
 * Returns the raw key once — it cannot be retrieved again.
 */

import type { APIRoute } from 'astro';
import {
  errorResponse, successResponse, corsPreflightResponse,
  ApiErrorCode,
} from '@lib/services/api-response.js';
import { verifyFirebaseToken } from '@lib/services/firebase-auth-verifier.js';
import {
  getUser, createUser, generateApiKey,
} from '@lib/services/api-key-service.js';

export const OPTIONS: APIRoute = ({ request }) => corsPreflightResponse(request);

export const POST: APIRoute = async ({ request }) => {
  // Extract Bearer token
  const authHeader = request.headers.get('Authorization') || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!idToken) {
    return errorResponse(
      ApiErrorCode.UNAUTHORIZED,
      'Missing Authorization: Bearer <Firebase ID token>',
      request,
    );
  }

  // Resolve project ID from env
  const projectId = import.meta.env.FIRESTORE_PROJECT_ID || '';

  if (!projectId) {
    return errorResponse(
      ApiErrorCode.INVALID_REQUEST,
      'Server misconfiguration: FIRESTORE_PROJECT_ID not set',
      request,
    );
  }

  // Verify Firebase token
  let payload: Awaited<ReturnType<typeof verifyFirebaseToken>>;
  try {
    payload = await verifyFirebaseToken(idToken, projectId);
  } catch (err) {
    return errorResponse(
      ApiErrorCode.UNAUTHORIZED,
      err instanceof Error ? err.message : 'Invalid Firebase ID token',
      request,
    );
  }

  // Require email verification
  if (!payload.email_verified) {
    return errorResponse(
      ApiErrorCode.EMAIL_NOT_VERIFIED,
      'Email address must be verified before an API key can be issued. Check your inbox.',
      request,
    );
  }

  const uid = payload.uid;
  const email = payload.email;

  // Create user record if it does not exist yet
  const existing = await getUser(uid);
  if (!existing) {
    await createUser(uid, email);
  }

  // Generate a new API key — raw key shown once
  const { rawKey } = await generateApiKey(uid, 'default');

  return successResponse({ api_key: rawKey, tier: 'free' }, request, 201);
};
