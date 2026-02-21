/**
 * Persistent Audit Log Service
 * Tracks extraction, quality, and system events with Firestore persistence
 * and in-memory fallback.
 *
 * Firestore collection: {prefix}audit_log
 * Only persists extraction, quality, and system categories — skips
 * api_request/rate_limit for volume control.
 */

import { getClient, getCollectionPrefix } from '../firestore/client.js';
import type { LogLevel, LogCategory, LogEntry } from './activity-logger.js';

export interface AuditEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  category: LogCategory;
  message: string;
  scraperName?: string;
  sourceUrl?: string;
  fieldsFound?: number;
  fieldsAvailable?: number;
  errorCode?: string;
  durationMs?: number;
}

const PERSISTED_CATEGORIES: LogCategory[] = ['extraction', 'quality', 'system'];
const MAX_MEMORY_ENTRIES = 500;

const memoryStore: AuditEntry[] = [];

function generateEntryId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function logEntryToAudit(entry: LogEntry): AuditEntry {
  return {
    id: entry.id,
    timestamp: entry.timestamp,
    level: entry.level,
    category: entry.category,
    message: entry.message,
    scraperName: entry.scraperName,
    sourceUrl: entry.sourceUrl,
    fieldsFound: entry.fieldsFound,
    fieldsAvailable: entry.fieldsAvailable,
    errorCode: entry.errorCode,
    durationMs: entry.durationMs,
  };
}

export function shouldPersist(category: LogCategory): boolean {
  return PERSISTED_CATEGORIES.includes(category);
}

export async function persistAuditEntry(entry: LogEntry): Promise<void> {
  if (!shouldPersist(entry.category)) return;

  const audit = logEntryToAudit(entry);
  // Ensure unique ID for the audit entry
  if (!audit.id) audit.id = generateEntryId();

  // In-memory store
  memoryStore.unshift(audit);
  if (memoryStore.length > MAX_MEMORY_ENTRIES) {
    memoryStore.length = MAX_MEMORY_ENTRIES;
  }

  // Firestore persistence (fire-and-forget)
  try {
    const db = await getClient();
    const prefix = getCollectionPrefix();
    await db.collection(`${prefix}audit_log`).doc(audit.id).set(JSON.parse(JSON.stringify(audit)));
  } catch {
    // Firestore unavailable — in-memory record still exists
  }
}

export interface AuditLogQuery {
  category?: LogCategory;
  level?: LogLevel;
  scraperName?: string;
  search?: string;
  startDate?: number;
  endDate?: number;
  limit?: number;
  offset?: number;
}

export interface AuditLogQueryResult {
  entries: AuditEntry[];
  total: number;
}

export async function queryAuditLog(query: AuditLogQuery = {}): Promise<AuditLogQueryResult> {
  const { category, level, scraperName, search, startDate, endDate, limit = 50, offset = 0 } = query;
  const searchLower = search?.toLowerCase();

  let entries: AuditEntry[];

  try {
    const db = await getClient();
    const prefix = getCollectionPrefix();
    const snapshot = await db.collection(`${prefix}audit_log`).get();
    entries = snapshot.docs.map(doc => doc.data() as AuditEntry);
  } catch {
    // Firestore unavailable — fall back to in-memory
    entries = [...memoryStore];
  }

  // Sort newest first
  entries.sort((a, b) => b.timestamp - a.timestamp);

  // Filter
  const filtered = entries.filter((e) => {
    if (category && e.category !== category) return false;
    if (level && e.level !== level) return false;
    if (scraperName && e.scraperName !== scraperName) return false;
    if (startDate && e.timestamp < startDate) return false;
    if (endDate && e.timestamp > endDate) return false;
    if (searchLower) {
      const haystack = `${e.message} ${e.scraperName || ''} ${e.sourceUrl || ''} ${e.errorCode || ''}`.toLowerCase();
      if (!haystack.includes(searchLower)) return false;
    }
    return true;
  });

  return {
    entries: filtered.slice(offset, offset + limit),
    total: filtered.length,
  };
}

export interface AuditLogStats {
  totalEntries: number;
  byLevel: Record<LogLevel, number>;
  byCategory: Record<string, number>;
  oldestTimestamp: number | null;
  newestTimestamp: number | null;
}

export async function getAuditLogStats(): Promise<AuditLogStats> {
  const byLevel: Record<LogLevel, number> = { info: 0, warn: 0, error: 0 };
  const byCategory: Record<string, number> = {};
  let oldest: number | null = null;
  let newest: number | null = null;

  let entries: AuditEntry[];
  try {
    const db = await getClient();
    const prefix = getCollectionPrefix();
    const snapshot = await db.collection(`${prefix}audit_log`).get();
    entries = snapshot.docs.map(doc => doc.data() as AuditEntry);
  } catch {
    entries = [...memoryStore];
  }

  for (const e of entries) {
    byLevel[e.level]++;
    byCategory[e.category] = (byCategory[e.category] || 0) + 1;
    if (oldest === null || e.timestamp < oldest) oldest = e.timestamp;
    if (newest === null || e.timestamp > newest) newest = e.timestamp;
  }

  return {
    totalEntries: entries.length,
    byLevel,
    byCategory,
    oldestTimestamp: oldest,
    newestTimestamp: newest,
  };
}

export async function clearAuditLog(): Promise<void> {
  memoryStore.length = 0;
  try {
    const db = await getClient();
    const prefix = getCollectionPrefix();
    const snap = await db.collection(`${prefix}audit_log`).get();
    for (const doc of snap.docs) {
      await doc.ref.delete();
    }
  } catch {
    // Firestore unavailable — in-memory already cleared
  }
}
