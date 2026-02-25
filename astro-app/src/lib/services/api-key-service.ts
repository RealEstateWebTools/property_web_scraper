/**
 * API Key Management Service
 *
 * Manages per-user API keys and user records with Firestore persistence.
 * KV is used as a read-through cache only.
 *
 * Firestore schema:
 *   users/{userId} → UserRecord
 *   api_keys/{keyHash} → ApiKeyRecord
 *
 * KV schema (cache only):
 *   "apikey:{sha256hash}" → ApiKeyRecord
 *   "user:{userId}"       → UserRecord
 */

import type { KVNamespace } from './kv-types.js';
import { getClient, getCollectionPrefix } from '../firestore/client.js';
import type { FirestoreClient } from '../firestore/types.js';

// ─── Types ──────────────────────────────────────────────────────

export interface ApiKeyRecord {
  userId: string;
  tier: SubscriptionTier;
  label: string;
  active: boolean;
  createdAt: string;
  /** First 8 chars of the raw key, for display in "list keys" */
  prefix: string;
}

export interface UserRecord {
  userId: string;
  email: string;
  name?: string;
  tier: SubscriptionTier;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  /** SHA-256 hashes of all keys (active + revoked) */
  keyHashes: string[];
  createdAt: string;
}

export type SubscriptionTier = 'free' | 'starter' | 'pro' | 'enterprise';

export interface ValidatedKey {
  userId: string;
  tier: SubscriptionTier;
  label: string;
}

// ─── KV handle ──────────────────────────────────────────────────

let kv: KVNamespace | null = null;

/** In-memory fallback for dev/testing when KV is unavailable. */
const memStore = new Map<string, string>();

export function initUsersKV(kvNamespace: KVNamespace | null): void {
  kv = kvNamespace ?? null;
}

async function kvGet(key: string): Promise<string | null> {
  if (kv) return kv.get(key);
  return memStore.get(key) ?? null;
}

async function kvPut(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
  if (kv) return kv.put(key, value, options);
  memStore.set(key, value);
}

async function kvDelete(key: string): Promise<void> {
  if (kv) return kv.delete(key);
  memStore.delete(key);
}

/**
 * Persist user record to Firestore.
 * Falls back gracefully if Firestore is unavailable.
 */
async function persistUserToFirestore(user: UserRecord): Promise<void> {
  try {
    const client = await getClient();
    const prefix = getCollectionPrefix();
    await client.collection(`${prefix}users`).doc(user.userId).set(user as any);
  } catch (err) {
    // Firestore not available - continue with KV only (degraded mode)
    console.warn('[ApiKeyService] Firestore persist failed, using KV only:', err instanceof Error ? err.message : String(err));
  }
}

/**
 * Fetch user record from Firestore.
 * Falls back to KV if Firestore is unavailable.
 */
async function fetchUserFromFirestore(userId: string): Promise<UserRecord | null> {
  try {
    const client = await getClient();
    const prefix = getCollectionPrefix();
    const docSnap = await client.collection(`${prefix}users`).doc(userId).get();
    if (docSnap.exists) {
      return docSnap.data() as unknown as UserRecord;
    }
  } catch (err) {
    // Firestore not available - continue with KV only
    console.warn('[ApiKeyService] Firestore fetch failed, falling back to KV');
  }
  return null;
}

/**
 * List all users from Firestore.
 * Falls back to KV if Firestore is unavailable.
 */
async function listUsersFromFirestore(): Promise<UserRecord[]> {
  try {
    const client = await getClient();
    const prefix = getCollectionPrefix();
    const snapshot = await client.collection(`${prefix}users`).get();
    return snapshot.docs.map(doc => doc.data() as unknown as UserRecord);
  } catch (err) {
    // Firestore not available - fall back to KV
    console.warn('[ApiKeyService] Firestore list failed, falling back to KV');
  }
  return [];
}

/**
 * Persist API key record to Firestore.
 */
async function persistKeyToFirestore(keyHash: string, record: ApiKeyRecord): Promise<void> {
  try {
    const client = await getClient();
    const prefix = getCollectionPrefix();
    await client.collection(`${prefix}api_keys`).doc(keyHash).set(record as any);
  } catch (err) {
    console.warn('[ApiKeyService] Firestore key persist failed, using KV only');
  }
}

/**
 * In-memory cache for validated API keys.
 * Avoids KV read on every authenticated request.
 * TTL: 5 minutes — key revocations take up to 5 min to propagate.
 */
