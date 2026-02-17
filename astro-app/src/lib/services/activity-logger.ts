/**
 * In-memory circular buffer activity logger.
 * Captures API requests, extractions, auth failures, and system events.
 * No external dependencies — leaf module to avoid circular imports.
 */

import type { ExtractionDiagnostics } from '../extractor/html-extractor.js';

export type LogLevel = 'info' | 'warn' | 'error';
export type LogCategory = 'api_request' | 'extraction' | 'auth' | 'rate_limit' | 'system';

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  category: LogCategory;
  message: string;
  method?: string;
  path?: string;
  statusCode?: number;
  clientKey?: string;
  durationMs?: number;
  scraperName?: string;
  sourceUrl?: string;
  fieldsFound?: number;
  fieldsAvailable?: number;
  errorCode?: string;
  diagnostics?: ExtractionDiagnostics;
}

export type LogInput = Omit<LogEntry, 'id' | 'timestamp'>;

export interface LogQuery {
  level?: LogLevel;
  category?: LogCategory;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface LogQueryResult {
  entries: LogEntry[];
  total: number;
}

export interface LogStats {
  totalEntries: number;
  capacity: number;
  byLevel: Record<LogLevel, number>;
  byCategory: Record<LogCategory, number>;
  oldestTimestamp: number | null;
  newestTimestamp: number | null;
}

const MAX_ENTRIES = 1000;
const buffer: (LogEntry | null)[] = new Array(MAX_ENTRIES).fill(null);
let writePointer = 0;
let entryCount = 0;
let idCounter = 0;

function shouldEmitConsoleLogs(): boolean {
  const viteProd = Boolean((import.meta as ImportMeta & { env?: { PROD?: boolean } }).env?.PROD);
  const nodeProd = typeof process !== 'undefined' && process.env.NODE_ENV === 'production';
  return viteProd || nodeProd;
}

export function logActivity(input: LogInput): void {
  idCounter++;
  const entry: LogEntry = {
    ...input,
    id: String(idCounter),
    timestamp: Date.now(),
  };
  buffer[writePointer] = entry;
  writePointer = (writePointer + 1) % MAX_ENTRIES;
  if (entryCount < MAX_ENTRIES) entryCount++;

  if (shouldEmitConsoleLogs()) {
    const payload = JSON.stringify({
      timestamp: new Date(entry.timestamp).toISOString(),
      ...entry,
    });
    if (entry.level === 'error') {
      console.error(payload);
    } else if (entry.level === 'warn') {
      console.warn(payload);
    } else {
      console.log(payload);
    }
  }
}

export function queryLogs(query: LogQuery = {}): LogQueryResult {
  const { level, category, search, limit = 50, offset = 0 } = query;
  const searchLower = search?.toLowerCase();

  // Collect all non-null entries newest-first
  const allEntries: LogEntry[] = [];
  for (let i = 0; i < entryCount; i++) {
    // Walk backwards from the most recent write
    const idx = (writePointer - 1 - i + MAX_ENTRIES) % MAX_ENTRIES;
    const entry = buffer[idx];
    if (!entry) continue;
    allEntries.push(entry);
  }

  // Filter
  const filtered = allEntries.filter((e) => {
    if (level && e.level !== level) return false;
    if (category && e.category !== category) return false;
    if (searchLower) {
      const haystack = `${e.message} ${e.path || ''} ${e.method || ''} ${e.errorCode || ''} ${e.scraperName || ''} ${e.sourceUrl || ''}`.toLowerCase();
      if (!haystack.includes(searchLower)) return false;
    }
    return true;
  });

  return {
    entries: filtered.slice(offset, offset + limit),
    total: filtered.length,
  };
}

export function getLogStats(): LogStats {
  const byLevel: Record<LogLevel, number> = { info: 0, warn: 0, error: 0 };
  const byCategory: Record<LogCategory, number> = {
    api_request: 0, extraction: 0, auth: 0, rate_limit: 0, system: 0,
  };
  let oldest: number | null = null;
  let newest: number | null = null;

  for (let i = 0; i < entryCount; i++) {
    const idx = (writePointer - 1 - i + MAX_ENTRIES) % MAX_ENTRIES;
    const entry = buffer[idx];
    if (!entry) continue;
    byLevel[entry.level]++;
    byCategory[entry.category]++;
    if (oldest === null || entry.timestamp < oldest) oldest = entry.timestamp;
    if (newest === null || entry.timestamp > newest) newest = entry.timestamp;
  }

  return {
    totalEntries: entryCount,
    capacity: MAX_ENTRIES,
    byLevel,
    byCategory,
    oldestTimestamp: oldest,
    newestTimestamp: newest,
  };
}

export function clearLogs(): void {
  buffer.fill(null);
  writePointer = 0;
  entryCount = 0;
  // idCounter intentionally not reset — IDs stay monotonic
}
