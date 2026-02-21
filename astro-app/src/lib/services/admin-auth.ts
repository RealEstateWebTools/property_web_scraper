import { constantTimeCompare } from './constant-time.js';

/**
 * Admin authentication.
 * Checks PWS_ADMIN_KEY from header, query param, or cookie.
 * Admin is disabled by default — if PWS_ADMIN_KEY is not set, all admin routes return unauthorized.
 */

export interface AdminAuthResult {
  authorized: boolean;
  errorMessage?: string;
}

function parseCookie(cookieHeader: string, name: string): string | null {
  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const [key, ...rest] = cookie.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

export function authenticateAdmin(request: Request): AdminAuthResult {
  let expectedKey: string;
  try {
    expectedKey = (import.meta as any).env?.PWS_ADMIN_KEY || '';
  } catch {
    expectedKey = '';
  }

  if (!expectedKey) {
    return { authorized: false, errorMessage: 'Admin access is not configured' };
  }

  const providedKey =
    request.headers.get('X-Admin-Key') ||
    parseCookie(request.headers.get('cookie') || '', 'pws_admin_key') ||
    '';

  if (!providedKey || !constantTimeCompare(providedKey, expectedKey)) {
    return { authorized: false, errorMessage: 'Invalid admin key' };
  }

  return { authorized: true };
}

/**
 * Validate a raw admin key string against the configured key.
 */
export function validateAdminKey(key: string): boolean {
  let expectedKey: string;
  try {
    expectedKey = (import.meta as any).env?.PWS_ADMIN_KEY || '';
  } catch {
    expectedKey = '';
  }
  return !!expectedKey && constantTimeCompare(key, expectedKey);
}

/**
 * Build a Set-Cookie header for the admin session.
 */
export function buildAdminCookie(key: string): string {
  return `pws_admin_key=${key}; HttpOnly; SameSite=Strict; Path=/admin; Max-Age=86400`;
}

/**
 * Build a Set-Cookie header that clears the admin session.
 */
export function clearAdminCookie(): string {
  return `pws_admin_key=; HttpOnly; SameSite=Strict; Path=/admin; Max-Age=0`;
}
