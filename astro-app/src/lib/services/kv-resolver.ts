/**
 * Centralizes KV resolution for ext API routes.
 * Returns the Cloudflare KV binding when available, falls back to
 * file-backed DevKV when DEV_KV_PERSIST is set, or null otherwise.
 */

import { getDevKV } from './dev-kv.js';

export function resolveKV(locals: unknown): any {
  const runtime = (locals as any)?.runtime?.env?.RESULTS;
  if (runtime) return runtime;
  return getDevKV();
}
