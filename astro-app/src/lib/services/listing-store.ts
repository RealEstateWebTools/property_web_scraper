import type { Listing } from '../models/listing.js';

/**
 * KV-backed store for extracted listings, with in-memory fallback.
 * On Cloudflare Workers, each isolate has its own memory, so the in-memory
 * Map alone cannot persist data across the POST→redirect→GET flow.
 * KV provides cross-isolate persistence.
 */

let kv: any = null;
const store = new Map<string, Listing>();
let counter = 0;

/** Call once per request with the RESULTS KV binding from Astro.locals.runtime.env */
export function initKV(kvNamespace: any): void {
  kv = kvNamespace ?? null;
}

export function generateId(): string {
  counter++;
  return `${Date.now().toString(36)}-${counter.toString(36)}`;
}

export async function storeListing(id: string, listing: Listing): Promise<void> {
  store.set(id, listing);
  if (kv) {
    await kv.put(`listing:${id}`, JSON.stringify(listing), { expirationTtl: 3600 });
  }
}

export async function getListing(id: string): Promise<Listing | undefined> {
  const cached = store.get(id);
  if (cached) return cached;
  if (kv) {
    const data = await kv.get(`listing:${id}`, 'json') as Listing | null;
    if (data) {
      store.set(id, data);
      return data;
    }
  }
  return undefined;
}

export async function getAllListings(): Promise<Array<{ id: string; listing: Listing }>> {
  // In-memory listings only; KV list is not practical for browsing
  return Array.from(store.entries()).map(([id, listing]) => ({ id, listing }));
}

export function getStoreStats(): { count: number } {
  return { count: store.size };
}

export function clearListingStore(): void {
  store.clear();
}
