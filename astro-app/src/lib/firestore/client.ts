import { RestFirestoreClient, parseServiceAccountJson } from './rest-client.js';
import type { FirestoreClient, StorageStatus, StorageBackendType } from './types.js';

let client: FirestoreClient | null = null;
let storageStatus: StorageStatus = {
  backend: 'in_memory',
  connected: false,
  projectId: null,
  error: null,
};

/**
 * Singleton Firestore client.
 * Requires FIRESTORE_PROJECT_ID + GOOGLE_SERVICE_ACCOUNT_JSON to be set.
 * Throws with a clear error message if misconfigured or unreachable.
 */
export async function getClient(): Promise<FirestoreClient> {
  if (client) return client;

  const projectId = import.meta.env.FIRESTORE_PROJECT_ID;
  const serviceAccountJson = import.meta.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  const missing = [
    !projectId && 'FIRESTORE_PROJECT_ID',
    !serviceAccountJson && 'GOOGLE_SERVICE_ACCOUNT_JSON',
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(
      `[Storage] Firestore not configured — missing env vars: ${missing.join(', ')}. ` +
      `Add them to .dev.vars (local) or Cloudflare Pages environment variables (production).`
    );
  }

  console.log(`[Storage] Firestore REST configured — project: ${projectId}`);
  const creds = parseServiceAccountJson(serviceAccountJson);
  console.log(`[Storage] Service account: ${creds.client_email}`);
  const restClient = new RestFirestoreClient(creds);
  const health = await restClient.healthCheck();

  if (!health.ok) {
    throw new Error(
      `[Storage] Firestore health check failed for project "${creds.project_id}": ${health.error}`
    );
  }

  console.log(`[Storage] ✓ Firestore REST connected (project: ${creds.project_id})`);
  client = restClient;
  storageStatus = {
    backend: 'firestore_rest',
    connected: true,
    projectId: creds.project_id,
    error: null,
  };
  return client;
}

export function resetClient(): void {
  client = null;
  storageStatus = {
    backend: 'in_memory',
    connected: false,
    projectId: null,
    error: null,
  };
}

/**
 * Allow injecting a mock/in-memory client for tests.
 */
export function setClient(c: FirestoreClient): void {
  client = c;
}

export function getCollectionPrefix(): string {
  return import.meta.env.FIRESTORE_COLLECTION_PREFIX || '';
}

export function getStorageStatus(): StorageStatus {
  return { ...storageStatus };
}
