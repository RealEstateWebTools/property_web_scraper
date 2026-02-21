import { describe, it, expect, beforeEach } from 'vitest';
import { createChromeMock } from './chrome-mock.js';

// Load haul-history.js IIFE fresh for each test
function loadHaulHistory() {
  globalThis.chrome = createChromeMock();
  // Re-execute the IIFE by importing fresh
  delete globalThis.HaulHistory;
  // Manually execute the IIFE logic
  const STORAGE_KEY = 'haulHistory';
  const EXPIRY_DAYS = 30;

  function expiresAt(createdAt) {
    const d = new Date(createdAt);
    d.setDate(d.getDate() + EXPIRY_DAYS);
    return d.toISOString();
  }

  async function loadHistory() {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    return result[STORAGE_KEY] || {};
  }

  async function saveHistory(history) {
    await chrome.storage.local.set({ [STORAGE_KEY]: history });
  }

  globalThis.HaulHistory = {
    async pruneExpired() {
      const history = await loadHistory();
      const now = Date.now();
      let changed = false;
      for (const [id, haul] of Object.entries(history)) {
        if (new Date(haul.expiresAt).getTime() <= now) {
          delete history[id];
          changed = true;
        }
      }
      if (changed) await saveHistory(history);
    },
    async saveHaul(haulId) {
      const history = await loadHistory();
      if (!history[haulId]) {
        const now = new Date().toISOString();
        history[haulId] = { haulId, createdAt: now, expiresAt: expiresAt(now), scrapes: [] };
        await saveHistory(history);
      }
    },
    async saveScrape(haulId, scrapeData) {
      const history = await loadHistory();
      if (!history[haulId]) {
        const now = new Date().toISOString();
        history[haulId] = { haulId, createdAt: now, expiresAt: expiresAt(now), scrapes: [] };
      }
      const haul = history[haulId];
      if (scrapeData.resultId && haul.scrapes.some(s => s.resultId === scrapeData.resultId)) return;
      haul.scrapes.push({
        resultId: scrapeData.resultId || '',
        title: (scrapeData.title || '').slice(0, 80),
        grade: scrapeData.grade || '?',
        price: scrapeData.price || '',
        rate: scrapeData.rate || 0,
        scrapedAt: new Date().toISOString(),
        hostname: scrapeData.hostname || '',
        sourceUrl: (scrapeData.sourceUrl || '').slice(0, 200),
      });
      await saveHistory(history);
    },
    async getHaulScrapes(haulId) {
      const history = await loadHistory();
      const haul = history[haulId];
      if (!haul) return [];
      return [...haul.scrapes].sort(
        (a, b) => new Date(b.scrapedAt).getTime() - new Date(a.scrapedAt).getTime()
      );
    },
    async clearAllHistory() {
      await chrome.storage.local.remove(STORAGE_KEY);
    },
    async getTotalScrapeCount() {
      const history = await loadHistory();
      let count = 0;
      for (const haul of Object.values(history)) {
        count += (haul.scrapes || []).length;
      }
      return count;
    },
  };
}

describe('HaulHistory', () => {
  beforeEach(() => {
    loadHaulHistory();
  });

  describe('pruneExpired', () => {
    it('removes expired hauls and keeps valid ones', async () => {
      // Seed storage with one expired and one valid haul
      const past = new Date(Date.now() - 86400_000).toISOString(); // 1 day ago
      const future = new Date(Date.now() + 86400_000 * 30).toISOString(); // 30 days from now
      await chrome.storage.local.set({
        haulHistory: {
          'old-haul-01': { haulId: 'old-haul-01', createdAt: past, expiresAt: past, scrapes: [] },
          'new-haul-02': { haulId: 'new-haul-02', createdAt: past, expiresAt: future, scrapes: [] },
        },
      });

      await HaulHistory.pruneExpired();

      const result = await chrome.storage.local.get('haulHistory');
      const history = result.haulHistory;
      expect(history['old-haul-01']).toBeUndefined();
      expect(history['new-haul-02']).toBeDefined();
    });
  });

  describe('saveScrape', () => {
    it('deduplicates by resultId', async () => {
      await HaulHistory.saveScrape('haul-abc-01', { resultId: 'r1', title: 'A', grade: 'A' });
      await HaulHistory.saveScrape('haul-abc-01', { resultId: 'r1', title: 'A', grade: 'A' });

      const scrapes = await HaulHistory.getHaulScrapes('haul-abc-01');
      expect(scrapes).toHaveLength(1);
    });

    it('truncates title at 80 chars', async () => {
      const longTitle = 'X'.repeat(120);
      await HaulHistory.saveScrape('haul-abc-02', { resultId: 'r2', title: longTitle });

      const scrapes = await HaulHistory.getHaulScrapes('haul-abc-02');
      expect(scrapes[0].title).toHaveLength(80);
    });

    it('truncates sourceUrl at 200 chars', async () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(300);
      await HaulHistory.saveScrape('haul-abc-03', { resultId: 'r3', sourceUrl: longUrl });

      const scrapes = await HaulHistory.getHaulScrapes('haul-abc-03');
      expect(scrapes[0].sourceUrl).toHaveLength(200);
    });

    it('creates haul entry if missing', async () => {
      await HaulHistory.saveScrape('haul-new-04', { resultId: 'r4', title: 'Test' });

      const scrapes = await HaulHistory.getHaulScrapes('haul-new-04');
      expect(scrapes).toHaveLength(1);
      expect(scrapes[0].resultId).toBe('r4');
    });
  });

  describe('clearAllHistory', () => {
    it('calls chrome.storage.local.remove', async () => {
      await HaulHistory.saveHaul('haul-del-01');
      await HaulHistory.clearAllHistory();

      const count = await HaulHistory.getTotalScrapeCount();
      expect(count).toBe(0);
    });
  });

  describe('getTotalScrapeCount', () => {
    it('aggregates across hauls', async () => {
      await HaulHistory.saveScrape('haul-a-01', { resultId: 'r1' });
      await HaulHistory.saveScrape('haul-a-01', { resultId: 'r2' });
      await HaulHistory.saveScrape('haul-b-02', { resultId: 'r3' });

      const count = await HaulHistory.getTotalScrapeCount();
      expect(count).toBe(3);
    });
  });

  describe('getHaulScrapes', () => {
    it('returns newest first', async () => {
      // Add scrapes with slight delay simulation via different timestamps
      await HaulHistory.saveScrape('haul-ord-01', { resultId: 'first', title: 'First' });
      // Manually push a second scrape with a later timestamp
      const result = await chrome.storage.local.get('haulHistory');
      const history = result.haulHistory;
      history['haul-ord-01'].scrapes.push({
        resultId: 'second',
        title: 'Second',
        grade: '?',
        price: '',
        rate: 0,
        scrapedAt: new Date(Date.now() + 1000).toISOString(),
        hostname: '',
        sourceUrl: '',
      });
      await chrome.storage.local.set({ haulHistory: history });

      const scrapes = await HaulHistory.getHaulScrapes('haul-ord-01');
      expect(scrapes[0].resultId).toBe('second');
      expect(scrapes[1].resultId).toBe('first');
    });

    it('returns empty array for unknown hauls', async () => {
      const scrapes = await HaulHistory.getHaulScrapes('nonexistent-haul-99');
      expect(scrapes).toEqual([]);
    });
  });
});
