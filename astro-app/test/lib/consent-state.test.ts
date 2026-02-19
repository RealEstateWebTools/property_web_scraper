import { describe, it, expect, beforeEach } from 'vitest';
import {
  getConsentState,
  setConsentState,
  hasConsentFor,
  resetConsent,
} from '../../src/lib/client/consent-state.js';
import { pwsGet, pwsSet, _setConsentChecker } from '../../src/lib/client/storage-consent.js';

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

beforeEach(() => {
  const mockStorage = createMockStorage();
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockStorage,
    writable: true,
    configurable: true,
  });
  // Re-import wires up _setConsentChecker; reset to default first
  _setConsentChecker(() => true);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('consent-state', () => {
  it('hasConsentFor("necessary") is always true', () => {
    expect(hasConsentFor('necessary')).toBe(true);
  });

  it('hasConsentFor("functional") is false when no record exists', () => {
    // No consent record stored — import of consent-state sets the checker
    // but getConsentState() returns null, so functional is false
    _setConsentChecker(hasConsentFor);
    expect(hasConsentFor('functional')).toBe(false);
  });

  it('returns granted state after setConsentState("granted")', () => {
    setConsentState('granted');
    const state = getConsentState();
    expect(state).not.toBeNull();
    expect(state!.functional).toBe('granted');
    expect(state!.version).toBe(1);
    expect(state!.timestamp).toBeTruthy();
  });

  it('hasConsentFor("functional") is true after granting', () => {
    setConsentState('granted');
    _setConsentChecker(hasConsentFor);
    expect(hasConsentFor('functional')).toBe(true);
  });

  it('hasConsentFor("functional") is false after denying', () => {
    setConsentState('denied');
    _setConsentChecker(hasConsentFor);
    expect(hasConsentFor('functional')).toBe(false);
  });

  it('resetConsent purges functional keys and removes consent record', () => {
    // Grant consent first so we can write functional data
    setConsentState('granted');
    _setConsentChecker(hasConsentFor);

    // Write some functional data
    pwsSet('functional:recent-extractions', [{ id: '1' }]);
    pwsSet('functional:recent-urls', ['https://example.com']);

    // Verify they exist
    expect(pwsGet('functional:recent-extractions')).not.toBeNull();
    expect(pwsGet('functional:recent-urls')).not.toBeNull();

    // Reset
    resetConsent();

    // Consent record gone
    expect(getConsentState()).toBeNull();
    // Functional data gone
    expect(pwsGet('functional:recent-extractions')).toBeNull();
    expect(pwsGet('functional:recent-urls')).toBeNull();
  });
});
