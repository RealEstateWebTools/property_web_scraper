import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateApiKey,
  validateApiKey,
  revokeApiKey,
  revokeApiKeyByPrefix,
  listUserKeys,
  createUser,
  getUser,
  updateUserTier,
  resetApiKeyStore,
} from '../../src/lib/services/api-key-service.js';

describe('api-key-service', () => {
  beforeEach(() => {
    resetApiKeyStore();
  });

  // ─── Key generation ─────────────────────────────────────

  describe('generateApiKey', () => {
    it('generates a key with pws_live_ prefix', async () => {
      await createUser('user-1', 'test@example.com');
      const { rawKey, prefix } = await generateApiKey('user-1');
      expect(rawKey).toMatch(/^pws_live_[0-9a-f]{32}$/);
      expect(rawKey.length).toBe(41);
      expect(prefix).toBe(rawKey.slice(0, 12));
    });

    it('generates unique keys', async () => {
      await createUser('user-1', 'test@example.com');
      const { rawKey: key1 } = await generateApiKey('user-1', 'key1');
      const { rawKey: key2 } = await generateApiKey('user-1', 'key2');
      expect(key1).not.toBe(key2);
    });

    it('adds key hash to user record', async () => {
      await createUser('user-1', 'test@example.com');
      await generateApiKey('user-1');
      const user = await getUser('user-1');
      expect(user!.keyHashes).toHaveLength(1);
    });
  });

  // ─── Key validation ─────────────────────────────────────

  describe('validateApiKey', () => {
    it('validates a freshly generated key', async () => {
      await createUser('user-1', 'test@example.com', 'starter');
      const { rawKey } = await generateApiKey('user-1');
      const result = await validateApiKey(rawKey);
      expect(result).not.toBeNull();
      expect(result!.userId).toBe('user-1');
      expect(result!.tier).toBe('starter');
    });

    it('returns null for unknown key', async () => {
      const result = await validateApiKey('pws_live_0000000000000000000000000000abcd');
      expect(result).toBeNull();
    });

    it('returns null for empty/non-prefixed key', async () => {
      expect(await validateApiKey('')).toBeNull();
      expect(await validateApiKey('some-random-key')).toBeNull();
    });

    it('inherits user tier, not the key creation-time tier', async () => {
      await createUser('user-1', 'test@example.com', 'free');
      const { rawKey } = await generateApiKey('user-1');

      // Upgrade user
      await updateUserTier('user-1', 'pro');

      const result = await validateApiKey(rawKey);
      expect(result!.tier).toBe('pro');
    });
  });

  describe('validation caching', () => {
    it('returns cached result on repeated validation', async () => {
      await createUser('cache-user', 'cache@test.com', 'pro');
      const { rawKey } = await generateApiKey('cache-user');

      const first = await validateApiKey(rawKey);
      const second = await validateApiKey(rawKey);
      expect(first).not.toBeNull();
      expect(second).not.toBeNull();
      expect(first!.userId).toBe(second!.userId);
      expect(first!.tier).toBe('pro');
    });

    it('cache is cleared by resetApiKeyStore', async () => {
      await createUser('cache-user', 'cache@test.com');
      const { rawKey } = await generateApiKey('cache-user');

      expect(await validateApiKey(rawKey)).not.toBeNull();
      resetApiKeyStore();
      // After reset, key data is gone so validation fails
      expect(await validateApiKey(rawKey)).toBeNull();
    });

    it('revocation invalidates cache for that key', async () => {
      await createUser('cache-user', 'cache@test.com');
      const { rawKey, hash } = await generateApiKey('cache-user');

      // Validate to populate cache
      expect(await validateApiKey(rawKey)).not.toBeNull();

      // Revoke
      await revokeApiKey(hash);

      // Should return null despite having been cached
      expect(await validateApiKey(rawKey)).toBeNull();
    });
  });

  // ─── Key revocation ─────────────────────────────────────

  describe('revokeApiKey', () => {
    it('revoked key cannot be validated', async () => {
      await createUser('user-1', 'test@example.com');
      const { rawKey, hash } = await generateApiKey('user-1');
      await revokeApiKey(hash);
      const result = await validateApiKey(rawKey);
      expect(result).toBeNull();
    });

    it('returns false for unknown hash', async () => {
      const result = await revokeApiKey('nonexistent-hash');
      expect(result).toBe(false);
    });
  });

  describe('revokeApiKeyByPrefix', () => {
    it('revokes key by prefix', async () => {
      await createUser('user-1', 'test@example.com');
      const { rawKey, prefix } = await generateApiKey('user-1');
      const revoked = await revokeApiKeyByPrefix('user-1', prefix);
      expect(revoked).toBe(true);
      expect(await validateApiKey(rawKey)).toBeNull();
    });

    it('returns false for unknown user', async () => {
      const result = await revokeApiKeyByPrefix('no-user', 'pws_live_abc');
      expect(result).toBe(false);
    });
  });

  // ─── Key listing ────────────────────────────────────────

  describe('listUserKeys', () => {
    it('lists all keys for a user', async () => {
      await createUser('user-1', 'test@example.com');
      await generateApiKey('user-1', 'key-a');
      await generateApiKey('user-1', 'key-b');
      const keys = await listUserKeys('user-1');
      expect(keys).toHaveLength(2);
      expect(keys[0].label).toBe('key-a');
      expect(keys[1].label).toBe('key-b');
    });

    it('shows active/revoked status', async () => {
      await createUser('user-1', 'test@example.com');
      const { hash } = await generateApiKey('user-1');
      await revokeApiKey(hash);
      const keys = await listUserKeys('user-1');
      expect(keys[0].active).toBe(false);
    });

    it('returns empty array for unknown user', async () => {
      const keys = await listUserKeys('no-user');
      expect(keys).toEqual([]);
    });
  });

  // ─── User management ───────────────────────────────────

  describe('user management', () => {
    it('creates and retrieves a user', async () => {
      const user = await createUser('user-1', 'test@example.com', 'free', 'Test');
      expect(user.userId).toBe('user-1');
      expect(user.tier).toBe('free');

      const retrieved = await getUser('user-1');
      expect(retrieved!.email).toBe('test@example.com');
    });

    it('updates user tier', async () => {
      await createUser('user-1', 'test@example.com', 'free');
      const updated = await updateUserTier('user-1', 'pro');
      expect(updated).toBe(true);

      const user = await getUser('user-1');
      expect(user!.tier).toBe('pro');
    });

    it('returns false when updating nonexistent user', async () => {
      const result = await updateUserTier('no-user', 'pro');
      expect(result).toBe(false);
    });

    it('returns null for nonexistent user', async () => {
      const user = await getUser('no-user');
      expect(user).toBeNull();
    });
  });
});
