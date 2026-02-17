import { errorResponse, ApiErrorCode } from './api-response.js';
import { logActivity } from './activity-logger.js';
import { constantTimeCompare } from './constant-time.js';
import { validateApiKey } from './api-key-service.js';
import type { SubscriptionTier } from './api-key-service.js';

export const MAX_HTML_SIZE = 10_000_000; // 10 MB
export const MAX_URL_LENGTH = 2048;

export interface AuthResult {
  authorized: boolean;
  userId?: string;
  tier?: SubscriptionTier;
  errorResponse?: Response;
}

/**
 * API key authentication.
 *
 * Authentication priority:
 * 1. Master key (`PWS_API_KEY` env var) → enterprise tier, userId="master"
 * 2. Per-user key (`pws_live_...`) → validated via api-key-service (KV lookup)
 * 3. No key when none configured → auth skipped (backwards compatible dev mode)
 */
export async function authenticateApiKey(request: Request): Promise<AuthResult> {
  const masterKey = import.meta.env.PWS_API_KEY || '';

  const providedKey =
    request.headers.get('X-Api-Key') ||
    new URL(request.url).searchParams.get('api_key') ||
    '';

  // No key provided
  if (!providedKey) {
    if (!masterKey) {
      // No master key configured = auth skipped (dev mode)
      return { authorized: true, userId: 'anonymous', tier: 'free' };
    }
    logAuthFailure('no key provided', request);
    return { authorized: false, errorResponse: errorResponse(ApiErrorCode.UNAUTHORIZED, 'Unauthorized', request) };
  }

  // Check master key first (constant-time comparison)
  if (masterKey && constantTimeCompare(providedKey, masterKey)) {
    return { authorized: true, userId: 'master', tier: 'enterprise' };
  }

  // Check per-user key via api-key-service
  if (providedKey.startsWith('pws_live_')) {
    const keyInfo = await validateApiKey(providedKey);
    if (keyInfo) {
      return { authorized: true, userId: keyInfo.userId, tier: keyInfo.tier };
    }
  }

  // Key provided but doesn't match anything
  logAuthFailure('invalid key', request);
  return { authorized: false, errorResponse: errorResponse(ApiErrorCode.UNAUTHORIZED, 'Unauthorized', request) };
}

function logAuthFailure(reason: string, request: Request): void {
  logActivity({
    level: 'warn',
    category: 'auth',
    message: `Auth failed: ${reason}`,
    path: new URL(request.url).pathname,
    method: request.method,
    statusCode: 401,
    errorCode: ApiErrorCode.UNAUTHORIZED,
  });
}

/**
 * Extract HTML input from request.
 * Port of Ruby ApplicationController#extract_html_input.
 */
export async function extractHtmlInput(request: Request): Promise<string | null> {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const htmlFile = formData.get('html_file');
    if (htmlFile && htmlFile instanceof File) {
      if (htmlFile.size > MAX_HTML_SIZE) {
        throw new Error(`HTML payload exceeds ${MAX_HTML_SIZE / 1_000_000}MB limit`);
      }
      const html = await htmlFile.text();
      if (html.length > MAX_HTML_SIZE) {
        throw new Error(`HTML payload exceeds ${MAX_HTML_SIZE / 1_000_000}MB limit`);
      }
      return html;
    }
    const html = formData.get('html');
    if (html && typeof html === 'string') {
      if (html.length > MAX_HTML_SIZE) {
        throw new Error(`HTML payload exceeds ${MAX_HTML_SIZE / 1_000_000}MB limit`);
      }
      return html;
    }
    return null;
  }

  if (contentType.includes('application/json')) {
    const body = await request.json();
    const html = body.html;
    if (typeof html === 'string') {
      if (html.length > MAX_HTML_SIZE) {
        throw new Error(`HTML payload exceeds ${MAX_HTML_SIZE / 1_000_000}MB limit`);
      }
      return html;
    }
    return null;
  }

  // URL-encoded or query params
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const body = await request.text();
    const params = new URLSearchParams(body);
    const html = params.get('html');
    if (html && html.length > MAX_HTML_SIZE) {
      throw new Error(`HTML payload exceeds ${MAX_HTML_SIZE / 1_000_000}MB limit`);
    }
    return html || null;
  }

  return null;
}

export function validateUrlLength(url: string): void {
  if (url.length > MAX_URL_LENGTH) {
    throw new Error(`URL exceeds ${MAX_URL_LENGTH} characters`);
  }
}
