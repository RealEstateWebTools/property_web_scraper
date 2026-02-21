import { errorResponse, ApiErrorCode } from './api-response.js';
import { getRuntimeConfig } from './runtime-config.js';
import { logActivity } from './activity-logger.js';
import type { SubscriptionTier } from './api-key-service.js';
import type { KVNamespace } from './kv-types.js';

// ─── Endpoint classes & multipliers ─────────────────────────────

export type EndpointClass = 'url_extract' | 'html_extract' | 'api' | 'default';

const ENDPOINT_MULTIPLIERS: Record<EndpointClass, { perMinute: number; perDay: number }> = {
  url_extract:  { perMinute: 1, perDay: 1 },
  html_extract: { perMinute: 2, perDay: 2 },
  api:          { perMinute: 1, perDay: 1 },
  default:      { perMinute: 1, perDay: 1 },
};

// ─── Tier-based rate limits ─────────────────────────────────────

export interface TierLimits {
  perMinute: number;
  perDay: number;
}

const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free:       { perMinute: 30,   perDay: 500    },
  starter:    { perMinute: 120,  perDay: 5000   },
  pro:        { perMinute: 300,  perDay: 25000  },
  enterprise: { perMinute: 1000, perDay: 100000 },
};

const WINDOW_MS = 60_000; // 1 minute

/** In-memory per-minute sliding window (best-effort burst protection) */
const requestLog = new Map<string, number[]>();

/**
 * In-memory daily counters (fallback when KV unavailable).
 * KV-backed counters are the primary source of truth for daily limits.
 */
const dailyCounters = new Map<string, { count: number; resetAt: number }>();

// ─── KV handle ──────────────────────────────────────────────────

let kv: KVNamespace | null = null;

export function initRateLimiterKV(kvNamespace: KVNamespace | null): void {
  kv = kvNamespace ?? null;
}

// ─── Helpers ────────────────────────────────────────────────────

function getLimitsForTier(tier?: string): TierLimits {
  // Runtime config override takes priority (backwards compat)
  const config = getRuntimeConfig();
  if (config.maxRequests !== 60) {
    // Custom override — use as per-minute limit with no daily cap
    return { perMinute: config.maxRequests, perDay: Infinity };
  }
  return TIER_LIMITS[(tier as SubscriptionTier) || 'free'] ?? TIER_LIMITS.free;
}

function getClientKey(request: Request, userId?: string): string {
  // Prefer userId if available (from auth)
  if (userId && userId !== 'anonymous') return `user:${userId}`;
  const apiKey = request.headers.get('X-Api-Key') || new URL(request.url).searchParams.get('api_key');
  if (apiKey) return `key:${apiKey.slice(0, 12)}`;
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return `ip:${forwarded.split(',')[0].trim()}`;
  return 'anonymous';
}

function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

async function getDailyCount(key: string): Promise<number> {
  // Try KV first (cross-isolate)
  if (kv) {
    try {
      const kvKey = `ratelimit:${key}:${todayDateStr()}`;
      const data = await kv.get(kvKey, 'json') as { count: number } | null;
      if (data) return data.count;
    } catch (err) {
      logActivity({ level: 'error', category: 'system', message: '[RateLimiter] KV read failed: ' + ((err as Error).message || err) });
    }
  }

  // In-memory fallback
  const now = Date.now();
  const entry = dailyCounters.get(key);
  const midnightMs = new Date().setUTCHours(24, 0, 0, 0);
  if (!entry || now >= entry.resetAt) {
    dailyCounters.set(key, { count: 0, resetAt: midnightMs });
    return 0;
  }
  return entry.count;
}

async function incrementDailyCount(key: string): Promise<void> {
  // KV: increment the daily counter
  if (kv) {
    try {
      const kvKey = `ratelimit:${key}:${todayDateStr()}`;
      const data = await kv.get(kvKey, 'json') as { count: number } | null;
      const count = (data?.count ?? 0) + 1;
      // TTL: expires at end of day (~86400s max)
      const secondsUntilMidnight = Math.ceil((new Date().setUTCHours(24, 0, 0, 0) - Date.now()) / 1000);
      await kv.put(kvKey, JSON.stringify({ count }), { expirationTtl: Math.max(secondsUntilMidnight, 60) });
    } catch (err) {
      logActivity({ level: 'error', category: 'system', message: '[RateLimiter] KV write failed: ' + ((err as Error).message || err) });
    }
  }

  // In-memory: always update (serves as local cache)
  const midnightMs = new Date().setUTCHours(24, 0, 0, 0);
  const entry = dailyCounters.get(key);
  if (!entry || Date.now() >= entry.resetAt) {
    dailyCounters.set(key, { count: 1, resetAt: midnightMs });
  } else {
    entry.count++;
  }
}

