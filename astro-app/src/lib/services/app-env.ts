/**
 * Single source of truth for environment detection.
 *
 * Priority order:
 * 1. APP_ENV env var (explicit override: 'development' | 'test' | 'production')
 * 2. VITEST env var set by vitest runner → 'test'
 * 3. Derived from FIRESTORE_COLLECTION_PREFIX: contains 'demo' or 'dev' → 'development'
 * 4. Default → 'production'
 *
 * Works in both Astro SSR context (import.meta.env) and plain Node scripts (process.env).
 */

export type AppEnv = 'development' | 'test' | 'production';

function readEnvVar(key: string): string | undefined {
  // Try import.meta.env first (Astro SSR context)
  try {
    // @ts-ignore — import.meta.env may not be typed in all contexts
    const val = import.meta.env?.[key];
    if (val !== undefined && val !== '') return val;
  } catch { /* not in Astro context */ }

  // Fall back to process.env (Node scripts, vitest)
  return process.env[key];
}

export function getAppEnv(): AppEnv {
  // 1. Explicit override
  const explicit = readEnvVar('APP_ENV');
  if (explicit === 'development' || explicit === 'test' || explicit === 'production') {
    return explicit;
  }

  // 2. Vitest runner
  if (process.env.VITEST) {
    return 'test';
  }

  // 3. Derive from collection prefix
  const prefix = (readEnvVar('FIRESTORE_COLLECTION_PREFIX') || '').toLowerCase();
  if (prefix.includes('dev') || prefix.includes('demo')) {
    return 'development';
  }

  // 4. Default
  return 'production';
}
