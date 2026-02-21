import { createHash } from 'node:crypto';
import { Listing } from '../models/listing.js';
import type { ExtractionDiagnostics } from '../extractor/html-extractor.js';
import { deduplicationKey } from './url-canonicalizer.js';
import { getClient, getCollectionPrefix } from '../firestore/client.js';
import { logActivity } from './activity-logger.js';
import { recordDeadLetter } from './dead-letter.js';
import type { KVNamespace } from './kv-types.js';

/**
 * KV-backed store for extracted listings, with in-memory fallback.
 * On Cloudflare Workers, each isolate has its own memory, so the in-memory
 * Map alone cannot persist data across the POST→redirect→GET flow.
 * KV provides cross-isolate persistence.
 */

let kv: KVNamespace | null = null;
const store = new Map<string, Listing>();
const diagnosticsStore = new Map<string, ExtractionDiagnostics>();
const urlIndex = new Map<string, string>();
let counter = 0;
/** When true, skip Firestore fallback for diagnostics (set by clearListingStore). */
let _diagnosticsCleared = false;

/** Call once per request with the RESULTS KV binding from Astro.locals.runtime.env */
export function initKV(kvNamespace: KVNamespace | null): void {
  kv = kvNamespace ?? null;
}

export function generateId(): string {
  counter++;
  return `${Date.now().toString(36)}-${counter.toString(36)}`;
}

export function generateStableId(url: string): string {
  const key = deduplicationKey(url);
  return createHash('sha256').update(key).digest('hex').slice(0, 12);
}

export async function getListingByUrl(url: string): Promise<{ id: string; listing: Listing } | undefined> {
  let id = findListingByUrl(url);
  if (!id && kv) {
    const stableId = generateStableId(url);
    const data = await kv.get(`listing:${stableId}`, 'json') as Record<string, unknown> | null;
    if (data) {
      const listing = rehydrateListing(data);
      store.set(stableId, listing);
      urlIndex.set(deduplicationKey(url), stableId);
      id = stableId;
    }
  }
  if (!id) return undefined;
  const listing = await getListing(id);
  return listing ? { id, listing } : undefined;
}

export async function storeListing(id: string, listing: Listing): Promise<void> {
  store.set(id, listing);
  // Index by canonical URL for deduplication
  const importUrl = (listing as any).import_url;
  if (importUrl) {
    urlIndex.set(deduplicationKey(importUrl), id);
  }
  if (kv) {
    await kv.put(`listing:${id}`, JSON.stringify(listing), { expirationTtl: 86400 });
  }
}

export function findListingByUrl(url: string): string | undefined {
  return urlIndex.get(deduplicationKey(url));
}

/**
 * Rehydrate a plain object (from KV JSON deserialization) into a Listing instance
 * so that prototype methods like asJson() are available.
 */
function rehydrateListing(data: Record<string, unknown>): Listing {
  const listing = new Listing();
  listing.assignAttributes(data);
  return listing;
}

export async function getListing(id: string): Promise<Listing | undefined> {
  const cached = store.get(id);
  if (cached) {
    // Ensure it's a real Listing instance (could be a plain object if
    // module was re-evaluated by HMR or stored from a previous import)
    if (typeof cached.asJson !== 'function') {
      const listing = rehydrateListing(cached as unknown as Record<string, unknown>);
      store.set(id, listing);
      return listing;
    }
    return cached;
  }
  if (kv) {
    const data = await kv.get(`listing:${id}`, 'json') as Record<string, unknown> | null;
    if (data) {
      const listing = rehydrateListing(data);
      store.set(id, listing);
      return listing;
    }
  }
  // Fall back to Firestore if available
  try {
    const listing = await Listing.find(id);
    store.set(id, listing);
    return listing;
  } catch (err) {
    logActivity({ level: 'error', category: 'system', message: '[ListingStore] Firestore lookup failed for ' + id + ': ' + ((err as Error).message || err) });
    return undefined;
  }
}

// ─── Firestore helpers for diagnostics ──────────────────────────

