import { Listing } from '../models/listing.js';
import type { ExtractionDiagnostics } from '../extractor/html-extractor.js';
import { deduplicationKey } from './url-canonicalizer.js';
import { getClient, getCollectionPrefix } from '../firestore/client.js';
import { logActivity } from './activity-logger.js';
import { recordDeadLetter } from './dead-letter.js';
import { createHash } from 'node:crypto';

const store = new Map<string, Listing>();
const diagnosticsStore = new Map<string, ExtractionDiagnostics>();
const urlIndex = new Map<string, string>();
let counter = 0;
/** When true, skip Firestore fallback for diagnostics (set by clearListingStore). */
let _diagnosticsCleared = false;
/**
 * IDs seen in the last successful Firestore read. Used to detect external
 * deletions: if an ID was in Firestore on the previous read but is absent
 * now, it was deleted outside this process and should be evicted from memory.
 */
let prevFirestoreIds = new Set<string>();

export function generateId(): string {
  counter++;
  return `${Date.now().toString(36)}-${counter.toString(36)}`;
}

export function generateStableId(url: string): string {
  const key = deduplicationKey(url);
  return createHash('sha256').update(key).digest('hex').slice(0, 12);
}

export async function getListingByUrl(url: string): Promise<{ id: string; listing: Listing } | undefined> {
  const id = findListingByUrl(url);
  if (id) {
    const listing = await getListing(id);
    return listing ? { id, listing } : undefined;
  }
  // Compute stable ID from URL (deterministic), query Firestore directly
  const stableId = generateStableId(url);
  const listing = await getListing(stableId);
  if (listing) {
    urlIndex.set(deduplicationKey(url), stableId);
    return { id: stableId, listing };
  }
  return undefined;
}

export async function storeListing(id: string, listing: Listing): Promise<void> {
  store.set(id, listing);
  // Index by canonical URL for deduplication
  const importUrl = (listing as any).import_url;
  if (importUrl) {
    urlIndex.set(deduplicationKey(importUrl), id);
  }
}

export function findListingByUrl(url: string): string | undefined {
  return urlIndex.get(deduplicationKey(url));
}

/**
 * Rehydrate a plain object (from Firestore JSON deserialization) into a Listing instance
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
  // Fall back to Firestore if available
  try {
    const listing = await Listing.find(id) as unknown as Listing;
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
    const payload = JSON.parse(JSON.stringify(diagnostics));
    payload.created_at = Date.now();
    await col.doc(id).set(payload);
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
    return doc.data() as unknown as ExtractionDiagnostics;
  } catch (err) {
    logActivity({ level: 'error', category: 'system', message: '[ListingStore] Firestore diagnostics read failed for ' + id + ': ' + ((err as Error).message || err) });
    return undefined;
  }
}

export async function storeDiagnostics(id: string, diagnostics: ExtractionDiagnostics): Promise<void> {
  _diagnosticsCleared = false;
  diagnosticsStore.set(id, diagnostics);
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

/** Tier 3: Lossy reconstruction from Firestore listing's embedded diagnostic fields. */
async function reconstructDiagnosticsFromListing(id: string): Promise<ExtractionDiagnostics | undefined> {
  try {
    const listing = await Listing.find(id) as unknown as Listing;
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

  // Tier 2: Firestore diagnostics collection
  // Skip if store was explicitly cleared (diagnostics written this session are stale)
  if (!_diagnosticsCleared) {
    const firestoreDiag = await firestoreGetDiagnostics(id);
    if (firestoreDiag) {
      diagnosticsStore.set(id, firestoreDiag);
      return firestoreDiag;
    }
  }

  // Tier 3: Lossy reconstruction from Firestore listing's embedded fields
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
      const listing = Listing.buildFromSnapshot(doc) as unknown as Listing;
      results.push({ id: doc.id, listing });
      seenIds.add(doc.id);
      // Populate in-memory cache for subsequent getListing() calls
      store.set(doc.id, listing);
    }

    // Evict in-memory entries that were in Firestore on the previous read but
    // are now absent — they were deleted externally (e.g. by a cleanup script).
    // We only evict entries that were previously confirmed in Firestore so we
    // don't discard newly scraped listings that haven't been saved yet.
    for (const [id, listing] of store.entries()) {
      if (!seenIds.has(id) && prevFirestoreIds.has(id)) {
        const importUrl = (listing as any).import_url;
        if (importUrl) urlIndex.delete(deduplicationKey(importUrl));
        store.delete(id);
        diagnosticsStore.delete(id);
      }
    }

    prevFirestoreIds = new Set(seenIds);
  } catch {
    // Firestore unavailable — fall through to in-memory below
  }

  // Also include in-memory listings not yet in Firestore (newly scraped entries
  // that haven't been persisted yet, or all entries when Firestore is unavailable).
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

export async function updateListingFields(id: string, fields: Record<string, unknown>): Promise<Listing> {
  const listing = await getListing(id);
  if (!listing) {
    throw new Error(`Listing not found: ${id}`);
  }

  listing.assignAttributes(fields);
  listing.manual_override = true;
  store.set(id, listing);

  // Persist to Firestore
  try {
    listing.id = id;
    await listing.save();
  } catch (err) {
    logActivity({ level: 'error', category: 'system', message: '[ListingStore] Firestore field update failed: ' + ((err as Error).message || err) });
  }

  return listing;
}

export async function updateListingVisibility(id: string, visibility: string): Promise<void> {
  const listing = await getListing(id);
  if (!listing) {
    throw new Error(`Listing not found: ${id}`);
  }

  listing.visibility = visibility as 'published' | 'pending' | 'spam' | 'hidden';
  listing.manual_override = true;
  store.set(id, listing);

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
  prevFirestoreIds.clear();
  _diagnosticsCleared = true;
}
