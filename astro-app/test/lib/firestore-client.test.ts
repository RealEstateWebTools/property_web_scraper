import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getClient, resetClient, getStorageStatus, setClient, getCollectionPrefix } from '../../src/lib/firestore/client.js';
import { InMemoryFirestoreClient } from '../../src/lib/firestore/in-memory-backend.js';

describe('Firestore Client', () => {
  beforeEach(() => {
    resetClient();
    // Re-inject the in-memory client used by test setup
    setClient(new InMemoryFirestoreClient());
  });

  describe('getClient', () => {
    it('returns a client instance', async () => {
      const client = await getClient();
      expect(client).toBeTruthy();
      expect(typeof client.collection).toBe('function');
      expect(typeof client.col).toBe('function');
      expect(typeof client.transaction).toBe('function');
    });

    it('returns the same client on subsequent calls', async () => {
      const client1 = await getClient();
      const client2 = await getClient();
      expect(client1).toBe(client2);
    });
  });

  describe('setClient', () => {
    it('allows injecting a custom client', async () => {
      const custom = new InMemoryFirestoreClient();
      setClient(custom);
      const client = await getClient();
      expect(client).toBe(custom);
    });
  });

  describe('resetClient', () => {
    it('clears the cached client', async () => {
      const client1 = await getClient();
      resetClient();
      setClient(new InMemoryFirestoreClient());
      const client2 = await getClient();
      expect(client1).not.toBe(client2);
    });
  });

  describe('getStorageStatus', () => {
    it('returns storage status object', () => {
      const status = getStorageStatus();
      expect(status).toHaveProperty('backend');
      expect(status).toHaveProperty('connected');
      expect(status).toHaveProperty('projectId');
      expect(status).toHaveProperty('error');
    });

    it('returns a copy (not a reference)', () => {
      const status1 = getStorageStatus();
      const status2 = getStorageStatus();
      expect(status1).toEqual(status2);
      expect(status1).not.toBe(status2);
    });
  });

  describe('getCollectionPrefix', () => {
    it('returns a string', () => {
      const prefix = getCollectionPrefix();
      expect(typeof prefix).toBe('string');
    });
  });

  describe('fallback behavior', () => {
    it('defaults to in-memory when no Firestore credentials are set', async () => {
      resetClient();
      // Without setting a client, getClient will create one based on env vars
      // In test environment, no GOOGLE_SERVICE_ACCOUNT_JSON is set
      const client = await getClient();
      expect(client).toBeInstanceOf(InMemoryFirestoreClient);
    });
  });
});
