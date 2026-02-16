import { errorResponse, ApiErrorCode } from './api-response.js';

const DEFAULT_MAX_REQUESTS = 60;
const WINDOW_MS = 60_000; // 1 minute

const requestLog = new Map<string, number[]>();

function getMaxRequests(): number {
  try {
    const env = (import.meta as any).env?.PWS_RATE_LIMIT;
    if (env) return parseInt(env, 10) || DEFAULT_MAX_REQUESTS;
  } catch { /* ignore */ }
  return DEFAULT_MAX_REQUESTS;
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
