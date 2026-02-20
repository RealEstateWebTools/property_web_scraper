/**
 * Haul resolution for website extract pages.
 * Reads/writes a `pws_haul_id` cookie to persist the active haul across
 * extractions made through the website (as opposed to the Chrome extension).
 */

import { generateHaulId } from './haul-id.js';
import { createHaul, getHaul } from './haul-store.js';

const COOKIE_NAME = 'pws_haul_id';
const THIRTY_DAYS_S = 30 * 24 * 60 * 60;
const MAX_SCRAPES = 20;

/**
 * Resolve a haul ID for a website extraction.
 * Reuses the haul from the cookie if it exists and is valid/non-full,
 * otherwise creates a new one.
 */
export async function resolveWebHaul(request: Request): Promise<string> {
  const ip =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown';

  const cookieHaulId = parseCookie(request.headers.get('cookie') || '', COOKIE_NAME);

  if (cookieHaulId) {
    const haul = await getHaul(cookieHaulId);
    if (haul && haul.scrapes.length < MAX_SCRAPES) {
      return cookieHaulId;
    }
  }

  // Cookie missing, haul expired, or haul full — create new
  const id = generateHaulId();
  await createHaul(id, ip);
  return id;
}

/**
 * Build a `Set-Cookie` header value for the haul cookie.
 */
export function setHaulCookie(haulId: string): string {
  return `${COOKIE_NAME}=${haulId}; Path=/; Max-Age=${THIRTY_DAYS_S}; SameSite=Lax`;
}

/** Parse a single cookie value by name from a Cookie header string. */
function parseCookie(cookieHeader: string, name: string): string | undefined {
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}
