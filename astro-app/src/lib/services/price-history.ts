/**
 * price-history.ts — Historical price tracking via KV storage.
 *
 * Stores timestamped extraction snapshots per listing URL.
 * Key patterns:
 *   history:{canonical}:{timestamp} → PriceSnapshot JSON
 *   history-idx:{canonical}         → string[] of timestamps
 */

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

let kv: any = null;
const inMemorySnapshots = new Map<string, PriceSnapshot[]>();

const SNAP_PREFIX = 'history:';
const IDX_PREFIX = 'history-idx:';
const MAX_HISTORY_ENTRIES = 100;
const KV_TTL_SECONDS = 365 * 24 * 60 * 60; // 1 year

/**
 * Bind the KV namespace for persistent storage.
 */
export function initPriceHistoryKV(kvNamespace: any): void {
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
