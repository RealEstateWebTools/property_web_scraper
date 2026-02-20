/**
 * Usage Metering Service
 *
 * Tracks per-user daily extraction counts in KV.
 * Used for:
 *   - Daily quota enforcement (Free: 500/day, Starter: 5K, Pro: 25K)
 *   - Usage reporting via /public_api/v1/usage endpoint
 *   - Admin dashboard analytics
 *
 * KV schema:
 *   "usage:{userId}:{YYYY-MM-DD}" → { extractions: number, lastUpdated: string }
 *   TTL: 90 days (auto-expires stale data)
 */

import type { SubscriptionTier } from './api-key-service.js';

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

// ─── KV handle ──────────────────────────────────────────────────

let kv: any = null;
const memStore = new Map<string, string>();

/**
 * In-memory cache for today's usage count per user.
 * Avoids hitting KV on every quota check (the hot path).
 * TTL: 60 seconds — stale reads are acceptable since quotas are soft limits.
 */
const usageCache = new Map<string, { count: number; expiresAt: number }>();
const USAGE_CACHE_TTL_MS = 60_000;

export function initUsageKV(kvNamespace: any): void {
  kv = kvNamespace ?? null;
}

async function kvGet(key: string): Promise<string | null> {
  if (kv) return kv.get(key);
  return memStore.get(key) ?? null;
}

async function kvPut(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
  if (kv) return kv.put(key, value, options);
  memStore.set(key, value);
}

/** Clear all in-memory data. For testing only. */
export function resetUsageMeter(): void {
  memStore.clear();
  usageCache.clear();
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

// ─── Core functions ─────────────────────────────────────────────

/**
 * Record a usage event for a user.
 * Increments the daily counter.
 */
export async function recordUsage(userId: string): Promise<void> {
  const date = todayStr();
  const key = `usage:${userId}:${date}`;
  const existing = await kvGet(key);

  let record: { extractions: number; lastUpdated: string };
  if (existing) {
    record = JSON.parse(existing);
    record.extractions++;
  } else {
    record = { extractions: 1, lastUpdated: '' };
  }
  record.lastUpdated = new Date().toISOString();

  // 90-day TTL so old usage data auto-expires
  await kvPut(key, JSON.stringify(record), { expirationTtl: 90 * 86400 });

  // Update cache so the next getTodayUsage() is instant
  usageCache.set(userId, {
    count: record.extractions,
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
    const key = `usage:${userId}:${date}`;
    const json = await kvGet(key);
    if (json) {
      const record = JSON.parse(json);
      usage.push({ date, extractions: record.extractions, lastUpdated: record.lastUpdated });
    } else {
      usage.push({ date, extractions: 0, lastUpdated: '' });
    }
  }

  return usage;
}

/**
 * Get today's usage count for a user.
 * Uses an in-memory cache (60s TTL) to avoid KV reads on the hot path.
 */
export async function getTodayUsage(userId: string): Promise<number> {
  // Check cache first
  const cached = usageCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.count;
  }

  const key = `usage:${userId}:${todayStr()}`;
  const json = await kvGet(key);
  const count = json ? JSON.parse(json).extractions : 0;

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
