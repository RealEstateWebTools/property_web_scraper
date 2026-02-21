/**
 * price-history.ts — Historical price tracking via KV + Firestore.
 *
 * Read path: in-memory → KV → Firestore
 * Write path: in-memory + KV + Firestore (fire-and-forget)
 *
 * KV key patterns:
 *   history:{canonical}:{timestamp} → PriceSnapshot JSON
 *   history-idx:{canonical}         → string[] of timestamps
 *
 * Firestore collection: price_history/{canonical-hash}/snapshots/{timestamp}
 */

import type { KVNamespace } from './kv-types.js';
import { logActivity } from './activity-logger.js';
import { getClient, getCollectionPrefix } from '../firestore/client.js';
import { createHash } from 'node:crypto';

// ─── Types ───────────────────────────────────────────────────────

export interface PriceSnapshot {
  timestamp: string;
  price_float: number;
  price_string: string;
  price_currency: string;
  quality_grade: string;
  scraper: string;
  title?: string;
}

export interface PriceChange {
  from: PriceSnapshot;
  to: PriceSnapshot;
  change_amount: number;
  change_percent: number;
  direction: 'up' | 'down' | 'unchanged';
}

export interface HistoryResult {
  url: string;
  snapshot_count: number;
  snapshots: PriceSnapshot[];
}

export interface ExtractionData {
  url: string;
  scraper: string;
  price_float?: number;
  price_string?: string;
  price_currency?: string;
  quality_grade?: string;
  title?: string;
}

// ─── Storage ─────────────────────────────────────────────────────

let kv: KVNamespace | null = null;
const inMemorySnapshots = new Map<string, PriceSnapshot[]>();

const SNAP_PREFIX = 'history:';
const IDX_PREFIX = 'history-idx:';
const MAX_HISTORY_ENTRIES = 100;
const KV_TTL_SECONDS = 365 * 24 * 60 * 60; // 1 year

/**
 * Bind the KV namespace for persistent storage.
 */
export function initPriceHistoryKV(kvNamespace: KVNamespace | null): void {
  kv = kvNamespace ?? null;
}

/**
 * Canonicalize a URL for consistent keying.
 * Strips trailing slashes, protocol, and www prefix.
 */
export function canonicalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    let path = u.pathname.replace(/\/+$/, '') || '/';
    let host = u.hostname.replace(/^www\./, '');
    return `${host}${path}${u.search}`.toLowerCase();
  } catch {
    return url.toLowerCase().replace(/\/+$/, '');
  }
}

/** Hash a canonical URL to a safe Firestore document ID */
function canonicalHash(canonical: string): string {
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}

// ─── Firestore helpers ──────────────────────────────────────────

async function firestoreSaveSnapshot(canonical: string, snapshot: PriceSnapshot): Promise<void> {
  try {
    const db = await getClient();
    const prefix = getCollectionPrefix();
    const docId = canonicalHash(canonical);
    const col = db.collection(`${prefix}price_history`);
    // Store snapshot as a field keyed by timestamp inside the document
    const parentDoc = col.doc(docId);
    const existing = await parentDoc.get();
    const data = existing.exists ? (existing.data() as Record<string, unknown>) : {};
    const snapshots = (data.snapshots as PriceSnapshot[] | undefined) || [];
    snapshots.unshift(snapshot);
    if (snapshots.length > MAX_HISTORY_ENTRIES) snapshots.length = MAX_HISTORY_ENTRIES;
    await parentDoc.set({ canonical, url: canonical, snapshots, updatedAt: new Date().toISOString() });
  } catch (err) {
    logActivity({ level: 'error', category: 'system', message: '[PriceHistory] Firestore save failed: ' + ((err as Error).message || err) });
  }
}

async function firestoreGetSnapshots(canonical: string): Promise<PriceSnapshot[]> {
  try {
    const db = await getClient();
    const prefix = getCollectionPrefix();
    const docId = canonicalHash(canonical);
    const doc = await db.collection(`${prefix}price_history`).doc(docId).get();
    if (!doc.exists) return [];
    const data = doc.data() as Record<string, unknown>;
    return (data.snapshots as PriceSnapshot[]) || [];
  } catch (err) {
    logActivity({ level: 'error', category: 'system', message: '[PriceHistory] Firestore read failed: ' + ((err as Error).message || err) });
    return [];
  }
}

// ─── Recording ───────────────────────────────────────────────────

/**
 * Record a price snapshot for a listing URL.
 * Skips if the most recent snapshot has the same price (no change).
 */
