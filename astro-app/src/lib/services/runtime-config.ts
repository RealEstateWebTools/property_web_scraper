/**
 * Mutable in-memory runtime config.
 * Overrides env var defaults. Lost on worker restart (acceptable).
 */

export interface RuntimeConfig {
  maxRequests: number;
}

const DEFAULT_MAX_REQUESTS = 60;

let overrides: Partial<RuntimeConfig> = {};

function getEnvMaxRequests(): number {
  try {
    const env = (import.meta as any).env?.PWS_RATE_LIMIT;
    if (env) return parseInt(env, 10) || DEFAULT_MAX_REQUESTS;
  } catch { /* ignore */ }
  return DEFAULT_MAX_REQUESTS;
}

export function getRuntimeConfig(): RuntimeConfig {
  return {
    maxRequests: overrides.maxRequests ?? getEnvMaxRequests(),
  };
}

export function updateRuntimeConfig(updates: Partial<RuntimeConfig>): void {
  if (updates.maxRequests !== undefined) {
    const val = updates.maxRequests;
    if (typeof val !== 'number' || val < 1 || val > 1000) {
      throw new Error('maxRequests must be between 1 and 1000');
    }
    overrides.maxRequests = val;
  }
}

export function resetRuntimeConfig(): void {
  overrides = {};
}
