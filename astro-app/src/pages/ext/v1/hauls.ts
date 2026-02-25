import type { APIRoute } from 'astro';
import { generateHaulId } from '@lib/services/haul-id.js';
import { createHaul } from '@lib/services/haul-store.js';
import { resolveKV } from '@lib/services/kv-resolver.js';
import { authenticateApiKey } from '@lib/services/auth.js';
import { isAuthenticatedUser, userIdFromAuth } from '@lib/services/haul-access.js';
import { errorResponse, successResponse, corsPreflightResponse, ApiErrorCode } from '@lib/services/api-response.js';

const FREE_HAUL_TTL_S = 30 * 24 * 60 * 60; // 30 days

export const OPTIONS: APIRoute = ({ request }) => corsPreflightResponse(request);

/**
 * POST /ext/v1/hauls — Create a new haul.
 *
 * Anonymous users: limited to one haul per IP (tracked via free-haul:{ip} KV key).
 * Authenticated users (valid X-Api-Key): unlimited hauls.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  const ip = request.headers.get('cf-connecting-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';

  const kv = resolveKV(locals);

  // Determine whether request is authenticated
  const auth = await authenticateApiKey(request);
  const isAuthenticated = isAuthenticatedUser(auth);
  const requesterUserId = userIdFromAuth(auth);

  if (!isAuthenticated) {
    // Anonymous: enforce one free haul per IP
    if (kv) {
      const freeHaulKey = `free-haul:${ip}`;
      const existing = await kv.get(freeHaulKey, 'json') as { haulId: string } | null;
      if (existing) {
        return errorResponse(
          ApiErrorCode.HAUL_LIMIT_REACHED,
          'Sign up for a free account to create more hauls.',
          request,
        );
      }

      const id = generateHaulId();
      const haul = await createHaul(id, ip, { visibility: 'public' });
      await kv.put(freeHaulKey, JSON.stringify({ haulId: id, createdAt: new Date().toISOString() }), {
        expirationTtl: FREE_HAUL_TTL_S,
      });

      return successResponse({
        haul_id: haul.id,
        haul_url: `/haul/${haul.id}`,
        visibility: 'public',
      }, request, 201);
    }

    // KV unavailable (local dev) — allow without gate
    const id = generateHaulId();
    const haul = await createHaul(id, ip, { visibility: 'public' });
    return successResponse({
      haul_id: haul.id,
      haul_url: `/haul/${haul.id}`,
      visibility: 'public',
    }, request, 201);
  }

  // Authenticated — create freely
  const id = generateHaulId();
  const haul = await createHaul(id, ip, {
    visibility: 'private',
    ownerUserId: requesterUserId,
  });
  return successResponse({
    haul_id: haul.id,
    haul_url: `/haul/${haul.id}`,
    visibility: 'private',
  }, request, 201);
};
