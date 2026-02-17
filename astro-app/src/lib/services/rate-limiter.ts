import { errorResponse, ApiErrorCode } from './api-response.js';
import { getRuntimeConfig } from './runtime-config.js';
import { logActivity } from './activity-logger.js';
import type { SubscriptionTier } from './api-key-service.js';

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

/** In-memory per-minute sliding window (resets on deploy) */
const requestLog = new Map<string, number[]>();

/** In-memory daily counters (resets on deploy — KV-backed version in usage-meter) */
const dailyCounters = new Map<string, { count: number; resetAt: number }>();

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

function getDailyCount(key: string): number {
  const now = Date.now();
  const entry = dailyCounters.get(key);

  // Reset at midnight UTC
  const midnightMs = new Date().setUTCHours(24, 0, 0, 0);
  if (!entry || now >= entry.resetAt) {
    dailyCounters.set(key, { count: 0, resetAt: midnightMs });
    return 0;
  }
  return entry.count;
}

function incrementDailyCount(key: string): void {
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
 */
export function checkRateLimit(
  request: Request,
  tier?: string,
  userId?: string,
): RateLimitResult {
  const key = getClientKey(request, userId);
  const limits = getLimitsForTier(tier);
  const now = Date.now();

  // 1. Per-minute sliding window
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

  // 2. Daily quota
  const dailyUsed = getDailyCount(key);
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
  incrementDailyCount(key);
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
