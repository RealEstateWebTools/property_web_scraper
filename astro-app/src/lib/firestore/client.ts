import { existsSync, readFileSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Astro/Vite loads .env into import.meta.env, not process.env.
// Manually load .env into process.env so @google-cloud/firestore can find credentials.
function loadEnvIfNeeded() {
  if (process.env.__DOTENV_LOADED__) return;
  // Walk up from this file to find the .env at the project root
  let dir = typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i++) {
    const envPath = join(dir, '.env');
    if (existsSync(envPath)) {
      const content = readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex === -1) continue;
        const key = trimmed.slice(0, eqIndex).trim();
        const value = trimmed.slice(eqIndex + 1).trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
      console.log(`[Firestore] Loaded .env from ${envPath}`);
      process.env.__DOTENV_LOADED__ = '1';
      return;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  console.warn('[Firestore] No .env file found');
}

loadEnvIfNeeded();

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

  console.log('[Firestore] Initializing client...');
  console.log(`[Firestore]   projectId: ${projectId}`);
  console.log(`[Firestore]   FIRESTORE_EMULATOR_HOST: ${process.env.FIRESTORE_EMULATOR_HOST || '(not set)'}`);
  console.log(`[Firestore]   GOOGLE_APPLICATION_CREDENTIALS: ${process.env.GOOGLE_APPLICATION_CREDENTIALS || '(not set)'}`);
  console.log(`[Firestore]   cwd: ${process.cwd()}`);

  if (process.env.FIRESTORE_EMULATOR_HOST) {
    console.log(`[Firestore] Using emulator at ${process.env.FIRESTORE_EMULATOR_HOST}`);
    return new Firestore({ projectId });
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const rawPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const resolvedPath = resolve(rawPath);
    const fileExists = existsSync(resolvedPath);
    console.log(`[Firestore]   Resolved credentials path: ${resolvedPath}`);
    console.log(`[Firestore]   File exists: ${fileExists}`);
    if (!fileExists) {
      console.error(`[Firestore] ERROR: Credentials file not found at ${resolvedPath}`);
      console.error(`[Firestore]   Raw GOOGLE_APPLICATION_CREDENTIALS value: "${rawPath}"`);
      console.error(`[Firestore]   Tip: Use an absolute path in .env, or check that the file exists.`);
    }
    try {
      const firestore = new Firestore({ projectId, keyFilename: resolvedPath });
      console.log('[Firestore] Client created with service account credentials.');
      return firestore;
    } catch (err: any) {
      console.error(`[Firestore] ERROR creating client: ${err.message}`);
      throw err;
    }
  }

  console.log('[Firestore] No credentials configured — falling back to Application Default Credentials (ADC).');
  console.log('[Firestore]   Tip: Set GOOGLE_APPLICATION_CREDENTIALS or FIRESTORE_EMULATOR_HOST in your .env file.');
  return new Firestore({ projectId });
}

export function getCollectionPrefix(): string {
  return process.env.FIRESTORE_COLLECTION_PREFIX || '';
}
