/**
 * Retention Configuration Service
 * Configurable TTL per Firestore collection.
 *
 * Stored in Firestore doc: {prefix}retention_config/current
 * Falls back to DEFAULT_POLICIES when Firestore is unavailable.
 */

import { getClient, getCollectionPrefix } from '../firestore/client.js';

export interface RetentionPolicy {
  collectionName: string;
  ttlDays: number;
  description: string;
}

export interface RetentionConfig {
  policies: RetentionPolicy[];
  updatedAt: number;
}

export const DEFAULT_POLICIES: RetentionPolicy[] = [
  { collectionName: 'diagnostics', ttlDays: 90, description: 'Field traces, quality scores' },
  { collectionName: 'price_history', ttlDays: 365, description: 'Price snapshots' },
  { collectionName: 'scrape_metadata', ttlDays: 90, description: 'Scrape records' },
  { collectionName: 'audit_log', ttlDays: 90, description: 'Audit entries' },
  { collectionName: 'scraper_health', ttlDays: 180, description: 'Health snapshots' },
  { collectionName: 'export_history', ttlDays: 90, description: 'Export activity' },
  { collectionName: 'hauls', ttlDays: 30, description: 'Haul sessions (already has TTL)' },
];

// Listings are exempt from retention — never expired
const EXEMPT_COLLECTIONS = ['listings'];

let cachedConfig: RetentionConfig | null = null;

export function isExempt(collectionName: string): boolean {
  return EXEMPT_COLLECTIONS.includes(collectionName);
}

export async function getRetentionConfig(): Promise<RetentionConfig> {
  if (cachedConfig) return cachedConfig;

  try {
    const db = await getClient();
    const prefix = getCollectionPrefix();
    const doc = await db.collection(`${prefix}retention_config`).doc('current').get();
    if (doc.exists) {
      cachedConfig = doc.data() as RetentionConfig;
      return cachedConfig;
    }
  } catch {
    // Firestore unavailable — use defaults
  }

  const config: RetentionConfig = {
    policies: [...DEFAULT_POLICIES],
    updatedAt: Date.now(),
  };
  cachedConfig = config;
  return config;
}

export async function updateRetentionPolicy(
  collectionName: string,
  ttlDays: number,
): Promise<RetentionConfig> {
  if (isExempt(collectionName)) {
    throw new Error(`Collection '${collectionName}' is exempt from retention policies`);
  }
  if (ttlDays < 1) {
    throw new Error('TTL must be at least 1 day');
  }

  const config = await getRetentionConfig();
  const existing = config.policies.find(p => p.collectionName === collectionName);
  if (existing) {
    existing.ttlDays = ttlDays;
  } else {
    config.policies.push({ collectionName, ttlDays, description: '' });
  }
  config.updatedAt = Date.now();

  // Persist to Firestore
  try {
    const db = await getClient();
    const prefix = getCollectionPrefix();
    await db.collection(`${prefix}retention_config`).doc('current').set(JSON.parse(JSON.stringify(config)));
  } catch {
    // Firestore unavailable — config updated in memory only
  }

  cachedConfig = config;
  return config;
}

export function getTtlForCollection(config: RetentionConfig, collectionName: string): number | null {
  if (isExempt(collectionName)) return null;
  const policy = config.policies.find(p => p.collectionName === collectionName);
  return policy ? policy.ttlDays : null;
}

export function clearRetentionConfigCache(): void {
  cachedConfig = null;
}
