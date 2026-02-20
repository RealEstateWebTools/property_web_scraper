import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordUsage,
  getTodayUsage,
  getUsage,
  checkDailyQuota,
  getUsageSummary,
  getDailyLimit,
  resetUsageMeter,
} from '../../src/lib/services/usage-meter.js';

describe('usage-meter', () => {
  beforeEach(() => {
    resetUsageMeter();
  });

  describe('recordUsage', () => {
    it('increments today counter', async () => {
      await recordUsage('user-1');
      expect(await getTodayUsage('user-1')).toBe(1);
    });

    it('increments multiple times', async () => {
      await recordUsage('user-1');
      await recordUsage('user-1');
      await recordUsage('user-1');
      expect(await getTodayUsage('user-1')).toBe(3);
    });

    it('isolates users', async () => {
      await recordUsage('user-1');
      await recordUsage('user-2');
      await recordUsage('user-2');
      expect(await getTodayUsage('user-1')).toBe(1);
      expect(await getTodayUsage('user-2')).toBe(2);
    });
  });

  describe('getTodayUsage', () => {
    it('returns 0 for new user', async () => {
      expect(await getTodayUsage('unknown')).toBe(0);
    });
  });

  describe('getUsage', () => {
    it('returns array of daily entries', async () => {
      await recordUsage('user-1');
      const usage = await getUsage('user-1', 7);
      expect(usage).toHaveLength(7);
      expect(usage[0].extractions).toBe(1); // today
      expect(usage[1].extractions).toBe(0); // yesterday (no data)
    });

    it('defaults to 30 days', async () => {
      const usage = await getUsage('user-1');
      expect(usage).toHaveLength(30);
    });
  });

  describe('checkDailyQuota', () => {
    it('allows usage under quota', async () => {
      const result = await checkDailyQuota('user-1', 'free');
      expect(result.allowed).toBe(true);
      expect(result.used).toBe(0);
      expect(result.limit).toBe(500);
      expect(result.remaining).toBe(500);
    });

    it('blocks when quota exceeded', async () => {
      for (let i = 0; i < 500; i++) {
        await recordUsage('user-1');
      }
      const result = await checkDailyQuota('user-1', 'free');
      expect(result.allowed).toBe(false);
      expect(result.used).toBe(500);
      expect(result.remaining).toBe(0);
    });

    it('higher tier has higher limit', async () => {
      for (let i = 0; i < 500; i++) {
        await recordUsage('user-2');
      }
      const freeResult = await checkDailyQuota('user-2', 'free');
      const starterResult = await checkDailyQuota('user-2', 'starter');
      expect(freeResult.allowed).toBe(false);
      expect(starterResult.allowed).toBe(true);
      expect(starterResult.remaining).toBe(4500);
    });
  });

  describe('getDailyLimit', () => {
    it('returns correct limits per tier', () => {
      expect(getDailyLimit('free')).toBe(500);
      expect(getDailyLimit('starter')).toBe(5000);
      expect(getDailyLimit('pro')).toBe(25000);
      expect(getDailyLimit('enterprise')).toBe(100000);
    });
  });

  describe('getTodayUsage caching', () => {
    it('returns cached value on second call without extra KV read', async () => {
      await recordUsage('cache-user');
      const first = await getTodayUsage('cache-user');
      const second = await getTodayUsage('cache-user');
      expect(first).toBe(1);
      expect(second).toBe(1);
    });

    it('cache is updated after recordUsage', async () => {
      await recordUsage('cache-user');
      expect(await getTodayUsage('cache-user')).toBe(1);
      await recordUsage('cache-user');
      expect(await getTodayUsage('cache-user')).toBe(2);
    });

    it('cache is cleared by resetUsageMeter', async () => {
      await recordUsage('cache-user');
      expect(await getTodayUsage('cache-user')).toBe(1);
      resetUsageMeter();
      expect(await getTodayUsage('cache-user')).toBe(0);
    });
  });

  describe('getUsageSummary', () => {
    it('returns complete summary', async () => {
      await recordUsage('user-1');
      await recordUsage('user-1');

      const summary = await getUsageSummary('user-1', 'starter');
      expect(summary.userId).toBe('user-1');
      expect(summary.today).toBe(2);
      expect(summary.thisMonth).toBe(2);
      expect(summary.last30Days).toHaveLength(30);
      expect(summary.quota.tier).toBe('starter');
      expect(summary.quota.limit).toBe(5000);
      expect(summary.quota.used).toBe(2);
      expect(summary.quota.remaining).toBe(4998);
    });

    it('returns zeros for new user', async () => {
      const summary = await getUsageSummary('new-user', 'free');
      expect(summary.today).toBe(0);
      expect(summary.thisMonth).toBe(0);
      expect(summary.quota.remaining).toBe(500);
    });
  });
});
