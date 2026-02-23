/**
 * Tests for api-guard.ts — consolidates auth + rate-limit boilerplate.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing api-guard
vi.mock('../../src/lib/services/auth.js', () => ({
  authenticateApiKey: vi.fn(),
}));
vi.mock('../../src/lib/services/rate-limiter.js', () => ({
  checkRateLimit: vi.fn(),
}));

import { apiGuard } from '../../src/lib/services/api-guard.js';
import { authenticateApiKey } from '../../src/lib/services/auth.js';
import { checkRateLimit } from '../../src/lib/services/rate-limiter.js';

const mockAuth = vi.mocked(authenticateApiKey);
const mockRate = vi.mocked(checkRateLimit);

function makeRequest(path = '/api/test'): Request {
  return new Request(`http://localhost${path}`);
}

const AUTHORIZED_AUTH = {
  authorized: true as const,
  userId: 'user-123',
  tier: 'starter' as const,
  errorResponse: undefined,
};

const RATE_ALLOWED = {
  allowed: true,
  errorResponse: undefined,
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('apiGuard', () => {
  it('returns ok:true when auth and rate limit both pass', async () => {
    mockAuth.mockResolvedValue(AUTHORIZED_AUTH);
    mockRate.mockResolvedValue(RATE_ALLOWED);

    const result = await apiGuard(makeRequest());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.auth.userId).toBe('user-123');
      expect(result.auth.tier).toBe('starter');
    }
  });

  it('returns ok:false when auth fails', async () => {
    const errorResp = new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    mockAuth.mockResolvedValue({
      authorized: false,
      userId: undefined,
      tier: 'free' as const,
      errorResponse: errorResp,
    });

    const result = await apiGuard(makeRequest());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
    // Rate limit should not be checked
    expect(mockRate).not.toHaveBeenCalled();
  });

  it('returns ok:false when rate limit exceeded', async () => {
    mockAuth.mockResolvedValue(AUTHORIZED_AUTH);
    const errorResp = new Response(JSON.stringify({ error: 'Rate limited' }), { status: 429 });
    mockRate.mockResolvedValue({
      allowed: false,
      errorResponse: errorResp,
    });

    const result = await apiGuard(makeRequest());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(429);
    }
  });

  it('passes the request to authenticateApiKey', async () => {
    mockAuth.mockResolvedValue(AUTHORIZED_AUTH);
    mockRate.mockResolvedValue(RATE_ALLOWED);
    const request = makeRequest('/api/extract');

    await apiGuard(request);

    expect(mockAuth).toHaveBeenCalledWith(request);
  });

  it('passes auth details and endpoint to checkRateLimit', async () => {
    mockAuth.mockResolvedValue(AUTHORIZED_AUTH);
    mockRate.mockResolvedValue(RATE_ALLOWED);
    const request = makeRequest();
    const endpoint = 'extraction' as any;

    await apiGuard(request, endpoint);

    expect(mockRate).toHaveBeenCalledWith(request, 'starter', 'user-123', endpoint);
  });

  it('passes undefined endpoint when not supplied', async () => {
    mockAuth.mockResolvedValue(AUTHORIZED_AUTH);
    mockRate.mockResolvedValue(RATE_ALLOWED);
    const request = makeRequest();

    await apiGuard(request);

    expect(mockRate).toHaveBeenCalledWith(request, 'starter', 'user-123', undefined);
  });

  it('exposes auth on pass result', async () => {
    mockAuth.mockResolvedValue({ ...AUTHORIZED_AUTH, tier: 'enterprise' as const, userId: 'admin' });
    mockRate.mockResolvedValue(RATE_ALLOWED);

    const result = await apiGuard(makeRequest());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.auth.tier).toBe('enterprise');
      expect(result.auth.userId).toBe('admin');
    }
  });
});
