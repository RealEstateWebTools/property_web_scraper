/**
 * dead-letter.ts — KV-backed dead-letter queue for fire-and-forget failures.
 *
 * Captures operations that failed after all retries so they can be
 * inspected and potentially replayed. Falls back to in-memory storage
 * when KV is unavailable.
 *
 * KV key patterns:
 *   dlq:{id}       → DeadLetterEntry JSON (30-day TTL)
 *   dlq-index      → string[] of entry IDs (FIFO, max 500)
 */

import type { KVNamespace } from './kv-types.js';
import { logActivity } from './activity-logger.js';

// ─── Types ───────────────────────────────────────────────────────

export type DeadLetterSource =
  | 'webhook'
  | 'firestore_write'
  | 'firestore_diagnostics'
  | 'kv_write'
  | 'price_history'
  | 'scrape_metadata'
  | 'usage';

export interface DeadLetterEntry {
  id: string;
  timestamp: string;
  source: DeadLetterSource;
  operation: string;
  error: string;
  context: Record<string, unknown>;
  attempts: number;
}

export type DeadLetterInput = Omit<DeadLetterEntry, 'id' | 'timestamp'>;

// ─── Storage ─────────────────────────────────────────────────────

let kv: KVNamespace | null = null;
const inMemoryStore = new Map<string, DeadLetterEntry>();
const inMemoryIndex: string[] = [];

const KV_PREFIX = 'dlq:';
const KV_INDEX = 'dlq-index';
const KV_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const MAX_ENTRIES = 500;

/**
 * Bind the KV namespace for persistent storage.
 */
export function initDeadLetterKV(kvNamespace: KVNamespace | null): void {
  kv = kvNamespace ?? null;
}

function generateId(): string {
  return `dlq:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Core Operations ─────────────────────────────────────────────

/**
 * Record a failed operation in the dead-letter queue.
 */
export async function recordDeadLetter(input: DeadLetterInput): Promise<DeadLetterEntry> {
  const entry: DeadLetterEntry = {
    ...input,
    id: generateId(),
    timestamp: new Date().toISOString(),
  };

  logActivity({
    level: 'error',
    category: 'system',
    message: `[DLQ] ${entry.source}: ${entry.operation} — ${entry.error}`,
  });

  if (kv) {
    await kv.put(`${KV_PREFIX}${entry.id}`, JSON.stringify(entry), { expirationTtl: KV_TTL_SECONDS });
    const index = await getIndex();
    index.push(entry.id);
    // FIFO eviction: remove oldest entries beyond the cap
    while (index.length > MAX_ENTRIES) {
      const evicted = index.shift()!;
      await kv.delete(`${KV_PREFIX}${evicted}`);
    }
    await kv.put(KV_INDEX, JSON.stringify(index), { expirationTtl: KV_TTL_SECONDS });
  } else {
    inMemoryStore.set(entry.id, entry);
    inMemoryIndex.push(entry.id);
    while (inMemoryIndex.length > MAX_ENTRIES) {
      const evicted = inMemoryIndex.shift()!;
      inMemoryStore.delete(evicted);
    }
  }

  return entry;
}

/**
 * Get recent dead-letter entries (newest first).
 */
export async function getDeadLetters(limit = 50): Promise<DeadLetterEntry[]> {
  if (kv) {
    const index = await getIndex();
    const sliced = index.slice(-limit).reverse(); // newest first
    const entries: DeadLetterEntry[] = [];
    for (const id of sliced) {
      const data = await kv.get(`${KV_PREFIX}${id}`, 'json');
      if (data) entries.push(data as DeadLetterEntry);
    }
    return entries;
  }

  // In-memory: return newest first
  const ids = inMemoryIndex.slice(-limit).reverse();
  return ids.map(id => inMemoryStore.get(id)!).filter(Boolean);
}

/**
 * Get the count of entries in the dead-letter queue.
 */
export async function getDeadLetterCount(): Promise<number> {
  if (kv) {
    const index = await getIndex();
    return index.length;
  }
  return inMemoryIndex.length;
}

/**
 * Remove a single dead-letter entry by ID.
 */
export async function clearDeadLetter(id: string): Promise<boolean> {
  if (kv) {
    const index = await getIndex();
    const pos = index.indexOf(id);
    if (pos === -1) return false;
    index.splice(pos, 1);
    await kv.put(KV_INDEX, JSON.stringify(index), { expirationTtl: KV_TTL_SECONDS });
    await kv.delete(`${KV_PREFIX}${id}`);
    return true;
  }

  const pos = inMemoryIndex.indexOf(id);
  if (pos === -1) return false;
  inMemoryIndex.splice(pos, 1);
  inMemoryStore.delete(id);
  return true;
}

/**
 * Wipe the entire dead-letter queue.
 */
export async function clearAllDeadLetters(): Promise<void> {
  if (kv) {
    const index = await getIndex();
    for (const id of index) {
      await kv.delete(`${KV_PREFIX}${id}`);
    }
    await kv.delete(KV_INDEX);
  }
  inMemoryStore.clear();
  inMemoryIndex.length = 0;
}

// ─── Helpers ─────────────────────────────────────────────────────

async function getIndex(): Promise<string[]> {
  if (kv) {
    const data = await kv.get(KV_INDEX, 'json');
    return (data as string[]) || [];
  }
  return [...inMemoryIndex];
}

/**
 * Reset in-memory state. For testing only.
 */
export function resetDeadLetterStore(): void {
  inMemoryStore.clear();
  inMemoryIndex.length = 0;
  kv = null;
}
