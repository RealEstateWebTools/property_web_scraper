import { errorResponse, ApiErrorCode } from './api-response.js';
import { logActivity } from './activity-logger.js';
import { constantTimeCompare } from './constant-time.js';

export const MAX_HTML_SIZE = 10_000_000; // 10 MB
export const MAX_URL_LENGTH = 2048;

/**
 * API key authentication.
 * Port of Ruby ApplicationController#authenticate_api_key!
 */
export function authenticateApiKey(request: Request): { authorized: boolean; errorResponse?: Response } {
  const expectedKey = import.meta.env.PWS_API_KEY || '';
  if (!expectedKey) {
    // No key configured = auth is skipped (backwards compatible)
    return { authorized: true };
  }

  const providedKey =
    request.headers.get('X-Api-Key') ||
    new URL(request.url).searchParams.get('api_key') ||
    '';

  if (!providedKey || !constantTimeCompare(providedKey, expectedKey)) {
    logActivity({
      level: 'warn',
      category: 'auth',
      message: `Auth failed: ${providedKey ? 'invalid key' : 'no key provided'}`,
      path: new URL(request.url).pathname,
      method: request.method,
      statusCode: 401,
      errorCode: ApiErrorCode.UNAUTHORIZED,
    });
    return {
      authorized: false,
      errorResponse: errorResponse(ApiErrorCode.UNAUTHORIZED, 'Unauthorized', request),
    };
  }

  return { authorized: true };
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
