import { errorResponse, ApiErrorCode } from './api-response.js';
import { getRuntimeConfig } from './runtime-config.js';
import { logActivity } from './activity-logger.js';

const DEFAULT_MAX_REQUESTS = 60;
const WINDOW_MS = 60_000; // 1 minute

const requestLog = new Map<string, number[]>();

function getMaxRequests(): number {
  // Runtime config takes priority
  const config = getRuntimeConfig();
  return config.maxRequests;
}

function getClientKey(request: Request): string {
  const apiKey = request.headers.get('X-Api-Key') || new URL(request.url).searchParams.get('api_key');
  if (apiKey) return `key:${apiKey}`;
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return `ip:${forwarded.split(',')[0].trim()}`;
  return 'anonymous';
}

export function checkRateLimit(request: Request): { allowed: boolean; retryAfter?: number; errorResponse?: Response } {
  const key = getClientKey(request);
  const now = Date.now();
  const maxRequests = getMaxRequests();
  const windowStart = now - WINDOW_MS;

  let timestamps = requestLog.get(key) || [];
  timestamps = timestamps.filter(t => t > windowStart);

  if (timestamps.length >= maxRequests) {
    const oldestInWindow = timestamps[0];
    const retryAfter = Math.ceil((oldestInWindow + WINDOW_MS - now) / 1000);

    logActivity({
      level: 'warn',
      category: 'rate_limit',
      message: `Rate limited: ${key}`,
      clientKey: key,
      path: new URL(request.url).pathname,
      method: request.method,
    });

    return {
      allowed: false,
      retryAfter,
      errorResponse: errorResponse(
        ApiErrorCode.RATE_LIMITED,
        'Too many requests. Please try again later.',
        { 'Retry-After': String(retryAfter) },
      ),
    };
  }

  timestamps.push(now);
  requestLog.set(key, timestamps);
  return { allowed: true };
}

/** Reset all rate limit state. For testing only. */
export function resetRateLimiter(): void {
  requestLog.clear();
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
