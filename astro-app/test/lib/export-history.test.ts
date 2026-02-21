import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordExport,
  getExportHistory,
  getAllExportHistory,
  clearExportHistory,
} from '../../src/lib/services/export-history.js';

describe('export-history', () => {
  beforeEach(async () => {
    await clearExportHistory();
  });

  describe('recordExport()', () => {
    it('creates a history entry with all fields', async () => {
      const entry = await recordExport('user-1', 'json', 5, 'export.json');

      expect(entry.id).toBeTruthy();
      expect(entry.userId).toBe('user-1');
      expect(entry.format).toBe('json');
      expect(entry.listingCount).toBe(5);
      expect(entry.filename).toBe('export.json');
      expect(entry.timestamp).toBeGreaterThan(0);
    });

    it('generates unique IDs for each entry', async () => {
      const a = await recordExport('user-1', 'json', 1, 'a.json');
      const b = await recordExport('user-1', 'csv', 2, 'b.csv');

      expect(a.id).not.toBe(b.id);
    });

    it('returns entries with both filenames present', async () => {
      await recordExport('user-1', 'json', 1, 'first.json');
      await recordExport('user-1', 'csv', 2, 'second.csv');

      const history = await getAllExportHistory();
      const filenames = history.map(e => e.filename);
      expect(filenames).toContain('first.json');
      expect(filenames).toContain('second.csv');
    });
  });

  describe('getExportHistory()', () => {
    it('returns entries for a specific user', async () => {
      await recordExport('user-1', 'json', 1, 'u1.json');
      await recordExport('user-2', 'csv', 2, 'u2.csv');
      await recordExport('user-1', 'xml', 3, 'u1.xml');

      const history = await getExportHistory('user-1');
      expect(history).toHaveLength(2);
      expect(history.every(e => e.userId === 'user-1')).toBe(true);
    });

    it('returns all entries when no userId specified', async () => {
      await recordExport('user-1', 'json', 1, 'u1.json');
      await recordExport('user-2', 'csv', 2, 'u2.csv');

      const history = await getExportHistory();
      expect(history).toHaveLength(2);
    });

    it('respects the limit parameter', async () => {
      for (let i = 0; i < 10; i++) {
        await recordExport('user-1', 'json', i, `export-${i}.json`);
      }

      const history = await getExportHistory(undefined, 3);
      expect(history).toHaveLength(3);
    });

    it('returns empty array when no entries exist', async () => {
      const history = await getExportHistory('no-such-user');
      expect(history).toEqual([]);
    });
  });

  describe('getAllExportHistory()', () => {
    it('returns all entries across users', async () => {
      await recordExport('user-1', 'json', 1, 'a.json');
      await recordExport('user-2', 'csv', 2, 'b.csv');
      await recordExport('user-3', 'xml', 3, 'c.xml');

      const history = await getAllExportHistory();
      expect(history).toHaveLength(3);
    });

    it('respects the limit parameter', async () => {
      for (let i = 0; i < 10; i++) {
        await recordExport(`user-${i}`, 'json', 1, `export-${i}.json`);
      }

      const history = await getAllExportHistory(5);
      expect(history).toHaveLength(5);
    });

    it('returns empty array when store is empty', async () => {
      const history = await getAllExportHistory();
      expect(history).toEqual([]);
    });
  });

  describe('clearExportHistory()', () => {
    it('removes all entries', async () => {
      await recordExport('user-1', 'json', 1, 'a.json');
      await recordExport('user-2', 'csv', 2, 'b.csv');

      expect((await getAllExportHistory()).length).toBe(2);

      await clearExportHistory();

      expect((await getAllExportHistory()).length).toBe(0);
    });
  });

  describe('Firestore persistence', () => {
    it('stores and retrieves many entries', async () => {
      for (let i = 0; i < 10; i++) {
        await recordExport('user-1', 'json', 1, `export-${i}.json`);
      }

      const history = await getAllExportHistory(300);
      expect(history.length).toBe(10);
    });
  });
});