async function firestoreSaveDiagnostics(id: string, diagnostics: ExtractionDiagnostics): Promise<void> {
  try {
    const db = await getClient();
    const prefix = getCollectionPrefix();
    const col = db.collection(`${prefix}diagnostics`);
    await col.doc(id).set(JSON.parse(JSON.stringify(diagnostics)));
  } catch (err) {
    logActivity({ level: 'error', category: 'system', message: '[ListingStore] Firestore diagnostics save failed: ' + ((err as Error).message || err) });
  }
}

async function firestoreGetDiagnostics(id: string): Promise<ExtractionDiagnostics | undefined> {
  try {
    const db = await getClient();
    const prefix = getCollectionPrefix();
    const col = db.collection(`${prefix}diagnostics`);
    const doc = await col.doc(id).get();
    if (!doc.exists) return undefined;
    return doc.data() as ExtractionDiagnostics;
  } catch (err) {
    logActivity({ level: 'error', category: 'system', message: '[ListingStore] Firestore diagnostics read failed for ' + id + ': ' + ((err as Error).message || err) });
    return undefined;
  }
}

export async function storeDiagnostics(id: string, diagnostics: ExtractionDiagnostics): Promise<void> {
  _diagnosticsCleared = false;
  diagnosticsStore.set(id, diagnostics);
  if (kv) {
    await kv.put(`diagnostics:${id}`, JSON.stringify(diagnostics), { expirationTtl: 86400 });
  }
  // Firestore write-through (fire-and-forget)
  firestoreSaveDiagnostics(id, diagnostics).catch((err) => {
    logActivity({ level: 'error', category: 'system', message: '[ListingStore] Firestore diagnostics write-through failed: ' + ((err as Error).message || err) });
    recordDeadLetter({
      source: 'firestore_diagnostics',
      operation: `diagnostics.save(${id})`,
      error: (err as Error).message || String(err),
      context: { id },
      attempts: 1,
    }).catch(() => {});
  });
}

/** Tier 4: Lossy reconstruction from Firestore listing's embedded diagnostic fields. */
async function reconstructDiagnosticsFromListing(id: string): Promise<ExtractionDiagnostics | undefined> {
  try {
    const listing = await Listing.find(id);
    if (listing.scraper_name) {
      const diag = {
        scraperName: listing.scraper_name,
        qualityGrade: listing.quality_grade,
        qualityLabel: listing.quality_label,
        extractionRate: listing.extraction_rate,
        weightedExtractionRate: listing.weighted_extraction_rate,
        extractableFields: listing.extractable_fields,
        populatedExtractableFields: listing.populated_extractable_fields,
        meetsExpectation: listing.meets_expectation,
        criticalFieldsMissing: listing.critical_fields_missing,
        fieldTraces: [],
        totalFields: 0,
        populatedFields: listing.populated_extractable_fields,
        emptyFields: listing.critical_fields_missing,
        successClassification: listing.quality_grade === 'A' || listing.quality_grade === 'B' ? 'good' : 'partial',
        confidenceScore: listing.confidence_score,
      } as ExtractionDiagnostics;
      diagnosticsStore.set(id, diag);
      return diag;
    }
  } catch (err) {
    logActivity({ level: 'error', category: 'system', message: '[ListingStore] Firestore diagnostics reconstruction failed for ' + id + ': ' + ((err as Error).message || err) });
  }
  return undefined;
}

export async function getDiagnostics(id: string): Promise<ExtractionDiagnostics | undefined> {
  // Tier 1: in-memory cache
  const cached = diagnosticsStore.get(id);
  if (cached) return cached;

  // Tier 2: KV
  if (kv) {
    const data = await kv.get(`diagnostics:${id}`, 'json') as ExtractionDiagnostics | null;
    if (data) {
      diagnosticsStore.set(id, data);
      return data;
    }
  }

  // Tier 3: Firestore diagnostics collection
  // Skip if store was explicitly cleared (diagnostics written this session are stale)
  if (!_diagnosticsCleared) {
    const firestoreDiag = await firestoreGetDiagnostics(id);
    if (firestoreDiag) {
      diagnosticsStore.set(id, firestoreDiag);
      // Repopulate KV for faster subsequent reads
      if (kv) {
        kv.put(`diagnostics:${id}`, JSON.stringify(firestoreDiag), { expirationTtl: 86400 }).catch(() => {});
      }
      return firestoreDiag;
    }
  }

  // Tier 4: Lossy reconstruction from Firestore listing's embedded fields
  return reconstructDiagnosticsFromListing(id);
}

