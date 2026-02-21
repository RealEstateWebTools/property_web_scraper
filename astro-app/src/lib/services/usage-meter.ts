/**
 * Usage Metering Service
 *
 * Tracks per-user daily extraction counts in Firestore.
 * Used for:
 *   - Daily quota enforcement (Free: 500/day, Starter: 5K, Pro: 25K)
 *   - Usage reporting via /public_api/v1/usage endpoint
 *   - Admin dashboard analytics
 *
 * Firestore schema:
 *   Collection: {prefix}daily_usage
 *   Document ID: "{userId}:{YYYY-MM-DD}"
 *   Fields: userId, date, extractions, lastUpdated
 */

import type { SubscriptionTier } from './api-key-service.js';
import { getClient, getCollectionPrefix } from '../firestore/client.js';

// ─── Types ──────────────────────────────────────────────────────

export interface DailyUsage {
  date: string;
  extractions: number;
  lastUpdated: string;
}

export interface UsageSummary {
  userId: string;
  today: number;
  thisMonth: number;
  last30Days: DailyUsage[];
  quota: { limit: number; used: number; remaining: number; tier: string };
}

// ─── Tier daily limits ──────────────────────────────────────────

const DAILY_LIMITS: Record<SubscriptionTier, number> = {
  free: 500,
  starter: 5000,
  pro: 25000,
  enterprise: 100000,
};

export function getDailyLimit(tier: SubscriptionTier): number {
  return DAILY_LIMITS[tier] ?? DAILY_LIMITS.free;
}

// ─── In-memory cache (60s TTL) ──────────────────────────────────

/**
 * In-memory cache for today's usage count per user.
 * Avoids hitting Firestore on every quota check (the hot path).
 * TTL: 60 seconds — stale reads are acceptable since quotas are soft limits.
 */
const usageCache = new Map<string, { count: number; expiresAt: number }>();
const USAGE_CACHE_TTL_MS = 60_000;

/** In-memory fallback store (used when Firestore is unavailable). */
const memStore = new Map<string, string>();

/** Clear all in-memory and Firestore data. For testing only. */
export async function resetUsageMeter(): Promise<void> {
  memStore.clear();
  usageCache.clear();
  // Clear Firestore state (for test environments)
  try {
    const db = await getClient();
    const prefix = getCollectionPrefix();
    const snap = await db.collection(`${prefix}daily_usage`).get();
    for (const doc of snap.docs) {
      await doc.ref.delete();
    }
  } catch {
    // Firestore unavailable — in-memory already cleared above
  }
}

// ─── Date helpers ───────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateRange(days: number): string[] {
  const dates: string[] = [];
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

// ─── Firestore helpers ──────────────────────────────────────────

async function firestoreGetUsage(userId: string, date: string): Promise<{ extractions: number; lastUpdated: string } | null> {
  try {
    const db = await getClient();
    const prefix = getCollectionPrefix();
    const docId = `${userId}:${date}`;
    const doc = await db.collection(`${prefix}daily_usage`).doc(docId).get();
    if (!doc.exists) return null;
    return doc.data() as { extractions: number; lastUpdated: string };
  } catch {
    return null;
  }
}

async function firestoreIncrementUsage(userId: string, date: string): Promise<number> {
  try {
    const db = await getClient();
    const prefix = getCollectionPrefix();
    const docId = `${userId}:${date}`;
    const col = db.collection(`${prefix}daily_usage`);
    const docRef = col.doc(docId);
    const existing = await docRef.get();
    const lastUpdated = new Date().toISOString();

    if (existing.exists) {
      const data = existing.data() as { extractions: number };
      const newCount = (data.extractions || 0) + 1;
      await docRef.set({ userId, date, extractions: newCount, lastUpdated });
      return newCount;
    } else {
      await docRef.set({ userId, date, extractions: 1, lastUpdated });
      return 1;
    }
  } catch {
    // Firestore unavailable — use in-memory fallback
    const key = `${userId}:${date}`;
    const existing = memStore.get(key);
    const record = existing ? JSON.parse(existing) : { extractions: 0 };
    record.extractions++;
    record.lastUpdated = new Date().toISOString();
    memStore.set(key, JSON.stringify(record));
    return record.extractions;
  }
}

// ─── Core functions ─────────────────────────────────────────────

/**
 * Record a usage event for a user.
 * Increments the daily counter.
 */
export async function recordUsage(userId: string): Promise<void> {
  const date = todayStr();
  const newCount = await firestoreIncrementUsage(userId, date);

  // Update cache so the next getTodayUsage() is instant
  usageCache.set(userId, {
    count: newCount,
    expiresAt: Date.now() + USAGE_CACHE_TTL_MS,
  });
}

/**
 * Get daily usage for a user over the last N days.
 */
export async function getUsage(userId: string, days = 30): Promise<DailyUsage[]> {
  const dates = dateRange(days);
  const usage: DailyUsage[] = [];

  for (const date of dates) {
    const record = await firestoreGetUsage(userId, date);
    if (record) {
      usage.push({ date, extractions: record.extractions, lastUpdated: record.lastUpdated });
    } else {
      // Check in-memory fallback
      const key = `${userId}:${date}`;
      const memVal = memStore.get(key);
      if (memVal) {
        const parsed = JSON.parse(memVal);
        usage.push({ date, extractions: parsed.extractions, lastUpdated: parsed.lastUpdated });
      } else {
        usage.push({ date, extractions: 0, lastUpdated: '' });
      }
    }
  }

  return usage;
}

/**
 * Get today's usage count for a user.
 * Uses an in-memory cache (60s TTL) to avoid Firestore reads on the hot path.
 */
export async function getTodayUsage(userId: string): Promise<number> {
  // Check cache first
  const cached = usageCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.count;
  }

  const record = await firestoreGetUsage(userId, todayStr());
  const count = record?.extractions ?? 0;

  // Populate cache
  usageCache.set(userId, { count, expiresAt: Date.now() + USAGE_CACHE_TTL_MS });
  return count;
}

/**
 * Check if a user has exceeded their daily quota.
 */
export async function checkDailyQuota(
  userId: string,
  tier: SubscriptionTier,
): Promise<{ allowed: boolean; used: number; limit: number; remaining: number }> {
  const limit = getDailyLimit(tier);
  const used = await getTodayUsage(userId);
  const remaining = Math.max(0, limit - used);
  return { allowed: used < limit, used, limit, remaining };
}

/**
 * Get a complete usage summary for a user.
 */
export async function getUsageSummary(userId: string, tier: SubscriptionTier): Promise<UsageSummary> {
  const last30Days = await getUsage(userId, 30);
  const todayEntry = last30Days[0];
  const thisMonth = last30Days
    .filter(d => d.date.slice(0, 7) === todayStr().slice(0, 7))
    .reduce((sum, d) => sum + d.extractions, 0);
  const limit = getDailyLimit(tier);

  return {
    userId,
    today: todayEntry?.extractions ?? 0,
    thisMonth,
    last30Days,
    quota: {
      limit,
      used: todayEntry?.extractions ?? 0,
      remaining: Math.max(0, limit - (todayEntry?.extractions ?? 0)),
      tier,
    },
  };
}
