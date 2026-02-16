import { errorResponse, ApiErrorCode } from './api-response.js';
import { logActivity } from './activity-logger.js';

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

  if (!providedKey || providedKey !== expectedKey) {
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
      errorResponse: errorResponse(ApiErrorCode.UNAUTHORIZED, 'Unauthorized'),
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
      return await htmlFile.text();
    }
    const html = formData.get('html');
    if (html && typeof html === 'string') {
      return html;
    }
    return null;
  }

  if (contentType.includes('application/json')) {
    const body = await request.json();
    return body.html || null;
  }

  // URL-encoded or query params
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const body = await request.text();
    const params = new URLSearchParams(body);
    return params.get('html') || null;
  }

  return null;
}
