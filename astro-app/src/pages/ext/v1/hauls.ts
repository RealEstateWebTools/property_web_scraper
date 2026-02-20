import type { APIRoute } from 'astro';
import { generateHaulId } from '@lib/services/haul-id.js';
import { createHaul } from '@lib/services/haul-store.js';
import { resolveKV } from '@lib/services/kv-resolver.js';
import { errorResponse, successResponse, corsPreflightResponse, ApiErrorCode } from '@lib/services/api-response.js';

// KV-backed rate limit for haul creation: 5 per hour per IP.
// Falls back to in-memory if KV unavailable.
const MAX_CREATES_PER_HOUR = 5;
const RATE_LIMIT_WINDOW_S = 3600;
const inMemoryTimestamps = new Map<string, number[]>();

async function isRateLimited(ip: string, kv: any): Promise<boolean> {
  const kvKey = `haul-rate:${ip}`;
  const now = Date.now();

  // Try KV first (cross-isolate)
  if (kv) {
    try {
      const data = await kv.get(kvKey, 'json') as { count: number } | null;
      const count = data?.count ?? 0;
      if (count >= MAX_CREATES_PER_HOUR) return true;
      await kv.put(kvKey, JSON.stringify({ count: count + 1 }), { expirationTtl: RATE_LIMIT_WINDOW_S });
      return false;
    } catch {
      // KV failure — fall through to in-memory
    }
  }

  // In-memory fallback (per-isolate, best effort)
  const cutoff = now - RATE_LIMIT_WINDOW_S * 1000;
  const timestamps = (inMemoryTimestamps.get(ip) || []).filter(t => t > cutoff);
  inMemoryTimestamps.set(ip, timestamps);
  if (timestamps.length >= MAX_CREATES_PER_HOUR) return true;
  timestamps.push(now);
  return false;
}

export const OPTIONS: APIRoute = ({ request }) => corsPreflightResponse(request);

/**
 * POST /ext/v1/hauls — Create a new haul. No auth required.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  const ip = request.headers.get('cf-connecting-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';

  const kvBinding = resolveKV(locals);

  if (await isRateLimited(ip, kvBinding)) {
    return errorResponse(ApiErrorCode.RATE_LIMITED, 'Too many hauls created. Try again later.', request);
  }

  const id = generateHaulId();
  const haul = await createHaul(id, ip);

  return successResponse({
    haul_id: haul.id,
    haul_url: `/haul/${haul.id}`,
  }, request, 201);
};
