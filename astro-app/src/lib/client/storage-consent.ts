/**
 * GDPR-compliant localStorage wrapper.
 *
 * All reads/writes go through this module — no other code should call
 * localStorage directly.  Every stored value follows the StoredEntry
 * envelope (value + expiry + category + schema version).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConsentCategory = 'necessary' | 'functional';

export interface StoredEntry<T> {
  v: T;
  expiresAt: string;          // ISO-8601
  cat: ConsentCategory;
  ver: 1;
}

export interface KeyInfo {
  key: string;
  category: ConsentCategory;
  expiresAt: string;
  sizeBytes: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KEY_PREFIX = 'pws:v1:';

/** Max bytes for a single JSON-serialised entry. */
export const MAX_ENTRY_BYTES = 50_000;

/** Max total bytes across all pws:* keys. */
export const MAX_TOTAL_BYTES = 500_000;

/**
 * Allowed key patterns.  A key must match at least one pattern to be written.
 * Patterns are tested against the *short* key (without the prefix).
 */
const ALLOWED_KEY_PATTERNS: RegExp[] = [
  /^necessary:consent$/,
  /^necessary:ui:toggles$/,
  /^functional:recent-extractions$/,
  /^functional:recent-urls$/,
  /^functional:haul-cache:[a-zA-Z0-9_-]+$/,
  /^functional:result-cache:[a-zA-Z0-9_-]+$/,
  /^functional:my-hauls$/,
];

/** Default TTLs in milliseconds, keyed by short-key prefix. */
const DEFAULT_TTLS: Record<string, number> = {
  'necessary:consent':              365 * 24 * 60 * 60 * 1000,
  'necessary:ui:toggles':           365 * 24 * 60 * 60 * 1000,
  'functional:recent-extractions':    7 * 24 * 60 * 60 * 1000,
  'functional:recent-urls':           7 * 24 * 60 * 60 * 1000,
  'functional:haul-cache':           30 * 24 * 60 * 60 * 1000,
  'functional:result-cache':               1 * 60 * 60 * 1000,
  'functional:my-hauls':                  30 * 24 * 60 * 60 * 1000,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Consent callback — injected by consent-state.ts at init time. */
let _hasConsentFor: (cat: ConsentCategory) => boolean = (cat) =>
  cat === 'necessary';

export function _setConsentChecker(fn: (cat: ConsentCategory) => boolean): void {
  _hasConsentFor = fn;
}

function isStorageAvailable(): boolean {
  try {
    const key = '__pws_test__';
    localStorage.setItem(key, '1');
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function fullKey(shortKey: string): string {
  return `${KEY_PREFIX}${shortKey}`;
}

function shortKey(full: string): string {
  return full.startsWith(KEY_PREFIX) ? full.slice(KEY_PREFIX.length) : full;
}

function isAllowedKey(short: string): boolean {
  return ALLOWED_KEY_PATTERNS.some((re) => re.test(short));
}

function categoryFromShortKey(short: string): ConsentCategory {
  return short.startsWith('necessary:') ? 'necessary' : 'functional';
}

function defaultTtl(short: string): number {
  // Try exact match first, then prefix match (for wildcard keys like haul-cache:*)
  if (DEFAULT_TTLS[short]) return DEFAULT_TTLS[short];
  const prefix = short.replace(/:[^:]+$/, '');
  return DEFAULT_TTLS[prefix] ?? 7 * 24 * 60 * 60 * 1000;
}

function isPwsKey(key: string): boolean {
  return key.startsWith(KEY_PREFIX);
}

function totalPwsBytes(): number {
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && isPwsKey(k)) {
      total += (localStorage.getItem(k) ?? '').length * 2; // UTF-16
    }
  }
  return total;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Read a value.  Returns null if missing, expired, or corrupted.
 * Expired entries are auto-deleted.
 */
export function pwsGet<T>(shortKeyStr: string): T | null {
  if (!isStorageAvailable()) return null;

  const raw = localStorage.getItem(fullKey(shortKeyStr));
  if (raw === null) return null;

  try {
    const entry: StoredEntry<T> = JSON.parse(raw);
    if (new Date(entry.expiresAt) <= new Date()) {
      localStorage.removeItem(fullKey(shortKeyStr));
      return null;
    }
    return entry.v;
  } catch {
    // Corrupted — clean up
    localStorage.removeItem(fullKey(shortKeyStr));
    return null;
  }
}

export interface PwsSetOptions {
  category?: ConsentCategory;
  ttlMs?: number;
}

/**
 * Write a value.  Returns true on success.
 *
 * Fails silently (returns false) if:
 * - storage unavailable
 * - key not in allowlist
 * - consent not granted for category
 * - entry exceeds MAX_ENTRY_BYTES
 * - total would exceed MAX_TOTAL_BYTES
 */
export function pwsSet<T>(
  shortKeyStr: string,
  value: T,
  opts: PwsSetOptions = {},
): boolean {
  if (!isStorageAvailable()) return false;
  if (!isAllowedKey(shortKeyStr)) return false;

  const cat = opts.category ?? categoryFromShortKey(shortKeyStr);
  if (!_hasConsentFor(cat)) return false;

  const entry: StoredEntry<T> = {
    v: value,
    expiresAt: new Date(Date.now() + (opts.ttlMs ?? defaultTtl(shortKeyStr))).toISOString(),
    cat,
    ver: 1,
  };

  const json = JSON.stringify(entry);
  const bytes = json.length * 2;
  if (bytes > MAX_ENTRY_BYTES) return false;

  // Check total budget (subtract existing key size if overwriting)
  const existingRaw = localStorage.getItem(fullKey(shortKeyStr));
  const existingBytes = existingRaw ? existingRaw.length * 2 : 0;
  if (totalPwsBytes() - existingBytes + bytes > MAX_TOTAL_BYTES) return false;

  try {
    localStorage.setItem(fullKey(shortKeyStr), json);
    return true;
  } catch {
    return false;
  }
}

/** Remove a single key. */
export function pwsRemove(shortKeyStr: string): void {
  if (!isStorageAvailable()) return;
  localStorage.removeItem(fullKey(shortKeyStr));
}

/** Remove all keys in a given category. */
export function pwsPurgeCategory(cat: ConsentCategory): void {
  if (!isStorageAvailable()) return;
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && isPwsKey(k)) {
      const short = shortKey(k);
      if (categoryFromShortKey(short) === cat) {
        toRemove.push(k);
      }
    }
  }
  toRemove.forEach((k) => localStorage.removeItem(k));
}

