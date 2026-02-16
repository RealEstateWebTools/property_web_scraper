import { InMemoryFirestoreClient } from './in-memory-backend.js';

let client: any = null;

/**
 * Singleton Firestore client (always in-memory for Cloudflare Workers).
 */
export async function getClient() {
  if (client) return client;
  client = new InMemoryFirestoreClient();
  return client;
}

export function resetClient(): void {
  client = null;
}

/**
 * Allow injecting a mock/in-memory client for tests.
 */
export function setClient(c: unknown): void {
  client = c;
}

export function getCollectionPrefix(): string {
  return '';
}
