import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  pwsGet,
  pwsSet,
  pwsRemove,
  pwsPurgeCategory,
  pwsPurgeAll,
  pwsPruneExpired,
  pwsListKeys,
  pwsExportAll,
  _setConsentChecker,
  MAX_ENTRY_BYTES,
} from '../../src/lib/client/storage-consent.js';

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

function createMockStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  };
}

let mockStorage: Storage;

beforeEach(() => {
  mockStorage = createMockStorage();
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockStorage,
    writable: true,
    configurable: true,
  });
  // Default: consent granted for both categories
  _setConsentChecker(() => true);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('storage-consent', () => {
  describe('pwsGet / pwsSet', () => {
    it('returns value after set with valid consent', () => {
      pwsSet('necessary:consent', { hello: 'world' });
      expect(pwsGet('necessary:consent')).toEqual({ hello: 'world' });
    });

    it('returns null for missing key', () => {
      expect(pwsGet('necessary:consent')).toBeNull();
    });

    it('does not write when consent is denied for category', () => {
      _setConsentChecker((cat) => cat === 'necessary');
      const ok = pwsSet('functional:recent-extractions', [1, 2, 3]);
      expect(ok).toBe(false);
      expect(pwsGet('functional:recent-extractions')).toBeNull();
    });

    it('allows necessary keys even when functional is denied', () => {
      _setConsentChecker((cat) => cat === 'necessary');
      const ok = pwsSet('necessary:ui:toggles', { panel: true });
      expect(ok).toBe(true);
      expect(pwsGet('necessary:ui:toggles')).toEqual({ panel: true });
    });

    it('auto-removes expired entry on get', () => {
      // Write with a past expiry
      const entry = {
        v: 'old',
        expiresAt: new Date(Date.now() - 1000).toISOString(),
        cat: 'necessary' as const,
        ver: 1 as const,
      };
      mockStorage.setItem('pws:v1:necessary:consent', JSON.stringify(entry));
      expect(pwsGet('necessary:consent')).toBeNull();
      expect(mockStorage.getItem('pws:v1:necessary:consent')).toBeNull();
    });

    it('rejects keys not in allowlist', () => {
      const ok = pwsSet('functional:forbidden-key', 'nope');
      expect(ok).toBe(false);
    });

    it('rejects oversized entries', () => {
      const bigValue = 'x'.repeat(MAX_ENTRY_BYTES);
      const ok = pwsSet('necessary:consent', bigValue);
      expect(ok).toBe(false);
    });
  });

  describe('pwsRemove', () => {
    it('removes a stored key', () => {
      pwsSet('necessary:consent', 'test');
      pwsRemove('necessary:consent');
      expect(pwsGet('necessary:consent')).toBeNull();
    });
  });

  describe('pwsPurgeCategory', () => {
    it('only removes keys in the targeted category', () => {
      pwsSet('necessary:consent', 'keep');
      pwsSet('necessary:ui:toggles', 'keep');
      pwsSet('functional:recent-extractions', 'remove');
      pwsSet('functional:recent-urls', 'remove');

      pwsPurgeCategory('functional');

      expect(pwsGet('necessary:consent')).toBe('keep');
      expect(pwsGet('necessary:ui:toggles')).toBe('keep');
      expect(pwsGet('functional:recent-extractions')).toBeNull();
      expect(pwsGet('functional:recent-urls')).toBeNull();
    });
  });

  describe('pwsPurgeAll', () => {
    it('removes all pws:* keys', () => {
      pwsSet('necessary:consent', 'a');
      pwsSet('functional:recent-extractions', 'b');
      // also add a non-pws key
      mockStorage.setItem('other-key', 'stays');

      pwsPurgeAll();

      expect(pwsGet('necessary:consent')).toBeNull();
      expect(pwsGet('functional:recent-extractions')).toBeNull();
      expect(mockStorage.getItem('other-key')).toBe('stays');
    });
  });

  describe('pwsPruneExpired', () => {
    it('removes expired entries and keeps valid ones', () => {
      pwsSet('necessary:consent', 'valid');
      // Manually insert an expired entry
      const expired = {
        v: 'gone',
        expiresAt: new Date(Date.now() - 1000).toISOString(),
        cat: 'functional',
        ver: 1,
      };
      mockStorage.setItem('pws:v1:functional:recent-urls', JSON.stringify(expired));

      pwsPruneExpired();

      expect(pwsGet('necessary:consent')).toBe('valid');
      expect(mockStorage.getItem('pws:v1:functional:recent-urls')).toBeNull();
    });

    it('removes corrupted JSON entries', () => {
      mockStorage.setItem('pws:v1:necessary:consent', '{bad json');
      pwsPruneExpired();
      expect(mockStorage.getItem('pws:v1:necessary:consent')).toBeNull();
    });
  });

  describe('pwsListKeys', () => {
    it('returns metadata for all stored keys', () => {
      pwsSet('necessary:consent', 'a');
      pwsSet('functional:recent-extractions', [1]);

      const keys = pwsListKeys();
      expect(keys).toHaveLength(2);
      expect(keys.map((k) => k.key).sort()).toEqual([
        'functional:recent-extractions',
        'necessary:consent',
      ]);
      keys.forEach((k) => {
        expect(k.sizeBytes).toBeGreaterThan(0);
        expect(k.expiresAt).toBeTruthy();
        expect(['necessary', 'functional']).toContain(k.category);
      });
    });
  });

  describe('pwsExportAll', () => {
    it('returns valid JSON of all stored data', () => {
      pwsSet('necessary:consent', { test: true });
      pwsSet('functional:recent-urls', ['a', 'b']);

      const exported = pwsExportAll();
      const parsed = JSON.parse(exported);
      expect(parsed['necessary:consent']).toBeDefined();
      expect(parsed['necessary:consent'].v).toEqual({ test: true });
      expect(parsed['functional:recent-urls']).toBeDefined();
    });

    it('returns empty object when no data stored', () => {
      expect(pwsExportAll()).toBe('{}');
    });
  });

  describe('corrupted data handling', () => {
    it('pwsGet returns null and cleans up corrupted entry', () => {
      mockStorage.setItem('pws:v1:necessary:consent', 'not-json{{{');
      expect(pwsGet('necessary:consent')).toBeNull();
      expect(mockStorage.getItem('pws:v1:necessary:consent')).toBeNull();
    });
  });
});
