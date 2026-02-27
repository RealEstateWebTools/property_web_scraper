/**
 * Firestore-backed store for hauls, with in-memory cache.
 * Read path: in-memory → Firestore
 * Write path: in-memory + Firestore
 */

import { deduplicationKey } from './url-canonicalizer.js';
import { getClient, getCollectionPrefix } from '../firestore/client.js';
import { getAppEnv } from './app-env.js';
import type { AppEnv } from './app-env.js';

export type HaulVisibility = 'public' | 'private';

export interface HaulScrape {
  resultId: string;
  title: string;
  grade: string;
  price: string;
  extractionRate: number;
  createdAt: string;
  url: string;
  // Enriched fields (optional for backward compat with existing hauls)
  price_float?: number;
  currency?: string;
  count_bedrooms?: number;
  count_bathrooms?: number;
  constructed_area?: number;
  area_unit?: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  country?: string;
  address_string?: string;
  main_image_url?: string;
  import_host_slug?: string;
  for_sale?: boolean;
  for_rent?: boolean;
  features?: string[];
  description?: string;
  description_html?: string;
  // New interoperability fields
  property_type?: string;
  property_subtype?: string;
  tenure?: string;
  listing_status?: string;
  agent_name?: string;
  agent_phone?: string;
  agent_email?: string;
  agent_logo_url?: string;
  price_qualifier?: string;
  floor_plan_urls?: string[];
  energy_certificate_grade?: string;
  locale_code?: string;
}

export interface Haul {
  id: string;
  createdAt: string;
  expiresAt: string;
  creatorIp: string;
  visibility?: HaulVisibility;
  ownerUserId?: string;
  scrapes: HaulScrape[];
  name?: string;
  notes?: string;
  env?: AppEnv;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_SCRAPES = 20;
const STALE_IN_MEMORY_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

const store = new Map<string, Haul>();

// ─── Firestore helpers ──────────────────────────────────────────

/**
 * Clean up in-memory entries that are stale (not persisted to Firestore for too long).
 * Prevents memory leaks from hauls created but never successfully persisted.
 * Called with the set of IDs that exist in Firestore.
 */
function cleanupStaleInMemoryHauls(firestoreIds: Set<string>): void {
  const now = Date.now();
  const idsToDelete: string[] = [];

  for (const [id, haul] of store.entries()) {
    // Skip if it exists in Firestore (properly persisted)
    if (firestoreIds.has(id)) continue;

    // If not in Firestore and older than threshold, mark for deletion
    const createdTime = new Date(haul.createdAt).getTime();
    if (now - createdTime > STALE_IN_MEMORY_THRESHOLD_MS) {
      idsToDelete.push(id);
    }
  }

  // Clean up stale entries
  for (const id of idsToDelete) {
    store.delete(id);
  }
}

async function firestoreSaveHaul(haul: Haul): Promise<void> {
  const db = await getClient();
  const prefix = getCollectionPrefix();
  const col = db.collection(`${prefix}hauls`);
  await col.doc(haul.id).set(JSON.parse(JSON.stringify(haul)));
}

async function firestoreGetHaul(id: string): Promise<Haul | undefined> {
  const db = await getClient();
  const prefix = getCollectionPrefix();
  const col = db.collection(`${prefix}hauls`);
  const doc = await col.doc(id).get();
  if (!doc.exists) return undefined;
  return doc.data() as unknown as Haul;
}

function normalizeHaul(haul: Haul): Haul {
  const visibility: HaulVisibility = haul.visibility === 'private' ? 'private' : 'public';
  const normalized: Haul = { ...haul, visibility };
  if (visibility !== 'private') {
    delete normalized.ownerUserId;
  }
  return normalized;
}

// ─── Public API ─────────────────────────────────────────────────

export async function createHaul(
  id: string,
  creatorIp: string,
  options: { visibility?: HaulVisibility; ownerUserId?: string } = {},
): Promise<Haul> {
  const now = new Date();
  const visibility: HaulVisibility = options.visibility === 'private' ? 'private' : 'public';
  if (visibility === 'private' && !options.ownerUserId) {
    throw new Error('Private hauls require ownerUserId');
  }

  const haul: Haul = {
    id,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + THIRTY_DAYS_MS).toISOString(),
    creatorIp,
    visibility,
    ...(visibility === 'private' ? { ownerUserId: options.ownerUserId } : {}),
    scrapes: [],
    env: getAppEnv(),
  };
  store.set(id, haul);
  await firestoreSaveHaul(haul);
  return haul;
}

