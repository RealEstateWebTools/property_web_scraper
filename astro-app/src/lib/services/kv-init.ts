/**
 * Centralized KV initialization for services that genuinely need KV.
 * Only rate-limiter and api-key-service use KV (hot-path operations
 * where Firestore latency would be unacceptable).
 * All other services have been migrated to Firestore.
 */

import { resolveKV } from './kv-resolver.js';
import { initUsersKV } from './api-key-service.js';
import { initRateLimiterKV } from './rate-limiter.js';

export function initAllKV(locals: unknown): void {
  const binding = resolveKV(locals);
  initUsersKV(binding);
  initRateLimiterKV(binding);
}
