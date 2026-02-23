/**
 * Tests for retention-cleanup.ts — probabilistic cleanup, dry-run mode,
 * getLastCleanupResult, and maybeTriggerCleanup.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks (declared before imports so vi.mock hoisting works) ─────────────────

vi.mock('../../src/lib/firestore/client.js', () => ({
  getClient: vi.fn(),
  getCollectionPrefix: vi.fn().mockReturnValue('test_'),
}));

vi.mock('../../src/lib/services/retention-config.js', () => ({
  getRetentionConfig: vi.fn(),
  getTtlForCollection: vi.fn(),
}));

vi.mock('../../src/lib/services/activity-logger.js', () => ({
  logActivity: vi.fn(),
}));

import {
  getLastCleanupResult,
  runCleanup,
  maybeTriggerCleanup,
} from '../../src/lib/services/retention-cleanup.js';
import { getClient } from '../../src/lib/firestore/client.js';
import { getRetentionConfig, getTtlForCollection } from '../../src/lib/services/retention-config.js';

const mockGetClient = vi.mocked(getClient);
const mockGetRetentionConfig = vi.mocked(getRetentionConfig);
const mockGetTtlForCollection = vi.mocked(getTtlForCollection);

// Helper to build a fake Firestore-like client
function makeFirestoreClient(docs: Array<Record<string, unknown>> = []) {
  const docRefs = docs.map(data => ({
    data: () => data,
    ref: { delete: vi.fn().mockResolvedValue(undefined) },
  }));
  return {
    collection: vi.fn().mockReturnValue({
      get: vi.fn().mockResolvedValue({ docs: docRefs }),
    }),
  };
}

function makeRetentionConfig(policies: Array<{ collectionName: string }> = []) {
  return {
    policies,
    defaultTtlDays: 30,
  };
}

const EXPIRED_TS = Date.now() - 40 * 24 * 60 * 60 * 1000; // 40 days ago
const FRESH_TS = Date.now() - 5 * 24 * 60 * 60 * 1000;   // 5 days ago

beforeEach(() => {
  vi.resetAllMocks();
});

describe('getLastCleanupResult', () => {
  it('returns the result of the most recent runCleanup', async () => {
    const fakeClient = makeFirestoreClient([]);
    mockGetClient.mockResolvedValue(fakeClient as any);
    mockGetRetentionConfig.mockResolvedValue(makeRetentionConfig([]) as any);

    await runCleanup();

    const result = getLastCleanupResult();
    expect(result).not.toBeNull();
    expect(result!.collectionsProcessed).toBe(0);
  });
});

describe('runCleanup', () => {
  it('returns a CleanupResult with correct structure', async () => {
    mockGetClient.mockResolvedValue(makeFirestoreClient([]) as any);
    mockGetRetentionConfig.mockResolvedValue(makeRetentionConfig([]) as any);

    const result = await runCleanup();

    expect(result).toMatchObject({
      dryRun: false,
      collectionsProcessed: 0,
      totalDocumentsDeleted: 0,
      details: [],
    });
    expect(typeof result.timestamp).toBe('number');
    expect(typeof result.durationMs).toBe('number');
  });

  it('dry-run mode does not delete documents', async () => {
    const expiredDoc = {
      data: () => ({ timestamp: EXPIRED_TS }),
      ref: { delete: vi.fn().mockResolvedValue(undefined) },
    };
    const fakeClient = {
      collection: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ docs: [expiredDoc] }),
      }),
    };
    mockGetClient.mockResolvedValue(fakeClient as any);
    mockGetRetentionConfig.mockResolvedValue(
      makeRetentionConfig([{ collectionName: 'extractions' }]) as any,
    );
    mockGetTtlForCollection.mockReturnValue(30);

    const result = await runCleanup({ dryRun: true });

    expect(result.dryRun).toBe(true);
    expect(expiredDoc.ref.delete).not.toHaveBeenCalled();
    expect(result.details[0].expiredDocs).toBe(1);
    expect(result.details[0].deletedDocs).toBe(0);
  });

  it('deletes expired documents in live mode', async () => {
    const expiredDoc = {
      data: () => ({ timestamp: EXPIRED_TS }),
      ref: { delete: vi.fn().mockResolvedValue(undefined) },
    };
    const freshDoc = {
      data: () => ({ timestamp: FRESH_TS }),
      ref: { delete: vi.fn() },
    };
    const fakeClient = {
      collection: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ docs: [expiredDoc, freshDoc] }),
      }),
    };
    mockGetClient.mockResolvedValue(fakeClient as any);
    mockGetRetentionConfig.mockResolvedValue(
      makeRetentionConfig([{ collectionName: 'extractions' }]) as any,
    );
    mockGetTtlForCollection.mockReturnValue(30);

    const result = await runCleanup({ dryRun: false });

    expect(expiredDoc.ref.delete).toHaveBeenCalledTimes(1);
    expect(freshDoc.ref.delete).not.toHaveBeenCalled();
    expect(result.totalDocumentsDeleted).toBe(1);
    expect(result.details[0].expiredDocs).toBe(1);
    expect(result.details[0].deletedDocs).toBe(1);
  });

  it('skips collections with null TTL', async () => {
    const fakeClient = makeFirestoreClient([{ timestamp: EXPIRED_TS }]);
    mockGetClient.mockResolvedValue(fakeClient as any);
    mockGetRetentionConfig.mockResolvedValue(
      makeRetentionConfig([{ collectionName: 'extractions' }]) as any,
    );
    mockGetTtlForCollection.mockReturnValue(null);

    const result = await runCleanup();

    expect(result.collectionsProcessed).toBe(0);
    expect(result.details).toHaveLength(0);
  });

  it('handles Firestore getClient failure gracefully', async () => {
    mockGetClient.mockRejectedValue(new Error('Firestore unavailable'));
    mockGetRetentionConfig.mockResolvedValue(
      makeRetentionConfig([{ collectionName: 'extractions' }]) as any,
    );
    mockGetTtlForCollection.mockReturnValue(30);

    const result = await runCleanup();

    expect(result.totalDocumentsDeleted).toBe(0);
  });

  it('processes multiple collections', async () => {
    const expiredDoc1 = {
      data: () => ({ timestamp: EXPIRED_TS }),
      ref: { delete: vi.fn().mockResolvedValue(undefined) },
    };
    const expiredDoc2 = {
      data: () => ({ timestamp: EXPIRED_TS }),
      ref: { delete: vi.fn().mockResolvedValue(undefined) },
    };

    const fakeClient = {
      collection: vi.fn()
        .mockReturnValueOnce({ get: vi.fn().mockResolvedValue({ docs: [expiredDoc1] }) })
        .mockReturnValueOnce({ get: vi.fn().mockResolvedValue({ docs: [expiredDoc2] }) }),
    };
    mockGetClient.mockResolvedValue(fakeClient as any);
    mockGetRetentionConfig.mockResolvedValue(
      makeRetentionConfig([
        { collectionName: 'col1' },
        { collectionName: 'col2' },
      ]) as any,
    );
    mockGetTtlForCollection.mockReturnValue(30);

    const result = await runCleanup({ dryRun: true });

    expect(result.collectionsProcessed).toBe(2);
    expect(result.details).toHaveLength(2);
  });

  it('uses created_at when timestamp field is absent', async () => {
    const expiredDoc = {
      data: () => ({ created_at: EXPIRED_TS }),
      ref: { delete: vi.fn().mockResolvedValue(undefined) },
    };
    const fakeClient = {
      collection: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ docs: [expiredDoc] }),
      }),
    };
    mockGetClient.mockResolvedValue(fakeClient as any);
    mockGetRetentionConfig.mockResolvedValue(
      makeRetentionConfig([{ collectionName: 'col1' }]) as any,
    );
    mockGetTtlForCollection.mockReturnValue(30);

    const result = await runCleanup({ dryRun: true });

    expect(result.details[0].expiredDocs).toBe(1);
  });

  it('does not mark docs without timestamp as expired', async () => {
    const noTimestampDoc = {
      data: () => ({ some_field: 'value' }),
      ref: { delete: vi.fn() },
    };
    const fakeClient = {
      collection: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ docs: [noTimestampDoc] }),
      }),
    };
    mockGetClient.mockResolvedValue(fakeClient as any);
    mockGetRetentionConfig.mockResolvedValue(
      makeRetentionConfig([{ collectionName: 'col1' }]) as any,
    );
    mockGetTtlForCollection.mockReturnValue(30);

    const result = await runCleanup({ dryRun: true });

    expect(result.details[0].expiredDocs).toBe(0);
  });
});

describe('maybeTriggerCleanup', () => {
  it('is callable without error', () => {
    // We cannot easily test the 1% probability, but we can assert it does not throw
    vi.spyOn(Math, 'random').mockReturnValue(1); // > CLEANUP_PROBABILITY, skips
    expect(() => maybeTriggerCleanup()).not.toThrow();
  });

  it('triggers cleanup when random is below threshold', async () => {
    // Force Math.random to 0 so it passes the 1% gate
    vi.spyOn(Math, 'random').mockReturnValue(0);
    mockGetClient.mockResolvedValue(makeFirestoreClient([]) as any);
    mockGetRetentionConfig.mockResolvedValue(makeRetentionConfig([]) as any);

    // Call maybeTriggerCleanup — it should fire-and-forget the cleanup
    maybeTriggerCleanup();

    // Give the event loop a tick for the promise to settle
    await new Promise(resolve => setTimeout(resolve, 0));

    // getLastCleanupResult should now be non-null
    expect(getLastCleanupResult()).not.toBeNull();
  });
});
