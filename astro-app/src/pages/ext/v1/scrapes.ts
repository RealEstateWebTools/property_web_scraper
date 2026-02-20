import type { APIRoute } from 'astro';
import { generateHaulId, isValidHaulId } from '@lib/services/haul-id.js';
import { createHaul, getHaul } from '@lib/services/haul-store.js';
import { resolveKV } from '@lib/services/kv-resolver.js';
import { authenticateApiKey } from '@lib/services/auth.js';
import { handleScrapeRequest, parseScrapeBody } from '@lib/services/scrape-handler.js';
import {
  errorResponse, corsPreflightResponse,
  ApiErrorCode,
} from '@lib/services/api-response.js';

const FREE_HAUL_TTL_S = 30 * 24 * 60 * 60; // 30 days

export const OPTIONS: APIRoute = ({ request }) => corsPreflightResponse(request);

/**
 * POST /ext/v1/scrapes — Add a scrape, auto-creating or reusing a haul.
 *
 * Body: { url, html, haul_id? }
 *
 * Haul resolution:
 *   - haul_id provided and haul exists → use it
 *   - haul_id provided but expired/missing → create new
 *   - Anonymous, no haul_id: check free-haul:{ip} KV key → reuse or create
 *   - Authenticated, no haul_id: create a new haul
 *   - Local dev (no KV): create freely
 *
 * Always includes haul_id in response so the client can store it.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  // Parse body
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return errorResponse(ApiErrorCode.UNSUPPORTED_CONTENT_TYPE, 'Content-Type must be application/json', request);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return errorResponse(ApiErrorCode.INVALID_REQUEST, 'Invalid JSON body', request);
  }

  const parsed = parseScrapeBody(body, request);
  if (parsed instanceof Response) return parsed;

  const providedHaulId: string | undefined = body.haul_id;

  // Resolve haul
  const haulId = await resolveHaul(providedHaulId, request, locals);
  if (haulId instanceof Response) return haulId;

  return handleScrapeRequest(haulId, parsed, request);
};

/**
 * Resolve a haul ID: reuse existing, or auto-create a new one.
 * Returns the haul ID string, or an error Response.
 */
async function resolveHaul(
  providedHaulId: string | undefined,
  request: Request,
  locals: any,
): Promise<string | Response> {
  const ip = request.headers.get('cf-connecting-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';

  // If a haul_id was provided, try to use it
  if (providedHaulId) {
    if (!isValidHaulId(providedHaulId)) {
      // Invalid format — create a new one instead
      return createNewHaul(ip, request, locals);
    }
    const haul = await getHaul(providedHaulId);
    if (haul) {
      if (haul.scrapes.length >= 20) {
        return errorResponse(ApiErrorCode.INVALID_REQUEST, 'Haul is full (20/20 scrapes)', request);
      }
      return providedHaulId;
    }
    // Haul expired or missing — create new
    return createNewHaul(ip, request, locals);
  }

  // No haul_id provided — auto-resolve
  const kv = resolveKV(locals);
  const auth = await authenticateApiKey(request);
  const isAuthenticated = auth.authorized && auth.userId !== 'anonymous';

  if (!isAuthenticated && kv) {
    // Anonymous with KV: reuse existing free haul or create one
    const freeHaulKey = `free-haul:${ip}`;
    const existing = await kv.get(freeHaulKey, 'json') as { haulId: string } | null;
    if (existing) {
      const haul = await getHaul(existing.haulId);
      if (haul) {
        if (haul.scrapes.length >= 20) {
          return errorResponse(ApiErrorCode.INVALID_REQUEST, 'Haul is full (20/20 scrapes). Sign up for a free account to create more hauls.', request);
        }
        return existing.haulId;
      }
      // KV entry exists but haul is gone — fall through to create
    }

    const id = generateHaulId();
    await createHaul(id, ip);
    await kv.put(freeHaulKey, JSON.stringify({ haulId: id, createdAt: new Date().toISOString() }), {
      expirationTtl: FREE_HAUL_TTL_S,
    });
    return id;
  }

  // Authenticated or no KV (local dev) — create freely
  return createNewHaul(ip, request, locals);
}

async function createNewHaul(
  ip: string,
  _request: Request,
  _locals: any,
): Promise<string> {
  const id = generateHaulId();
  await createHaul(id, ip);
  return id;
}
