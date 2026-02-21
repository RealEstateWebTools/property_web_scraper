/**
 * Export History Service
 * Tracks export activity with Firestore persistence and in-memory fallback.
 *
 * Firestore collection: {prefix}export_history
 * Document ID: entry.id
 */

import { getClient, getCollectionPrefix } from '../firestore/client.js';

export interface ExportHistoryEntry {
  id: string;
  userId: string;
  format: string;
  listingCount: number;
  filename: string;
  timestamp: number;
}

const MAX_MEMORY_ENTRIES = 200;

const memoryStore: ExportHistoryEntry[] = [];

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

  // Firestore persistence (fire-and-forget)
  try {
    const db = await getClient();
    const prefix = getCollectionPrefix();
    await db.collection(`${prefix}export_history`).doc(entry.id).set(JSON.parse(JSON.stringify(entry)));
  } catch {
    // Firestore unavailable — in-memory record still exists
  }

  return entry;
}

export async function getExportHistory(
  userId?: string,
  limit = 50,
): Promise<ExportHistoryEntry[]> {
  try {
    const db = await getClient();
    const prefix = getCollectionPrefix();
    const col = db.collection(`${prefix}export_history`);
    let snapshot;
    if (userId) {
      snapshot = await col.where('userId', '==', userId).get();
    } else {
      snapshot = await col.get();
    }
    const entries = snapshot.docs.map(doc => doc.data() as ExportHistoryEntry);
    entries.sort((a, b) => b.timestamp - a.timestamp);
    return entries.slice(0, limit);
  } catch {
    // Firestore unavailable — fall back to in-memory
    let entries = memoryStore;
    if (userId) {
      entries = entries.filter(e => e.userId === userId);
    }
    return entries.slice(0, limit);
  }
}

export async function getAllExportHistory(limit = 100): Promise<ExportHistoryEntry[]> {
  return getExportHistory(undefined, limit);
}

export async function clearExportHistory(): Promise<void> {
  memoryStore.length = 0;
  // Clear Firestore state (for test environments)
  try {
    const db = await getClient();
    const prefix = getCollectionPrefix();
    const snap = await db.collection(`${prefix}export_history`).get();
    for (const doc of snap.docs) {
      await doc.ref.delete();
    }
  } catch {
    // Firestore unavailable — in-memory already cleared above
  }
}
