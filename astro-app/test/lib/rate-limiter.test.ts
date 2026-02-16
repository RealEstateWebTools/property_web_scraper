import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkRateLimit, resetRateLimiter } from '../../src/lib/services/rate-limiter.js';

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

  it('blocks requests over the limit', () => {
    for (let i = 0; i < 60; i++) {
      checkRateLimit(makeRequest());
    }
    const result = checkRateLimit(makeRequest());
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
    expect(result.errorResponse).toBeDefined();
  });

  it('returns 429 status when rate limited', async () => {
    for (let i = 0; i < 60; i++) {
      checkRateLimit(makeRequest());
    }
    const result = checkRateLimit(makeRequest());
    expect(result.errorResponse!.status).toBe(429);
    const json = await result.errorResponse!.json();
    expect(json.error.code).toBe('RATE_LIMITED');
  });

  it('includes Retry-After header when rate limited', () => {
    for (let i = 0; i < 60; i++) {
      checkRateLimit(makeRequest());
    }
    const result = checkRateLimit(makeRequest());
    expect(result.errorResponse!.headers.get('Retry-After')).toBeTruthy();
  });

  it('uses API key as identifier when present', () => {
    // Fill limit for key-A
    for (let i = 0; i < 60; i++) {
      checkRateLimit(makeRequest({ apiKey: 'key-A' }));
    }
    // key-A is blocked
    expect(checkRateLimit(makeRequest({ apiKey: 'key-A' })).allowed).toBe(false);
    // key-B is still allowed
    expect(checkRateLimit(makeRequest({ apiKey: 'key-B' })).allowed).toBe(true);
  });

  it('uses IP as fallback identifier', () => {
    // Fill limit for IP 1.2.3.4
    for (let i = 0; i < 60; i++) {
      checkRateLimit(makeRequest({ ip: '1.2.3.4' }));
    }
    // IP 1.2.3.4 is blocked
    expect(checkRateLimit(makeRequest({ ip: '1.2.3.4' })).allowed).toBe(false);
    // IP 5.6.7.8 is still allowed
    expect(checkRateLimit(makeRequest({ ip: '5.6.7.8' })).allowed).toBe(true);
  });

  it('resets after the time window expires', () => {
    vi.useFakeTimers();
    try {
      for (let i = 0; i < 60; i++) {
        checkRateLimit(makeRequest());
      }
      expect(checkRateLimit(makeRequest()).allowed).toBe(false);

      // Advance past the 1-minute window
      vi.advanceTimersByTime(61_000);

      expect(checkRateLimit(makeRequest()).allowed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
