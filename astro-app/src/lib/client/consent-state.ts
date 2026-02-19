/**
 * Consent record manager.
 *
 * Stores the user's consent choice in localStorage via the
 * storage-consent wrapper.  The consent record itself is in
 * the "necessary" category (always allowed).
 */

import {
  pwsGet,
  pwsSet,
  pwsRemove,
  pwsPurgeCategory,
  _setConsentChecker,
  type ConsentCategory,
} from './storage-consent.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConsentRecord {
  version: 1;
  timestamp: string;
  functional: 'granted' | 'denied';
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONSENT_KEY = 'necessary:consent';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Read the current consent record (or null if never set). */
export function getConsentState(): ConsentRecord | null {
  return pwsGet<ConsentRecord>(CONSENT_KEY);
}

/** Persist a consent decision. */
export function setConsentState(functional: 'granted' | 'denied'): void {
  const record: ConsentRecord = {
    version: 1,
    timestamp: new Date().toISOString(),
    functional,
  };
  pwsSet(CONSENT_KEY, record, { category: 'necessary' });
}

/**
 * Check whether consent has been granted for a category.
 *
 * - `necessary` is always true.
 * - `functional` is true only when the stored record says "granted".
 */
export function hasConsentFor(cat: ConsentCategory): boolean {
  if (cat === 'necessary') return true;
  const state = getConsentState();
  return state?.functional === 'granted';
}

/**
 * Revoke consent: purge all functional data, then remove the consent
 * record itself so the banner reappears.
 */
export function resetConsent(): void {
  pwsPurgeCategory('functional');
  pwsRemove(CONSENT_KEY);
}

// ---------------------------------------------------------------------------
// Wire up the consent checker so storage-consent.ts can use it
// ---------------------------------------------------------------------------

_setConsentChecker(hasConsentFor);
