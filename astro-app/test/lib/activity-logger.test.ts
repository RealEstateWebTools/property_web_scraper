import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  logActivity,
  queryLogs,
  getLogStats,
  clearLogs,
  type LogInput,
} from '../../src/lib/services/activity-logger.js';

function makeEntry(overrides: Partial<LogInput> = {}): LogInput {
  return {
    level: 'info',
    category: 'api_request',
    message: 'test message',
    ...overrides,
  };
}

describe('activity-logger', () => {
  beforeEach(() => {
    clearLogs();
  });

  it('logs and retrieves entries', () => {
    logActivity(makeEntry({ message: 'hello' }));
    const result = queryLogs();
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].message).toBe('hello');
    expect(result.total).toBe(1);
  });

  it('assigns monotonically increasing IDs', () => {
    logActivity(makeEntry());
    logActivity(makeEntry());
    logActivity(makeEntry());
    const result = queryLogs();
    const ids = result.entries.map((e) => parseInt(e.id, 10));
    // Newest first
    expect(ids[0]).toBeGreaterThan(ids[1]);
    expect(ids[1]).toBeGreaterThan(ids[2]);
  });

  it('returns entries newest-first', () => {
    logActivity(makeEntry({ message: 'first' }));
    logActivity(makeEntry({ message: 'second' }));
    logActivity(makeEntry({ message: 'third' }));
    const result = queryLogs();
    expect(result.entries[0].message).toBe('third');
    expect(result.entries[2].message).toBe('first');
  });

  it('circular buffer overwrites oldest entries when full', () => {
    for (let i = 0; i < 1005; i++) {
      logActivity(makeEntry({ message: `msg-${i}` }));
    }
    const result = queryLogs({ limit: 1000 });
    expect(result.total).toBe(1000);
    // Oldest should be msg-5 (0-4 overwritten)
    const oldest = result.entries[result.entries.length - 1];
    expect(oldest.message).toBe('msg-5');
    // Newest should be msg-1004
    expect(result.entries[0].message).toBe('msg-1004');
  });

  describe('queryLogs filtering', () => {
    beforeEach(() => {
      logActivity(makeEntry({ level: 'info', category: 'api_request', message: 'request ok' }));
      logActivity(makeEntry({ level: 'warn', category: 'auth', message: 'bad key' }));
      logActivity(makeEntry({ level: 'error', category: 'extraction', message: 'parse failed' }));
      logActivity(makeEntry({ level: 'warn', category: 'rate_limit', message: 'blocked' }));
    });

    it('filters by level', () => {
      const result = queryLogs({ level: 'warn' });
      expect(result.total).toBe(2);
      expect(result.entries.every((e) => e.level === 'warn')).toBe(true);
    });

    it('filters by category', () => {
      const result = queryLogs({ category: 'auth' });
      expect(result.total).toBe(1);
      expect(result.entries[0].category).toBe('auth');
    });

    it('filters by search term', () => {
      const result = queryLogs({ search: 'parse' });
      expect(result.total).toBe(1);
      expect(result.entries[0].message).toBe('parse failed');
    });

    it('search is case-insensitive', () => {
      const result = queryLogs({ search: 'BLOCKED' });
      expect(result.total).toBe(1);
    });

    it('combines level and category filters', () => {
      const result = queryLogs({ level: 'warn', category: 'rate_limit' });
      expect(result.total).toBe(1);
      expect(result.entries[0].message).toBe('blocked');
    });
  });

  describe('queryLogs pagination', () => {
    beforeEach(() => {
      for (let i = 0; i < 10; i++) {
        logActivity(makeEntry({ message: `item-${i}` }));
      }
    });

    it('respects limit', () => {
      const result = queryLogs({ limit: 3 });
      expect(result.entries).toHaveLength(3);
      expect(result.total).toBe(10);
    });

    it('respects offset', () => {
      const result = queryLogs({ limit: 3, offset: 3 });
      expect(result.entries).toHaveLength(3);
      expect(result.entries[0].message).toBe('item-6');
    });

    it('handles offset beyond available entries', () => {
      const result = queryLogs({ offset: 100 });
      expect(result.entries).toHaveLength(0);
      expect(result.total).toBe(10);
    });
  });

  describe('getLogStats', () => {
    it('returns correct counts by level and category', () => {
      logActivity(makeEntry({ level: 'info', category: 'api_request' }));
      logActivity(makeEntry({ level: 'info', category: 'api_request' }));
      logActivity(makeEntry({ level: 'warn', category: 'auth' }));
      logActivity(makeEntry({ level: 'error', category: 'extraction' }));

      const stats = getLogStats();
      expect(stats.totalEntries).toBe(4);
      expect(stats.capacity).toBe(1000);
      expect(stats.byLevel.info).toBe(2);
      expect(stats.byLevel.warn).toBe(1);
      expect(stats.byLevel.error).toBe(1);
      expect(stats.byCategory.api_request).toBe(2);
      expect(stats.byCategory.auth).toBe(1);
      expect(stats.byCategory.extraction).toBe(1);
    });

    it('returns null timestamps when empty', () => {
      const stats = getLogStats();
      expect(stats.oldestTimestamp).toBeNull();
      expect(stats.newestTimestamp).toBeNull();
    });

    it('tracks oldest and newest timestamps', () => {
      logActivity(makeEntry());
      logActivity(makeEntry());
      const stats = getLogStats();
      expect(stats.oldestTimestamp).toBeLessThanOrEqual(stats.newestTimestamp!);
    });
  });

  describe('clearLogs', () => {
    it('empties the buffer', () => {
      logActivity(makeEntry());
      logActivity(makeEntry());
      clearLogs();
      const result = queryLogs();
      expect(result.total).toBe(0);
      expect(result.entries).toHaveLength(0);
    });

    it('IDs continue to increase after clear', () => {
      logActivity(makeEntry());
      const beforeClear = queryLogs().entries[0].id;
      clearLogs();
      logActivity(makeEntry());
      const afterClear = queryLogs().entries[0].id;
      expect(parseInt(afterClear, 10)).toBeGreaterThan(parseInt(beforeClear, 10));
    });
  });

  describe('production console logging', () => {
    const originalNodeEnv = process.env.NODE_ENV;

    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('logs info entries to console.log in production', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logActivity(makeEntry({ level: 'info', message: 'prod info' }));
      expect(spy).toHaveBeenCalledOnce();
      spy.mockRestore();
    });

    it('logs warn entries to console.warn in production', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      logActivity(makeEntry({ level: 'warn', message: 'prod warn' }));
      expect(spy).toHaveBeenCalledOnce();
      spy.mockRestore();
    });

    it('logs error entries to console.error in production', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      logActivity(makeEntry({ level: 'error', message: 'prod error' }));
      expect(spy).toHaveBeenCalledOnce();
      spy.mockRestore();
    });
  });
});
