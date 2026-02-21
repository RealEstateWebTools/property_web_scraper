/**
 * API request guard — consolidates auth + rate-limit boilerplate.
 *
 * Usage in endpoints:
 *   const guard = await apiGuard(request);
 *   if (!guard.ok) return guard.response;
 *   // guard.auth.userId, guard.auth.tier are available
 */

import { authenticateApiKey, type AuthResult } from './auth.js';
import { checkRateLimit, type EndpointClass } from './rate-limiter.js';

export interface GuardPass {
  ok: true;
  auth: AuthResult & { authorized: true };
}

export interface GuardFail {
  ok: false;
  response: Response;
}

export type GuardResult = GuardPass | GuardFail;

export async function apiGuard(
  request: Request,
  endpoint?: EndpointClass,
): Promise<GuardResult> {
  const auth = await authenticateApiKey(request);
  if (!auth.authorized) {
    return { ok: false, response: auth.errorResponse! };
  }

  const rateCheck = await checkRateLimit(request, auth.tier, auth.userId, endpoint);
  if (!rateCheck.allowed) {
    return { ok: false, response: rateCheck.errorResponse! };
  }

  return { ok: true, auth: auth as AuthResult & { authorized: true } };
}
