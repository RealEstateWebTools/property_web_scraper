/**
 * API Key Management Service
 *
 * Manages per-user API keys stored in KV as SHA-256 hashes.
 * Key format: `pws_live_{32 hex chars}` (44 chars total)
 *
 * KV schema:
 *   "apikey:{sha256hash}" → ApiKeyRecord
 *   "user:{userId}"       → UserRecord
 */

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

let kv: any = null;

/** In-memory fallback for dev/testing when KV is unavailable. */
const memStore = new Map<string, string>();

export function initUsersKV(kvNamespace: any): void {
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
 * After this, only the SHA-256 hash is stored.
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
  await kvPut(`apikey:${hash}`, JSON.stringify(record));

  // Update user record
  const user = await getUser(userId);
  if (user) {
    user.keyHashes.push(hash);
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
 */
export async function revokeApiKey(keyHash: string): Promise<boolean> {
  const json = await kvGet(`apikey:${keyHash}`);
  if (!json) return false;

  const record: ApiKeyRecord = JSON.parse(json);
  record.active = false;
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
  await kvPut(`user:${userId}`, JSON.stringify(user));
  return user;
}

/**
 * Get a user by ID.
 */
export async function getUser(userId: string): Promise<UserRecord | null> {
  const json = await kvGet(`user:${userId}`);
  if (!json) return null;
  return JSON.parse(json);
}

/**
 * Update a user's tier (e.g., after Stripe subscription change).
 */
export async function updateUserTier(userId: string, tier: SubscriptionTier): Promise<boolean> {
  const user = await getUser(userId);
  if (!user) return false;
  user.tier = tier;
  await kvPut(`user:${userId}`, JSON.stringify(user));
  return true;
}

/**
 * Set a user's Stripe customer ID.
 */
export async function setStripeCustomerId(userId: string, stripeCustomerId: string): Promise<boolean> {
  const user = await getUser(userId);
  if (!user) return false;
  user.stripeCustomerId = stripeCustomerId;
  await kvPut(`user:${userId}`, JSON.stringify(user));
  return true;
}