export async function getAllListings(): Promise<Array<{ id: string; listing: Listing }>> {
  const results: Array<{ id: string; listing: Listing }> = [];
  const seenIds = new Set<string>();

  // Try Firestore first (persists across Worker isolates)
  try {
    const col = await Listing.collectionRef();
    const snapshot = await col.get();
    for (const doc of snapshot.docs) {
      const listing = Listing.buildFromSnapshot(doc);
      results.push({ id: doc.id, listing });
      seenIds.add(doc.id);
      // Populate in-memory cache for subsequent getListing() calls
      store.set(doc.id, listing);
    }
  } catch {
    // Firestore unavailable — fall through to in-memory below
  }

  // Also include in-memory listings not yet in Firestore
  for (const [id, listing] of store.entries()) {
    if (!seenIds.has(id)) {
      results.push({ id, listing });
    }
  }

  return results;
}

export async function getAllDiagnostics(): Promise<Array<{ id: string; diagnostics: ExtractionDiagnostics }>> {
  return Array.from(diagnosticsStore.entries()).map(([id, diagnostics]) => ({ id, diagnostics }));
}

export function getStoreStats(): { count: number } {
  return { count: store.size };
}

// ─── HTML hash storage ──────────────────────────────────────────

export interface HtmlHashEntry {
  hash: string;   // 16-char hex
  size: number;   // html.length at time of storage
}

export async function getHtmlHash(url: string): Promise<HtmlHashEntry | null> {
  const id = generateStableId(url);
  if (!kv) return null;
  return kv.get(`html-hash:${id}`, 'json') as Promise<HtmlHashEntry | null>;
}

export async function storeHtmlHash(url: string, hash: string, size: number): Promise<void> {
  const id = generateStableId(url);
  if (!kv) return;
  const entry: HtmlHashEntry = { hash, size };
  await kv.put(`html-hash:${id}`, JSON.stringify(entry), {
    expirationTtl: 30 * 24 * 60 * 60,  // 30 days
  });
}

export async function deleteListing(id: string): Promise<void> {
  // Remove URL index entry for this listing
  const listing = store.get(id);
  if (listing) {
    const importUrl = (listing as any).import_url;
    if (importUrl) {
      urlIndex.delete(deduplicationKey(importUrl));
    }
  }

  store.delete(id);
  diagnosticsStore.delete(id);
  if (kv) {
    await kv.delete(`listing:${id}`);
    await kv.delete(`diagnostics:${id}`);
  }

  // Delete from Firestore
  try {
    const existing = await Listing.find(id);
    await existing.destroy();
  } catch {
    // Not in Firestore or already deleted — ignore
  }

  // Delete diagnostics from Firestore
  try {
    const db = await getClient();
    const prefix = getCollectionPrefix();
    await db.collection(`${prefix}diagnostics`).doc(id).delete();
  } catch {
    // Not in Firestore or already deleted — ignore
  }
}
 
export async function updateListingVisibility(id: string, visibility: string): Promise<void> {
  const listing = await getListing(id);
  if (!listing) {
    throw new Error(`Listing not found: ${id}`);
  }

  listing.visibility = visibility;
  listing.manual_override = true;
  store.set(id, listing);
  if (kv) {
    await kv.put(`listing:${id}`, JSON.stringify(listing), { expirationTtl: 86400 });
  }

  // Persist to Firestore
  try {
    listing.id = id;
    await listing.save();
  } catch (err) {
    logActivity({ level: 'error', category: 'system', message: '[ListingStore] Firestore visibility update failed: ' + ((err as Error).message || err) });
  }
}
 
export function clearListingStore(): void {
  store.clear();
  diagnosticsStore.clear();
  urlIndex.clear();
  _diagnosticsCleared = true;
}
