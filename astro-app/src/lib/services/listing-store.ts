import type { Listing } from '../models/listing.js';

/**
 * In-memory store for extracted listings, keyed by a generated ID.
 * Used by POST handlers to store results before redirecting to the results page.
 */
const store = new Map<string, Listing>();

let counter = 0;

export function generateId(): string {
  counter++;
  return `${Date.now().toString(36)}-${counter.toString(36)}`;
}

export function storeListing(id: string, listing: Listing): void {
  store.set(id, listing);
}

export function getListing(id: string): Listing | undefined {
  return store.get(id);
}

export function getAllListings(): Array<{ id: string; listing: Listing }> {
  return Array.from(store.entries()).map(([id, listing]) => ({ id, listing }));
}
