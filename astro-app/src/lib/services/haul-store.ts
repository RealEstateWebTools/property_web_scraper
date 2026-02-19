/**
 * KV-backed store for hauls, with in-memory fallback.
 * Follows the same pattern as listing-store.ts.
 */

import { deduplicationKey } from './url-canonicalizer.js';

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
}

export interface Haul {
  id: string;
  createdAt: string;
  expiresAt: string;
  creatorIp: string;
  scrapes: HaulScrape[];
  name?: string;
  notes?: string;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_S = 30 * 24 * 60 * 60;
const MAX_SCRAPES = 20;

let kv: any = null;
const store = new Map<string, Haul>();

/** Call once per request with the RESULTS KV binding */
export function initHaulKV(kvNamespace: any): void {
  kv = kvNamespace ?? null;
}

function kvKey(id: string): string {
  return `haul:${id}`;
}

function remainingTtlSeconds(haul: Haul): number {
  const remaining = Math.floor((new Date(haul.expiresAt).getTime() - Date.now()) / 1000);
  return Math.max(remaining, 60); // at least 60s
}

export async function createHaul(id: string, creatorIp: string): Promise<Haul> {
  const now = new Date();
  const haul: Haul = {
    id,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + THIRTY_DAYS_MS).toISOString(),
    creatorIp,
    scrapes: [],
  };
  store.set(id, haul);
  if (kv) {
    await kv.put(kvKey(id), JSON.stringify(haul), { expirationTtl: THIRTY_DAYS_S });
  }
  return haul;
}

export async function getHaul(id: string): Promise<Haul | undefined> {
  let haul = store.get(id);
  if (!haul && kv) {
    haul = await kv.get(kvKey(id), 'json') as Haul | null ?? undefined;
    if (haul) store.set(id, haul);
  }
  if (!haul) return undefined;
  // Lazy expiry check
  if (new Date(haul.expiresAt).getTime() < Date.now()) {
    store.delete(id);
    return undefined;
  }
  return haul;
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

  store.set(id, haul);
  if (kv) {
    await kv.put(kvKey(id), JSON.stringify(haul), { expirationTtl: remainingTtlSeconds(haul) });
  }
  return { haul, added: true, replaced };
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
  store.set(id, haul);
  if (kv) {
    await kv.put(kvKey(id), JSON.stringify(haul), { expirationTtl: remainingTtlSeconds(haul) });
  }
  return { haul, removed: true };
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

  store.set(id, haul);
  if (kv) {
    await kv.put(kvKey(id), JSON.stringify(haul), { expirationTtl: remainingTtlSeconds(haul) });
  }
  return haul;
}
