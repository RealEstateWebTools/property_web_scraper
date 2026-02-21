/**
 * Retention Cleanup Service
 * Request-driven probabilistic cleanup for Cloudflare Pages (no cron).
 *
 * - maybeTriggerCleanup(): 1% chance per call, rate-limited to once/hour
 * - runCleanup(): queries each collection, deletes expired docs in batches
 * - Client-side date filtering (REST client only supports EQUAL where clauses)
 */

import { getClient, getCollectionPrefix } from '../firestore/client.js';
import { getRetentionConfig, getTtlForCollection } from './retention-config.js';
import { logActivity } from './activity-logger.js';

export interface CleanupResult {
  timestamp: number;
  dryRun: boolean;
  collectionsProcessed: number;
  totalDocumentsDeleted: number;
  details: CollectionCleanupResult[];
  durationMs: number;
}

export interface CollectionCleanupResult {
  collection: string;
  ttlDays: number;
  totalDocs: number;
  expiredDocs: number;
  deletedDocs: number;
}

const MAX_BATCH_SIZE = 100;
const CLEANUP_PROBABILITY = 0.01; // 1% chance
const CLEANUP_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

let lastCleanupTimestamp = 0;
let lastCleanupResult: CleanupResult | null = null;

export function getLastCleanupResult(): CleanupResult | null {
  return lastCleanupResult;
}

/**
 * Determine if a document is expired based on its timestamp field and TTL.
 */
function isExpired(doc: Record<string, unknown>, ttlDays: number): boolean {
  const timestamp = (doc.timestamp as number) || (doc.created_at as number) || 0;
  if (!timestamp) return false;
  const cutoff = Date.now() - ttlDays * 24 * 60 * 60 * 1000;
  return timestamp < cutoff;
}

export async function runCleanup(opts?: { dryRun?: boolean }): Promise<CleanupResult> {
  const dryRun = opts?.dryRun ?? false;
  const startTime = Date.now();
  const config = await getRetentionConfig();
  const details: CollectionCleanupResult[] = [];
  let totalDeleted = 0;

  try {
    const db = await getClient();
    const prefix = getCollectionPrefix();

    for (const policy of config.policies) {
      const ttl = getTtlForCollection(config, policy.collectionName);
      if (ttl === null) continue;

      const collectionPath = `${prefix}${policy.collectionName}`;
      let totalDocs = 0;
      let expiredDocs = 0;
      let deletedDocs = 0;

      try {
        const snapshot = await db.collection(collectionPath).get();
        totalDocs = snapshot.docs.length;

        for (const doc of snapshot.docs) {
          const data = doc.data() as Record<string, unknown>;
          if (isExpired(data, ttl)) {
            expiredDocs++;
            if (!dryRun && deletedDocs < MAX_BATCH_SIZE) {
              await doc.ref.delete();
              deletedDocs++;
              totalDeleted++;
            }
          }
        }
      } catch {
        // Collection may not exist or Firestore error — skip
      }

      details.push({
        collection: policy.collectionName,
        ttlDays: ttl,
        totalDocs,
        expiredDocs,
        deletedDocs,
      });
    }
  } catch (err) {
    logActivity({
      level: 'error',
      category: 'system',
      message: '[RetentionCleanup] Cleanup failed: ' + ((err as Error).message || err),
    });
  }

  const result: CleanupResult = {
    timestamp: Date.now(),
    dryRun,
    collectionsProcessed: details.length,
    totalDocumentsDeleted: totalDeleted,
    details,
    durationMs: Date.now() - startTime,
  };

  lastCleanupResult = result;
  lastCleanupTimestamp = Date.now();

  if (!dryRun && totalDeleted > 0) {
    logActivity({
      level: 'info',
      category: 'system',
      message: `[RetentionCleanup] Deleted ${totalDeleted} expired documents across ${details.length} collections`,
    });
  }

  return result;
}

/**
 * Probabilistic cleanup trigger. Call on admin/API requests.
 * 1% chance of running, rate-limited to once per hour.
 */
export function maybeTriggerCleanup(): void {
  if (Math.random() > CLEANUP_PROBABILITY) return;
  if (Date.now() - lastCleanupTimestamp < CLEANUP_COOLDOWN_MS) return;

  // Fire-and-forget
  runCleanup().catch((err) => {
    logActivity({
      level: 'error',
      category: 'system',
      message: '[RetentionCleanup] Background cleanup failed: ' + ((err as Error).message || err),
    });
  });
}