export async function recordSnapshot(data: ExtractionData): Promise<PriceSnapshot | null> {
  if (!data.price_float && !data.price_string) {
    return null; // No price data to record
  }

  const canonical = canonicalizeUrl(data.url);
  const timestamp = new Date().toISOString();

  const snapshot: PriceSnapshot = {
    timestamp,
    price_float: data.price_float || 0,
    price_string: data.price_string || '',
    price_currency: data.price_currency || '',
    quality_grade: data.quality_grade || 'F',
    scraper: data.scraper,
    ...(data.title && { title: data.title }),
  };

  // Check if the most recent snapshot has the same price
  const existing = await getHistory(canonical);
  if (existing.snapshots.length > 0) {
    const latest = existing.snapshots[0];
    if (latest.price_float === snapshot.price_float && latest.price_string === snapshot.price_string) {
      return null; // No price change — skip
    }
  }

  if (kv) {
    // Store snapshot
    await kv.put(
      `${SNAP_PREFIX}${canonical}:${timestamp}`,
      JSON.stringify(snapshot),
      { expirationTtl: KV_TTL_SECONDS },
    );

    // Update index
    const index = await getIndex(canonical);
    index.unshift(timestamp); // Newest first
    if (index.length > MAX_HISTORY_ENTRIES) index.length = MAX_HISTORY_ENTRIES;
    await kv.put(`${IDX_PREFIX}${canonical}`, JSON.stringify(index), { expirationTtl: KV_TTL_SECONDS });
  } else {
    // In-memory fallback
    const list = inMemorySnapshots.get(canonical) || [];
    list.unshift(snapshot);
    if (list.length > MAX_HISTORY_ENTRIES) list.length = MAX_HISTORY_ENTRIES;
    inMemorySnapshots.set(canonical, list);
  }

  // Persist to Firestore (fire-and-forget with logging)
  firestoreSaveSnapshot(canonical, snapshot).catch((err) => {
    logActivity({ level: 'error', category: 'system', message: '[PriceHistory] Firestore background save failed: ' + ((err as Error).message || err) });
  });

  return snapshot;
}

// ─── Retrieval ───────────────────────────────────────────────────

/**
 * Get full price history for a listing URL.
 */
export async function getHistory(url: string, limit?: number): Promise<HistoryResult> {
  const canonical = canonicalizeUrl(url);

  let snapshots: PriceSnapshot[];

  if (kv) {
    const index = await getIndex(canonical);
    const sliced = limit ? index.slice(0, limit) : index;
    snapshots = [];
    for (const ts of sliced) {
      const snap = await kv.get(`${SNAP_PREFIX}${canonical}:${ts}`, 'json');
      if (snap) snapshots.push(snap as PriceSnapshot);
    }
  } else {
    const list = inMemorySnapshots.get(canonical) || [];
    snapshots = limit ? list.slice(0, limit) : [...list];
  }

  // Tier 3: Firestore fallback if KV returned nothing
  if (snapshots.length === 0) {
    snapshots = await firestoreGetSnapshots(canonical);
    if (limit && snapshots.length > limit) snapshots = snapshots.slice(0, limit);
  }

  return {
    url,
    snapshot_count: snapshots.length,
    snapshots,
  };
}

/**
 * Get only snapshots where the price changed.
 */
export async function getPriceChanges(url: string): Promise<PriceChange[]> {
  const { snapshots } = await getHistory(url);
  if (snapshots.length < 2) return [];

  const changes: PriceChange[] = [];

  for (let i = 0; i < snapshots.length - 1; i++) {
    const newer = snapshots[i];
    const older = snapshots[i + 1];

    if (newer.price_float !== older.price_float) {
      const change = newer.price_float - older.price_float;
      const pct = older.price_float > 0 ? (change / older.price_float) * 100 : 0;

      changes.push({
        from: older,
        to: newer,
        change_amount: Math.round(change * 100) / 100,
        change_percent: Math.round(pct * 100) / 100,
        direction: change > 0 ? 'up' : change < 0 ? 'down' : 'unchanged',
      });
    }
  }

  return changes;
}

// ─── Helpers ─────────────────────────────────────────────────────

async function getIndex(canonical: string): Promise<string[]> {
  if (kv) {
    const data = await kv.get(`${IDX_PREFIX}${canonical}`, 'json');
    return (data as string[]) || [];
  }
  return []; // In-memory store doesn't use separate index
}

/**
 * Clear in-memory store (for testing).
 */
export function clearPriceHistory(): void {
  inMemorySnapshots.clear();
}
