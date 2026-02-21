/**
 * Centralizes KV resolution for ext API routes.
 * Returns the Cloudflare KV binding when available, falls back to
 * file-backed DevKV when DEV_KV_PERSIST is set, or null otherwise.
 */

import { getDevKV } from './dev-kv.js';
import type { KVNamespace } from './kv-types.js';

export function resolveKV(locals: unknown): KVNamespace | null {
  const runtime = (locals as Record<string, any>)?.runtime?.env?.RESULTS;
  if (runtime) return runtime as KVNamespace;
  return getDevKV();
}
