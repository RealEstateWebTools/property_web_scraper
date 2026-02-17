import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/lib/services/runtime-config.js', () => ({
  getRuntimeConfig: () => ({ maxRequests: 60 }),
}));

vi.mock('../../src/lib/services/activity-logger.js', () => ({
  logActivity: vi.fn(),
}));

import { checkRateLimit, resetRateLimiter, getTierLimits } from '../../src/lib/services/rate-limiter.js';

function makeRequest(overrides: { apiKey?: string; ip?: string; url?: string } = {}): Request {
  const headers = new Headers();
  if (overrides.apiKey) headers.set('X-Api-Key', overrides.apiKey);
  if (overrides.ip) headers.set('x-forwarded-for', overrides.ip);
  return new Request(overrides.url || 'https://example.com/public_api/v1/listings', { headers });
}

describe('rate-limiter', () => {
  beforeEach(() => {
    resetRateLimiter();
  });

  it('allows requests under the limit', () => {
    const result = checkRateLimit(makeRequest());
    expect(result.allowed).toBe(true);
    expect(result.errorResponse).toBeUndefined();
  });

  it('blocks free-tier at 30 req/min', () => {
    for (let i = 0; i < 30; i++) {
      checkRateLimit(makeRequest(), 'free', 'user-1');
    }
    const result = checkRateLimit(makeRequest(), 'free', 'user-1');
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it('allows starter-tier beyond 30 req/min (up to 120)', () => {
    for (let i = 0; i < 60; i++) {
      checkRateLimit(makeRequest(), 'starter', 'user-2');
    }
    const result = checkRateLimit(makeRequest(), 'starter', 'user-2');
    expect(result.allowed).toBe(true);
  });

  it('blocks starter-tier at 120 req/min', () => {
    for (let i = 0; i < 120; i++) {
      checkRateLimit(makeRequest(), 'starter', 'user-2');
    }
    const result = checkRateLimit(makeRequest(), 'starter', 'user-2');
    expect(result.allowed).toBe(false);
  });

  it('returns 429 status when rate limited', async () => {
    for (let i = 0; i < 30; i++) {
      checkRateLimit(makeRequest(), 'free', 'user-1');
    }
    const result = checkRateLimit(makeRequest(), 'free', 'user-1');
    expect(result.errorResponse!.status).toBe(429);
    const json = await result.errorResponse!.json();
    expect(json.error.code).toBe('RATE_LIMITED');
    expect(json.error.message).toContain('free');
  });

  it('includes Retry-After header when rate limited', () => {
    for (let i = 0; i < 30; i++) {
      checkRateLimit(makeRequest(), 'free', 'user-1');
    }
    const result = checkRateLimit(makeRequest(), 'free', 'user-1');
    expect(result.errorResponse!.headers.get('Retry-After')).toBeTruthy();
  });

  it('isolates rate limits per userId', () => {
    // Fill limit for user-1
    for (let i = 0; i < 30; i++) {
      checkRateLimit(makeRequest(), 'free', 'user-1');
    }
    // user-1 blocked
    expect(checkRateLimit(makeRequest(), 'free', 'user-1').allowed).toBe(false);
    // user-2 still allowed
    expect(checkRateLimit(makeRequest(), 'free', 'user-2').allowed).toBe(true);
  });

  it('falls back to API key prefix when no userId', () => {
    // Fill limit for key-A
    for (let i = 0; i < 30; i++) {
      checkRateLimit(makeRequest({ apiKey: 'key-A' }), 'free');
    }
    expect(checkRateLimit(makeRequest({ apiKey: 'key-A' }), 'free').allowed).toBe(false);
    expect(checkRateLimit(makeRequest({ apiKey: 'key-B' }), 'free').allowed).toBe(true);
  });

  it('uses IP as fallback identifier', () => {
    for (let i = 0; i < 30; i++) {
      checkRateLimit(makeRequest({ ip: '1.2.3.4' }));
    }
    expect(checkRateLimit(makeRequest({ ip: '1.2.3.4' })).allowed).toBe(false);
    expect(checkRateLimit(makeRequest({ ip: '5.6.7.8' })).allowed).toBe(true);
  });

  it('resets after the time window expires', () => {
    vi.useFakeTimers();
    try {
      for (let i = 0; i < 30; i++) {
        checkRateLimit(makeRequest(), 'free', 'user-1');
      }
      expect(checkRateLimit(makeRequest(), 'free', 'user-1').allowed).toBe(false);

      // Advance past the 1-minute window
      vi.advanceTimersByTime(61_000);

      expect(checkRateLimit(makeRequest(), 'free', 'user-1').allowed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('defaults to free tier when no tier specified', () => {
    for (let i = 0; i < 30; i++) {
      checkRateLimit(makeRequest());
    }
    const result = checkRateLimit(makeRequest());
    expect(result.allowed).toBe(false);
  });
});

describe('getTierLimits', () => {
  it('returns correct limits for each tier', () => {
    expect(getTierLimits('free').perMinute).toBe(30);
    expect(getTierLimits('starter').perMinute).toBe(120);
    expect(getTierLimits('pro').perMinute).toBe(300);
    expect(getTierLimits('enterprise').perMinute).toBe(1000);
  });

  it('returns daily limits', () => {
    expect(getTierLimits('free').perDay).toBe(500);
    expect(getTierLimits('starter').perDay).toBe(5000);
    expect(getTierLimits('pro').perDay).toBe(25000);
  });
});