export async function getHaul(id: string): Promise<Haul | undefined> {
  // Tier 1: in-memory
  let haul = store.get(id);
  if (haul) {
    haul = normalizeHaul(haul);
    store.set(id, haul);
  }
  // Tier 2: Firestore
  if (!haul) {
    haul = await firestoreGetHaul(id);
    if (haul) {
      haul = normalizeHaul(haul);
      store.set(id, haul);
    }
  }
  if (!haul) return undefined;
  // Lazy expiry check
  if (new Date(haul.expiresAt).getTime() < Date.now()) {
    store.delete(id);
    return undefined;
  }
  return haul;
}

async function persistHaul(haul: Haul): Promise<void> {
  const normalized = normalizeHaul(haul);
  store.set(normalized.id, normalized);
  await firestoreSaveHaul(normalized);
}

export async function addScrapeToHaul(
  id: string,
  scrape: HaulScrape,
): Promise<{ haul: Haul; added: boolean; replaced: boolean }> {
  const haul = await getHaul(id);
  if (!haul) throw new Error('Haul not found');

  // Check for existing scrape with the same canonical URL
  const incomingKey = scrape.url ? deduplicationKey(scrape.url) : '';
  let replaced = false;
  if (incomingKey) {
    const existingIdx = haul.scrapes.findIndex(
      (s) => s.url && deduplicationKey(s.url) === incomingKey,
    );
    if (existingIdx !== -1) {
      haul.scrapes[existingIdx] = scrape;
      replaced = true;
    }
  }

  if (!replaced) {
    if (haul.scrapes.length >= MAX_SCRAPES) {
      return { haul, added: false, replaced: false };
    }
    haul.scrapes.push(scrape);
  }

  await persistHaul(haul);
  return { haul, added: true, replaced };
}

export async function findExistingScrapeByUrl(
  haulId: string,
  url: string,
): Promise<HaulScrape | undefined> {
  const haul = await getHaul(haulId);
  if (!haul) throw new Error('Haul not found');

  const incomingKey = deduplicationKey(url);
  return haul.scrapes.find((s) => s.url && deduplicationKey(s.url) === incomingKey);
}

export async function removeScrapeFromHaul(
  id: string,
  resultId: string,
): Promise<{ haul: Haul; removed: boolean }> {
  const haul = await getHaul(id);
  if (!haul) throw new Error('Haul not found');

  const idx = haul.scrapes.findIndex((s) => s.resultId === resultId);
  if (idx === -1) return { haul, removed: false };

  haul.scrapes.splice(idx, 1);
  await persistHaul(haul);
  return { haul, removed: true };
}

export async function getAllHauls(): Promise<Haul[]> {
  const results: Haul[] = [];
  const seenIds = new Set<string>();
  const now = Date.now();

  // Firestore first
  try {
    const db = await getClient();
    const prefix = getCollectionPrefix();
    const col = db.collection(`${prefix}hauls`);
    const snapshot = await col.get();
    for (const doc of snapshot.docs) {
      const haul = normalizeHaul(doc.data() as unknown as Haul);
      if (new Date(haul.expiresAt).getTime() < now) continue;
      results.push(haul);
      seenIds.add(doc.id);
      store.set(doc.id, haul);
    }
  } catch {
    // Firestore unavailable — fall through to in-memory
  }

  // Clean up stale in-memory entries that failed to persist to Firestore
  cleanupStaleInMemoryHauls(seenIds);

  // Merge in-memory entries not yet in Firestore
  for (const [id, haul] of store.entries()) {
    if (seenIds.has(id)) continue;
    if (new Date(haul.expiresAt).getTime() < now) continue;
    results.push(haul);
  }

  // Sort by createdAt descending
  results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return results;
}

export async function deleteHaul(id: string): Promise<void> {
  store.delete(id);
  try {
    const db = await getClient();
    const prefix = getCollectionPrefix();
    await db.collection(`${prefix}hauls`).doc(id).delete();
  } catch {
    // Not in Firestore or already deleted — ignore
  }
}

export async function updateHaulMeta(
  id: string,
  meta: { name?: string; notes?: string },
): Promise<Haul> {
  const haul = await getHaul(id);
  if (!haul) throw new Error('Haul not found');

  if (meta.name !== undefined) {
    haul.name = meta.name.slice(0, 100) || undefined;
  }
  if (meta.notes !== undefined) {
    haul.notes = meta.notes.slice(0, 500) || undefined;
  }

  await persistHaul(haul);
  return haul;
}

/**
 * Test-only export: clear module-level in-memory store.
 * Used in test setup to ensure tests don't accumulate hauls across runs.
 */
export function __clearStore(): void {
  store.clear();
}
