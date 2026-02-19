import type { APIRoute } from 'astro';
import { generateHaulId } from '@lib/services/haul-id.js';
import { createHaul, initHaulKV } from '@lib/services/haul-store.js';
import { resolveKV } from '@lib/services/kv-resolver.js';
import { errorResponse, successResponse, corsPreflightResponse, ApiErrorCode } from '@lib/services/api-response.js';

// Simple sliding-window rate limit for haul creation: 5 per hour per IP
const ipTimestamps = new Map<string, number[]>();
const MAX_CREATES_PER_HOUR = 5;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const cutoff = now - 60 * 60 * 1000;
  const timestamps = (ipTimestamps.get(ip) || []).filter(t => t > cutoff);
  ipTimestamps.set(ip, timestamps);
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

  if (isRateLimited(ip)) {
    return errorResponse(ApiErrorCode.RATE_LIMITED, 'Too many hauls created. Try again later.', request);
  }

  initHaulKV(resolveKV(locals));

  const id = generateHaulId();
  const haul = await createHaul(id, ip);

  return successResponse({
    haul_id: haul.id,
    haul_url: `/haul/${haul.id}`,
  }, request, 201);
};