// ─── Main check ─────────────────────────────────────────────────

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
  errorResponse?: Response;
}

/**
 * Check rate limits for a request.
 *
 * @param request - The incoming request
 * @param tier - Subscription tier (from auth). Defaults to 'free'.
 * @param userId - User ID (from auth). Used as rate limit key.
 * @param endpoint - Endpoint class for per-endpoint multipliers.
 */
export async function checkRateLimit(
  request: Request,
  tier?: string,
  userId?: string,
  endpoint?: EndpointClass,
): Promise<RateLimitResult> {
  const key = getClientKey(request, userId);
  const baseLimits = getLimitsForTier(tier);
  const mult = ENDPOINT_MULTIPLIERS[endpoint || 'default'];
  const limits: TierLimits = {
    perMinute: baseLimits.perMinute * mult.perMinute,
    perDay: baseLimits.perDay === Infinity ? Infinity : baseLimits.perDay * mult.perDay,
  };
  const now = Date.now();

  // 1. Per-minute sliding window (in-memory, best-effort)
  const windowStart = now - WINDOW_MS;
  let timestamps = requestLog.get(key) || [];
  timestamps = timestamps.filter(t => t > windowStart);

  if (timestamps.length >= limits.perMinute) {
    const oldestInWindow = timestamps[0];
    const retryAfter = Math.ceil((oldestInWindow + WINDOW_MS - now) / 1000);

    logRateLimit(key, 'per-minute', request);
    return {
      allowed: false,
      retryAfter,
      errorResponse: errorResponse(
        ApiErrorCode.RATE_LIMITED,
        `Rate limit exceeded (${limits.perMinute}/min for ${tier || 'free'} tier). Upgrade for higher limits.`,
        { 'Retry-After': String(retryAfter) },
        request,
      ),
    };
  }

  // 2. Daily quota (KV-backed)
  const dailyUsed = await getDailyCount(key);
  if (limits.perDay !== Infinity && dailyUsed >= limits.perDay) {
    logRateLimit(key, 'daily-quota', request);
    return {
      allowed: false,
      retryAfter: 3600, // suggest retry in 1 hour
      errorResponse: errorResponse(
        ApiErrorCode.RATE_LIMITED,
        `Daily quota exceeded (${limits.perDay}/day for ${tier || 'free'} tier). Upgrade for higher limits.`,
        { 'Retry-After': '3600' },
        request,
      ),
    };
  }

  // Allow
  timestamps.push(now);
  requestLog.set(key, timestamps);
  await incrementDailyCount(key);
  return { allowed: true };
}

function logRateLimit(key: string, type: string, request: Request): void {
  logActivity({
    level: 'warn',
    category: 'rate_limit',
    message: `Rate limited (${type}): ${key}`,
    clientKey: key,
    path: new URL(request.url).pathname,
    method: request.method,
  });
}

// ─── Utilities ──────────────────────────────────────────────────

/** Reset all rate limit state. For testing only. */
export function resetRateLimiter(): void {
  requestLog.clear();
  dailyCounters.clear();
}

export function getRateLimiterStats(): { activeClients: number; totalRequests: number } {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  let activeClients = 0;
  let totalRequests = 0;

  for (const [, timestamps] of requestLog) {
    const active = timestamps.filter(t => t > windowStart);
    if (active.length > 0) {
      activeClients++;
      totalRequests += active.length;
    }
  }

  return { activeClients, totalRequests };
}

/** Get the limits for a given tier. Exported for testing / admin display. */
export function getTierLimits(tier: SubscriptionTier): TierLimits {
  return TIER_LIMITS[tier] ?? TIER_LIMITS.free;
}
