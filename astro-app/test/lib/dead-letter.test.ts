/**
 * Tests for dead-letter queue — record, retrieve, evict, and clear.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordDeadLetter,
  getDeadLetters,
  getDeadLetterCount,
  clearDeadLetter,
  clearAllDeadLetters,
  resetDeadLetterStore,
  type DeadLetterInput,
} from '../../src/lib/services/dead-letter.js';

function makeEntry(overrides: Partial<DeadLetterInput> = {}): DeadLetterInput {
  return {
    source: 'webhook',
    operation: 'POST https://example.com/hook',
    error: 'HTTP 503',
    context: { webhookId: 'wh_123' },
    attempts: 3,
    ...overrides,
  };
}

beforeEach(() => {
  resetDeadLetterStore();
});

describe('recordDeadLetter', () => {
  it('stores an entry and assigns id + timestamp', async () => {
    const entry = await recordDeadLetter(makeEntry());
    expect(entry.id).toMatch(/^dlq:/);
    expect(entry.timestamp).toBeTruthy();
    expect(entry.source).toBe('webhook');
    expect(entry.operation).toBe('POST https://example.com/hook');
    expect(entry.error).toBe('HTTP 503');
    expect(entry.attempts).toBe(3);
  });

  it('is retrievable via getDeadLetters', async () => {
    await recordDeadLetter(makeEntry({ operation: 'op-1' }));
    await recordDeadLetter(makeEntry({ operation: 'op-2' }));

    const entries = await getDeadLetters();
    expect(entries).toHaveLength(2);
    // Newest first
    expect(entries[0].operation).toBe('op-2');
    expect(entries[1].operation).toBe('op-1');
  });
});

describe('getDeadLetterCount', () => {
  it('returns 0 when empty', async () => {
    expect(await getDeadLetterCount()).toBe(0);
  });

  it('returns correct count', async () => {
    await recordDeadLetter(makeEntry());
    await recordDeadLetter(makeEntry());
    await recordDeadLetter(makeEntry());
    expect(await getDeadLetterCount()).toBe(3);
  });
});

describe('getDeadLetters limit', () => {
  it('respects limit parameter', async () => {
    for (let i = 0; i < 10; i++) {
      await recordDeadLetter(makeEntry({ operation: `op-${i}` }));
    }
    const entries = await getDeadLetters(3);
    expect(entries).toHaveLength(3);
    // Newest first
    expect(entries[0].operation).toBe('op-9');
  });
});

describe('FIFO eviction', () => {
  it('evicts oldest entries when exceeding 500', async () => {
    // Record 502 entries
    for (let i = 0; i < 502; i++) {
      await recordDeadLetter(makeEntry({ operation: `op-${i}` }));
    }

    const count = await getDeadLetterCount();
    expect(count).toBe(500);

    // Oldest two (op-0, op-1) should be evicted
    const entries = await getDeadLetters(500);
    const ops = entries.map(e => e.operation);
    expect(ops).not.toContain('op-0');
    expect(ops).not.toContain('op-1');
    expect(ops).toContain('op-2');
    expect(ops).toContain('op-501');
  });
});

describe('clearDeadLetter', () => {
  it('removes a single entry by ID', async () => {
    const e1 = await recordDeadLetter(makeEntry({ operation: 'op-1' }));
    await recordDeadLetter(makeEntry({ operation: 'op-2' }));

    const removed = await clearDeadLetter(e1.id);
    expect(removed).toBe(true);

    const entries = await getDeadLetters();
    expect(entries).toHaveLength(1);
    expect(entries[0].operation).toBe('op-2');
  });

  it('returns false for non-existent ID', async () => {
    const removed = await clearDeadLetter('dlq:nonexistent');
    expect(removed).toBe(false);
  });
});

describe('clearAllDeadLetters', () => {
  it('wipes the entire queue', async () => {
    await recordDeadLetter(makeEntry());
    await recordDeadLetter(makeEntry());
    await clearAllDeadLetters();

    expect(await getDeadLetterCount()).toBe(0);
    expect(await getDeadLetters()).toHaveLength(0);
  });
});
