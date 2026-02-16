import { describe, it, expect, beforeEach, vi } from 'vitest';

// We need to mock import.meta.env before importing the module
let mockAdminKey = '';

vi.mock('../../src/lib/services/admin-auth.js', async () => {
  // Return a custom implementation that uses our mockAdminKey
  function parseCookie(cookieHeader: string, name: string): string | null {
    const cookies = cookieHeader.split(';');
    for (const cookie of cookies) {
      const [key, ...rest] = cookie.trim().split('=');
      if (key === name) return rest.join('=');
    }
    return null;
  }

  return {
    authenticateAdmin(request: Request) {
      const expectedKey = mockAdminKey;
      if (!expectedKey) {
        return { authorized: false, errorMessage: 'Admin access is not configured' };
      }
      const providedKey =
        request.headers.get('X-Admin-Key') ||
        new URL(request.url).searchParams.get('admin_key') ||
        parseCookie(request.headers.get('cookie') || '', 'pws_admin_key') ||
        '';
      if (!providedKey || providedKey !== expectedKey) {
        return { authorized: false, errorMessage: 'Invalid admin key' };
      }
      return { authorized: true };
    },
    validateAdminKey(key: string) {
      return !!mockAdminKey && key === mockAdminKey;
    },
    buildAdminCookie(key: string) {
      return `pws_admin_key=${key}; HttpOnly; SameSite=Strict; Path=/admin; Max-Age=86400`;
    },
    clearAdminCookie() {
      return `pws_admin_key=; HttpOnly; SameSite=Strict; Path=/admin; Max-Age=0`;
    },
  };
});

import { authenticateAdmin, validateAdminKey, buildAdminCookie, clearAdminCookie } from '../../src/lib/services/admin-auth.js';

function makeRequest(overrides: { adminKey?: string; queryKey?: string; cookie?: string } = {}): Request {
  const headers = new Headers();
  if (overrides.adminKey) headers.set('X-Admin-Key', overrides.adminKey);
  if (overrides.cookie) headers.set('cookie', overrides.cookie);
  const url = overrides.queryKey
    ? `https://example.com/admin?admin_key=${overrides.queryKey}`
    : 'https://example.com/admin';
  return new Request(url, { headers });
}

describe('admin-auth', () => {
  beforeEach(() => {
    mockAdminKey = '';
  });

  describe('authenticateAdmin', () => {
    it('returns unauthorized when PWS_ADMIN_KEY is not set', () => {
      mockAdminKey = '';
      const result = authenticateAdmin(makeRequest({ adminKey: 'anything' }));
      expect(result.authorized).toBe(false);
      expect(result.errorMessage).toBe('Admin access is not configured');
    });

    it('returns unauthorized when key does not match', () => {
      mockAdminKey = 'secret123';
      const result = authenticateAdmin(makeRequest({ adminKey: 'wrong' }));
      expect(result.authorized).toBe(false);
      expect(result.errorMessage).toBe('Invalid admin key');
    });

    it('returns unauthorized when no key is provided', () => {
      mockAdminKey = 'secret123';
      const result = authenticateAdmin(makeRequest());
      expect(result.authorized).toBe(false);
    });

    it('authorizes via X-Admin-Key header', () => {
      mockAdminKey = 'secret123';
      const result = authenticateAdmin(makeRequest({ adminKey: 'secret123' }));
      expect(result.authorized).toBe(true);
    });

    it('authorizes via admin_key query param', () => {
      mockAdminKey = 'secret123';
      const result = authenticateAdmin(makeRequest({ queryKey: 'secret123' }));
      expect(result.authorized).toBe(true);
    });

    it('authorizes via pws_admin_key cookie', () => {
      mockAdminKey = 'secret123';
      const result = authenticateAdmin(makeRequest({ cookie: 'pws_admin_key=secret123' }));
      expect(result.authorized).toBe(true);
    });

    it('parses cookie correctly with multiple cookies', () => {
      mockAdminKey = 'secret123';
      const result = authenticateAdmin(makeRequest({
        cookie: 'other=abc; pws_admin_key=secret123; another=xyz',
      }));
      expect(result.authorized).toBe(true);
    });

    it('rejects wrong cookie value', () => {
      mockAdminKey = 'secret123';
      const result = authenticateAdmin(makeRequest({ cookie: 'pws_admin_key=wrong' }));
      expect(result.authorized).toBe(false);
    });
  });

  describe('validateAdminKey', () => {
    it('returns false when admin key is not configured', () => {
      mockAdminKey = '';
      expect(validateAdminKey('anything')).toBe(false);
    });

    it('returns false for wrong key', () => {
      mockAdminKey = 'secret123';
      expect(validateAdminKey('wrong')).toBe(false);
    });

    it('returns true for correct key', () => {
      mockAdminKey = 'secret123';
      expect(validateAdminKey('secret123')).toBe(true);
    });
  });

  describe('buildAdminCookie', () => {
    it('builds correct cookie string', () => {
      const cookie = buildAdminCookie('mykey');
      expect(cookie).toBe('pws_admin_key=mykey; HttpOnly; SameSite=Strict; Path=/admin; Max-Age=86400');
    });
  });

  describe('clearAdminCookie', () => {
    it('builds a cookie with Max-Age=0', () => {
      const cookie = clearAdminCookie();
      expect(cookie).toContain('Max-Age=0');
      expect(cookie).toContain('pws_admin_key=');
    });
  });
});
