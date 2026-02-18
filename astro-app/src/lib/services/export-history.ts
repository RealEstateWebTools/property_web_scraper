/**
 * Export History Service
 * Tracks export activity with KV-backed persistence and in-memory fallback.
 */

export interface ExportHistoryEntry {
  id: string;
  userId: string;
  format: string;
  listingCount: number;
  filename: string;
  timestamp: number;
}

const HISTORY_TTL = 30 * 24 * 60 * 60; // 30 days in seconds
const MAX_MEMORY_ENTRIES = 200;

let kv: any = null;
const memoryStore: ExportHistoryEntry[] = [];

export function initExportHistoryKV(kvNamespace: any): void {
  kv = kvNamespace ?? null;
}

function generateEntryId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export async function recordExport(
  userId: string,
  format: string,
  listingCount: number,
  filename: string,
): Promise<ExportHistoryEntry> {
  const entry: ExportHistoryEntry = {
    id: generateEntryId(),
    userId,
    format,
    listingCount,
    filename,
    timestamp: Date.now(),
  };

  // In-memory store
  memoryStore.unshift(entry);
  if (memoryStore.length > MAX_MEMORY_ENTRIES) {
    memoryStore.length = MAX_MEMORY_ENTRIES;
  }

  // KV persistence
  if (kv) {
    const key = `export-history:${userId}:${entry.timestamp}`;
    await kv.put(key, JSON.stringify(entry), { expirationTtl: HISTORY_TTL });

    // Update user's history index
    const indexKey = `export-history-index:${userId}`;
    const existingIndex = await kv.get(indexKey, 'json') as string[] | null;
    const index = existingIndex || [];
    index.unshift(key);
    if (index.length > MAX_MEMORY_ENTRIES) index.length = MAX_MEMORY_ENTRIES;
    await kv.put(indexKey, JSON.stringify(index), { expirationTtl: HISTORY_TTL });
  }

  return entry;
}

export async function getExportHistory(
  userId?: string,
  limit = 50,
): Promise<ExportHistoryEntry[]> {
  // If KV is available and user specified, try KV first
  if (kv && userId) {
    const indexKey = `export-history-index:${userId}`;
    const index = await kv.get(indexKey, 'json') as string[] | null;
    if (index && index.length > 0) {
      const entries: ExportHistoryEntry[] = [];
      for (const key of index.slice(0, limit)) {
        const entry = await kv.get(key, 'json') as ExportHistoryEntry | null;
        if (entry) entries.push(entry);
      }
      return entries;
    }
  }

  // Fall back to in-memory store
  let entries = memoryStore;
  if (userId) {
    entries = entries.filter(e => e.userId === userId);
  }
  return entries.slice(0, limit);
}

export async function getAllExportHistory(limit = 100): Promise<ExportHistoryEntry[]> {
  // In-memory store has all users' entries combined
  return memoryStore.slice(0, limit);
}

export function clearExportHistory(): void {
  memoryStore.length = 0;
}
