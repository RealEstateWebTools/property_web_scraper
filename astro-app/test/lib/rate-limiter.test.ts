import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/lib/services/runtime-config.js', () => ({
  getRuntimeConfig: () => ({ maxRequests: 60 }),
}));

vi.mock('../../src/lib/services/activity-logger.js', () => ({
  logActivity: vi.fn(),
}));

import { checkRateLimit, resetRateLimiter, getTierLimits, getRateLimiterStats } from '../../src/lib/services/rate-limiter.js';

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

  it('allows requests under the limit', async () => {
    const result = await checkRateLimit(makeRequest());
    expect(result.allowed).toBe(true);
    expect(result.errorResponse).toBeUndefined();
  });

  it('blocks free-tier at 30 req/min', async () => {
    for (let i = 0; i < 30; i++) {
      await checkRateLimit(makeRequest(), 'free', 'user-1');
    }
    const result = await checkRateLimit(makeRequest(), 'free', 'user-1');
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it('allows starter-tier beyond 30 req/min (up to 120)', async () => {
    for (let i = 0; i < 60; i++) {
      await checkRateLimit(makeRequest(), 'starter', 'user-2');
    }
    const result = await checkRateLimit(makeRequest(), 'starter', 'user-2');
    expect(result.allowed).toBe(true);
  });

  it('blocks starter-tier at 120 req/min', async () => {
    for (let i = 0; i < 120; i++) {
      await checkRateLimit(makeRequest(), 'starter', 'user-2');
    }
    const result = await checkRateLimit(makeRequest(), 'starter', 'user-2');
    expect(result.allowed).toBe(false);
  });

  it('returns 429 status when rate limited', async () => {
    for (let i = 0; i < 30; i++) {
      await checkRateLimit(makeRequest(), 'free', 'user-1');
    }
    const result = await checkRateLimit(makeRequest(), 'free', 'user-1');
    expect(result.errorResponse!.status).toBe(429);
    const json = await result.errorResponse!.json();
    expect(json.error.code).toBe('RATE_LIMITED');
    expect(json.error.message).toContain('free');
  });

  it('includes Retry-After header when rate limited', async () => {
    for (let i = 0; i < 30; i++) {
      await checkRateLimit(makeRequest(), 'free', 'user-1');
    }
    const result = await checkRateLimit(makeRequest(), 'free', 'user-1');
    expect(result.errorResponse!.headers.get('Retry-After')).toBeTruthy();
  });

  it('isolates rate limits per userId', async () => {
    // Fill limit for user-1
    for (let i = 0; i < 30; i++) {
      await checkRateLimit(makeRequest(), 'free', 'user-1');
    }
    // user-1 blocked
    expect((await checkRateLimit(makeRequest(), 'free', 'user-1')).allowed).toBe(false);
    // user-2 still allowed
    expect((await checkRateLimit(makeRequest(), 'free', 'user-2')).allowed).toBe(true);
  });

  it('falls back to API key prefix when no userId', async () => {
    // Fill limit for key-A
    for (let i = 0; i < 30; i++) {
      await checkRateLimit(makeRequest({ apiKey: 'key-A' }), 'free');
    }
    expect((await checkRateLimit(makeRequest({ apiKey: 'key-A' }), 'free')).allowed).toBe(false);
    expect((await checkRateLimit(makeRequest({ apiKey: 'key-B' }), 'free')).allowed).toBe(true);
  });

  it('uses IP as fallback identifier', async () => {
    for (let i = 0; i < 30; i++) {
      await checkRateLimit(makeRequest({ ip: '1.2.3.4' }));
    }
    expect((await checkRateLimit(makeRequest({ ip: '1.2.3.4' }))).allowed).toBe(false);
    expect((await checkRateLimit(makeRequest({ ip: '5.6.7.8' }))).allowed).toBe(true);
  });

  it('resets after the time window expires', async () => {
    vi.useFakeTimers();
    try {
      for (let i = 0; i < 30; i++) {
        await checkRateLimit(makeRequest(), 'free', 'user-1');
      }
      expect((await checkRateLimit(makeRequest(), 'free', 'user-1')).allowed).toBe(false);

      // Advance past the 1-minute window
      vi.advanceTimersByTime(61_000);

      expect((await checkRateLimit(makeRequest(), 'free', 'user-1')).allowed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('defaults to free tier when no tier specified', async () => {
    for (let i = 0; i < 30; i++) {
      await checkRateLimit(makeRequest());
    }
    const result = await checkRateLimit(makeRequest());
    expect(result.allowed).toBe(false);
  });
});

describe('endpoint multipliers', () => {
  beforeEach(() => {
    resetRateLimiter();
  });

  it('html_extract allows 2x the base per-minute limit', async () => {
    // Free tier = 30/min. html_extract has 2x multiplier = 60/min
    for (let i = 0; i < 50; i++) {
      await checkRateLimit(makeRequest(), 'free', 'user-html', 'html_extract');
    }
    // Should still be allowed (50 < 60)
    const result = await checkRateLimit(makeRequest(), 'free', 'user-html', 'html_extract');
    expect(result.allowed).toBe(true);
  });

  it('html_extract blocks at 2x the base limit', async () => {
    for (let i = 0; i < 60; i++) {
      await checkRateLimit(makeRequest(), 'free', 'user-html2', 'html_extract');
    }
    const result = await checkRateLimit(makeRequest(), 'free', 'user-html2', 'html_extract');
    expect(result.allowed).toBe(false);
  });

  it('url_extract uses base limit (1x)', async () => {
    for (let i = 0; i < 30; i++) {
      await checkRateLimit(makeRequest(), 'free', 'user-url', 'url_extract');
    }
    const result = await checkRateLimit(makeRequest(), 'free', 'user-url', 'url_extract');
    expect(result.allowed).toBe(false);
  });

  it('default endpoint uses base limit', async () => {
    for (let i = 0; i < 30; i++) {
      await checkRateLimit(makeRequest(), 'free', 'user-def');
    }
    const result = await checkRateLimit(makeRequest(), 'free', 'user-def');
    expect(result.allowed).toBe(false);
  });

  it('endpoint multiplier works with different tiers', async () => {
    // Starter tier = 120/min. html_extract = 2x = 240/min
    for (let i = 0; i < 200; i++) {
      await checkRateLimit(makeRequest(), 'starter', 'user-starter-html', 'html_extract');
    }
    const result = await checkRateLimit(makeRequest(), 'starter', 'user-starter-html', 'html_extract');
    expect(result.allowed).toBe(true);
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

describe('getRateLimiterStats', () => {
  beforeEach(() => {
    resetRateLimiter();
  });

  it('returns zero stats when no requests made', () => {
    const stats = getRateLimiterStats();
    expect(stats.activeClients).toBe(0);
    expect(stats.totalRequests).toBe(0);
  });

  it('counts active clients and total requests', async () => {
    await checkRateLimit(makeRequest(), 'free', 'user-stats-1');
    await checkRateLimit(makeRequest(), 'free', 'user-stats-1');
    await checkRateLimit(makeRequest(), 'free', 'user-stats-2');

    const stats = getRateLimiterStats();
    expect(stats.activeClients).toBe(2);
    expect(stats.totalRequests).toBe(3);
  });

  it('only counts requests within the time window', async () => {
    vi.useFakeTimers();
    try {
      await checkRateLimit(makeRequest(), 'free', 'user-stats-old');

      // Advance past the 1-minute window
      vi.advanceTimersByTime(61_000);

      const stats = getRateLimiterStats();
      expect(stats.activeClients).toBe(0);
      expect(stats.totalRequests).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('resetRateLimiter', () => {
  beforeEach(() => {
    resetRateLimiter();
  });

  it('clears all tracked requests', async () => {
    await checkRateLimit(makeRequest(), 'free', 'user-reset-1');
    await checkRateLimit(makeRequest(), 'free', 'user-reset-2');

    let stats = getRateLimiterStats();
    expect(stats.activeClients).toBe(2);

    resetRateLimiter();

    stats = getRateLimiterStats();
    expect(stats.activeClients).toBe(0);
    expect(stats.totalRequests).toBe(0);
  });

  it('allows previously blocked users to make requests again', async () => {
    for (let i = 0; i < 30; i++) {
      await checkRateLimit(makeRequest(), 'free', 'user-block-reset');
    }
    expect((await checkRateLimit(makeRequest(), 'free', 'user-block-reset')).allowed).toBe(false);

    resetRateLimiter();

    expect((await checkRateLimit(makeRequest(), 'free', 'user-block-reset')).allowed).toBe(true);
  });
});
