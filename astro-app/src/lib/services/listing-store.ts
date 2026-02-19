import { createHash } from 'node:crypto';
import { Listing } from '../models/listing.js';
import type { ExtractionDiagnostics } from '../extractor/html-extractor.js';
import { deduplicationKey } from './url-canonicalizer.js';

/**
 * KV-backed store for extracted listings, with in-memory fallback.
 * On Cloudflare Workers, each isolate has its own memory, so the in-memory
 * Map alone cannot persist data across the POST→redirect→GET flow.
 * KV provides cross-isolate persistence.
 */

let kv: any = null;
const store = new Map<string, Listing>();
const diagnosticsStore = new Map<string, ExtractionDiagnostics>();
const urlIndex = new Map<string, string>();
let counter = 0;

/** Call once per request with the RESULTS KV binding from Astro.locals.runtime.env */
export function initKV(kvNamespace: any): void {
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
    await kv.put(`listing:${id}`, JSON.stringify(listing), { expirationTtl: 3600 });
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
  } catch {
    return undefined;
  }
}

export async function storeDiagnostics(id: string, diagnostics: ExtractionDiagnostics): Promise<void> {
  diagnosticsStore.set(id, diagnostics);
  if (kv) {
    await kv.put(`diagnostics:${id}`, JSON.stringify(diagnostics), { expirationTtl: 3600 });
  }
}

export async function getDiagnostics(id: string): Promise<ExtractionDiagnostics | undefined> {
  const cached = diagnosticsStore.get(id);
  if (cached) return cached;
  if (kv) {
    const data = await kv.get(`diagnostics:${id}`, 'json') as ExtractionDiagnostics | null;
    if (data) {
      diagnosticsStore.set(id, data);
      return data;
    }
  }
  // Reconstruct from Firestore listing's embedded diagnostic fields
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
  } catch {
    // Listing not in Firestore either
  }
  return undefined;
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

export async function deleteListing(id: string): Promise<void> {
  store.delete(id);
  diagnosticsStore.delete(id);
  if (kv) {
    await kv.delete(`listing:${id}`);
    await kv.delete(`diagnostics:${id}`);
  }
}
 
export async function updateListingVisibility(id: string, visibility: string): Promise<void> {
  const listing = await getListing(id);
  if (listing) {
    (listing as any).visibility = visibility;
    (listing as any).manual_override = true;
    store.set(id, listing);
    if (kv) {
      await kv.put(`listing:${id}`, JSON.stringify(listing), { expirationTtl: 3600 });
    }
  }
}
 
export function clearListingStore(): void {
  store.clear();
  diagnosticsStore.clear();
  urlIndex.clear();
}