/** Remove every pws:* key. */
export function pwsPurgeAll(): void {
  if (!isStorageAvailable()) return;
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && isPwsKey(k)) toRemove.push(k);
  }
  toRemove.forEach((k) => localStorage.removeItem(k));
}

/** Iterate all pws:* keys and remove expired ones. */
export function pwsPruneExpired(): void {
  if (!isStorageAvailable()) return;
  const now = new Date();
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (!k || !isPwsKey(k)) continue;
    const raw = localStorage.getItem(k);
    if (!raw) continue;
    try {
      const entry: StoredEntry<unknown> = JSON.parse(raw);
      if (new Date(entry.expiresAt) <= now) {
        localStorage.removeItem(k);
      }
    } catch {
      // Corrupted — remove
      localStorage.removeItem(k);
    }
  }
}

/** List all pws:* keys with metadata. */
export function pwsListKeys(): KeyInfo[] {
  if (!isStorageAvailable()) return [];
  const keys: KeyInfo[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !isPwsKey(k)) continue;
    const raw = localStorage.getItem(k);
    if (!raw) continue;
    try {
      const entry: StoredEntry<unknown> = JSON.parse(raw);
      keys.push({
        key: shortKey(k),
        category: entry.cat,
        expiresAt: entry.expiresAt,
        sizeBytes: raw.length * 2,
      });
    } catch {
      // skip corrupted
    }
  }
  return keys;
}

/** Export all pws:* data as a JSON string. */
export function pwsExportAll(): string {
  if (!isStorageAvailable()) return '{}';
  const data: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !isPwsKey(k)) continue;
    const raw = localStorage.getItem(k);
    if (!raw) continue;
    try {
      data[shortKey(k)] = JSON.parse(raw);
    } catch {
      // skip corrupted
    }
  }
  return JSON.stringify(data, null, 2);
}