const validationCache = new Map<string, { result: ValidatedKey | null; expiresAt: number }>();
const VALIDATION_CACHE_TTL_MS = 5 * 60 * 1000;

/** Clear all in-memory data. For testing only. */
export function resetApiKeyStore(): void {
  memStore.clear();
  validationCache.clear();
}

// ─── Hashing ────────────────────────────────────────────────────

async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateRandomHex(bytes: number): string {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Key generation ─────────────────────────────────────────────

/**
 * Generate a new API key for a user.
 *
 * Returns the raw key — this is the ONLY time it's available.
 * After this, only the SHA-256 hash is stored in Firestore + KV.
 */
export async function generateApiKey(
  userId: string,
  label = 'default',
): Promise<{ rawKey: string; prefix: string; hash: string }> {
  const rawKey = `pws_live_${generateRandomHex(16)}`;
  const prefix = rawKey.slice(0, 12);
  const hash = await sha256(rawKey);

  // Store the key record
  const record: ApiKeyRecord = {
    userId,
    tier: 'free', // Tier comes from the user record; keys inherit it at validation time
    label,
    active: true,
    createdAt: new Date().toISOString(),
    prefix,
  };

  // Persist to both Firestore and KV
  await persistKeyToFirestore(hash, record);
  await kvPut(`apikey:${hash}`, JSON.stringify(record));

  // Update user record
  const user = await getUser(userId);
  if (user) {
    user.keyHashes.push(hash);
    await persistUserToFirestore(user);
    await kvPut(`user:${userId}`, JSON.stringify(user));
  }

  return { rawKey, prefix, hash };
}

// ─── Key validation ─────────────────────────────────────────────

/**
 * Validate a raw API key.
 *
 * Hashes the input, looks up in KV, and returns user info if valid.
 * Returns null for invalid/revoked/missing keys.
 * Results are cached in memory for 5 minutes to reduce KV reads.
 */
export async function validateApiKey(rawKey: string): Promise<ValidatedKey | null> {
  if (!rawKey || !rawKey.startsWith('pws_live_')) {
    return null;
  }

  const hash = await sha256(rawKey);

  // Check cache first
  const cached = validationCache.get(hash);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  const json = await kvGet(`apikey:${hash}`);
  if (!json) {
    validationCache.set(hash, { result: null, expiresAt: Date.now() + VALIDATION_CACHE_TTL_MS });
    return null;
  }

  const record: ApiKeyRecord = JSON.parse(json);
  if (!record.active) {
    validationCache.set(hash, { result: null, expiresAt: Date.now() + VALIDATION_CACHE_TTL_MS });
    return null;
  }

  // Get the user's current tier (not the tier stored on the key)
  const user = await getUser(record.userId);
  const tier = user?.tier ?? record.tier;

  const result: ValidatedKey = { userId: record.userId, tier, label: record.label };
  validationCache.set(hash, { result, expiresAt: Date.now() + VALIDATION_CACHE_TTL_MS });
  return result;
}

// ─── Key revocation ─────────────────────────────────────────────

/**
 * Revoke an API key by its hash.
 * Soft-delete: marks inactive so it can't be used but history is preserved.
 * Persists to Firestore.
 */
export async function revokeApiKey(keyHash: string): Promise<boolean> {
  const json = await kvGet(`apikey:${keyHash}`);
  if (!json) return false;

  const record: ApiKeyRecord = JSON.parse(json);
  record.active = false;

  // Persist to Firestore
  await persistKeyToFirestore(keyHash, record);

  // Update KV
  await kvPut(`apikey:${keyHash}`, JSON.stringify(record));

  // Invalidate validation cache for this key
  validationCache.delete(keyHash);
  return true;
}

/**
 * Revoke a key by prefix (first 12 chars of raw key).
 * Looks up the user's keys to find the matching hash.
 */
export async function revokeApiKeyByPrefix(userId: string, prefix: string): Promise<boolean> {
  const user = await getUser(userId);
  if (!user) return false;

  for (const hash of user.keyHashes) {
    const json = await kvGet(`apikey:${hash}`);
    if (!json) continue;
    const record: ApiKeyRecord = JSON.parse(json);
    if (record.prefix === prefix && record.active) {
      record.active = false;
      await kvPut(`apikey:${hash}`, JSON.stringify(record));
      return true;
    }
  }
  return false;
}

// ─── Key listing ────────────────────────────────────────────────

/**
 * List all API keys for a user (metadata only, never raw keys).
 */
export async function listUserKeys(userId: string): Promise<Array<{
  prefix: string;
  label: string;
  active: boolean;
  createdAt: string;
  hash: string;
}>> {
  const user = await getUser(userId);
  if (!user) return [];

  const keys: Array<{ prefix: string; label: string; active: boolean; createdAt: string; hash: string }> = [];
  for (const hash of user.keyHashes) {
    const json = await kvGet(`apikey:${hash}`);
    if (!json) continue;
    const record: ApiKeyRecord = JSON.parse(json);
    keys.push({
      prefix: record.prefix,
      label: record.label,
      active: record.active,
      createdAt: record.createdAt,
      hash,
    });
  }
  return keys;
}

// ─── User management ────────────────────────────────────────────

/**
 * Create a user record.
 * Persists to Firestore with KV cache fallback.
 */
export async function createUser(
  userId: string,
  email: string,
  tier: SubscriptionTier = 'free',
  name?: string,
): Promise<UserRecord> {
  const user: UserRecord = {
    userId,
    email,
    name,
    tier,
    keyHashes: [],
    createdAt: new Date().toISOString(),
  };

  // Persist to Firestore (primary)
  await persistUserToFirestore(user);

  // Also cache in KV
  await kvPut(`user:${userId}`, JSON.stringify(user));

  return user;
}

/**
 * Get a user by ID.
 * Read path: Firestore → KV cache
 */
export async function getUser(userId: string): Promise<UserRecord | null> {
  // Try Firestore first
  const firestoreUser = await fetchUserFromFirestore(userId);
  if (firestoreUser) {
    // Cache in KV for next time
    await kvPut(`user:${userId}`, JSON.stringify(firestoreUser));
    return firestoreUser;
  }

  // Fall back to KV
  const json = await kvGet(`user:${userId}`);
  if (!json) return null;
  return JSON.parse(json);
}

/**
 * Update a user's tier (e.g., after Stripe subscription change).
 * Persists to Firestore with KV cache.
 */
export async function updateUserTier(userId: string, tier: SubscriptionTier): Promise<boolean> {
  const user = await getUser(userId);
  if (!user) return false;
  user.tier = tier;

  // Persist to Firestore
  await persistUserToFirestore(user);

  // Update KV cache
  await kvPut(`user:${userId}`, JSON.stringify(user));
  return true;
}

/**
 * Set a user's Stripe customer ID.
 * Persists to Firestore with KV cache.
 */
export async function setStripeCustomerId(userId: string, stripeCustomerId: string): Promise<boolean> {
  const user = await getUser(userId);
  if (!user) return false;
  user.stripeCustomerId = stripeCustomerId;

  // Persist to Firestore
  await persistUserToFirestore(user);

  // Update KV cache
  await kvPut(`user:${userId}`, JSON.stringify(user));
  return true;
}

/**
 * List all users.
 * Reads from Firestore first, falls back to KV.
 */
export async function listUsers(): Promise<UserRecord[]> {
  // Try Firestore first
  const firestoreUsers = await listUsersFromFirestore();
  if (firestoreUsers.length > 0) {
    // Cache in KV
    for (const user of firestoreUsers) {
      await kvPut(`user:${user.userId}`, JSON.stringify(user));
    }
    return firestoreUsers;
  }

  // Fall back to KV
  const users: UserRecord[] = [];
  if (kv) {
    const list = await kv.list({ prefix: 'user:' });
    for (const key of list.keys) {
      const json = await kvGet(key.name);
      if (json) {
        try {
          users.push(JSON.parse(json));
        } catch {
          // Skip corrupt entries
        }
      }
    }
  } else {
    // In-memory fallback
    for (const [k, v] of memStore) {
      if (k.startsWith('user:')) {
        try {
          users.push(JSON.parse(v));
        } catch {
          // Skip corrupt entries
        }
      }
    }
  }
  return users;
}

/**
 * Delete a user and all their API keys.
 */
export async function deleteUser(userId: string): Promise<boolean> {
  const user = await getUser(userId);
  if (!user) return false;

  // Revoke all keys first
  for (const hash of user.keyHashes) {
    await kvDelete(`apikey:${hash}`);
    validationCache.delete(hash);
  }

  // Delete user record
  await kvDelete(`user:${userId}`);
  return true;
}
