import { InMemoryFirestoreClient } from './in-memory-backend.js';
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
 * If FIRESTORE_PROJECT_ID + GOOGLE_SERVICE_ACCOUNT_JSON are set, tries REST client.
 * Falls back to in-memory on failure.
 */
export async function getClient(): Promise<FirestoreClient> {
  if (client) return client;

  const projectId = import.meta.env.FIRESTORE_PROJECT_ID;
  const serviceAccountJson = import.meta.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (projectId && serviceAccountJson) {
    try {
      const creds = parseServiceAccountJson(serviceAccountJson);
      const restClient = new RestFirestoreClient(creds);
      const health = await restClient.healthCheck();
      if (health.ok) {
        client = restClient;
        storageStatus = {
          backend: 'firestore_rest',
          connected: true,
          projectId: creds.project_id,
          error: null,
        };
        return client;
      }
      // Health check failed — fall back to in-memory
      storageStatus = {
        backend: 'in_memory',
        connected: false,
        projectId: creds.project_id,
        error: `REST health check failed: ${health.error}`,
      };
    } catch (err) {
      storageStatus = {
        backend: 'in_memory',
        connected: false,
        projectId: projectId || null,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  client = new InMemoryFirestoreClient();
  storageStatus = {
    ...storageStatus,
    backend: storageStatus.error ? storageStatus.backend : 'in_memory',
    connected: storageStatus.backend === 'in_memory' ? true : storageStatus.connected,
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
