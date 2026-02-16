let client: any = null;
let firestoreModule: any = null;

/**
 * Singleton Firestore client (lazy-loaded).
 * Port of Ruby FirestoreClient module.
 */
export async function getClient() {
  if (client) return client;
  client = await buildClient();
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

async function buildClient() {
  if (!firestoreModule) {
    firestoreModule = await import('@google-cloud/firestore');
  }
  const { Firestore } = firestoreModule;
  const projectId = process.env.FIRESTORE_PROJECT_ID || 'property-web-scraper-dev';

  if (process.env.FIRESTORE_EMULATOR_HOST) {
    return new Firestore({ projectId });
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return new Firestore({
      projectId,
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });
  }

  // Fall back to Application Default Credentials
  return new Firestore({ projectId });
}

export function getCollectionPrefix(): string {
  return process.env.FIRESTORE_COLLECTION_PREFIX || '';
}
