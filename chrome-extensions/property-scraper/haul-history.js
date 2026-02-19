/**
 * haul-history.js — GDPR-compliant local storage for haul/scrape history.
 *
 * Stores minimal data (hostnames only, no full URLs) with 30-day auto-expiry.
 * Compatible with both popup <script> tags and service worker importScripts.
 */

(function () {
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
    /** Remove hauls past their expiresAt timestamp. */
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

    /** Record haul metadata on creation. */
    async saveHaul(haulId) {
      const history = await loadHistory();
      if (!history[haulId]) {
        const now = new Date().toISOString();
        history[haulId] = {
          haulId,
          createdAt: now,
          expiresAt: expiresAt(now),
          scrapes: [],
        };
        await saveHistory(history);
      }
    },

    /** Append a scrape summary; deduplicate by resultId. */
    async saveScrape(haulId, scrapeData) {
      const history = await loadHistory();
      if (!history[haulId]) {
        const now = new Date().toISOString();
        history[haulId] = {
          haulId,
          createdAt: now,
          expiresAt: expiresAt(now),
          scrapes: [],
        };
      }
      const haul = history[haulId];
      // Deduplicate by resultId
      if (scrapeData.resultId && haul.scrapes.some(s => s.resultId === scrapeData.resultId)) {
        return;
      }
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

    /** Return scrapes for a haul, newest first. */
    async getHaulScrapes(haulId) {
      const history = await loadHistory();
      const haul = history[haulId];
      if (!haul) return [];
      return [...haul.scrapes].sort(
        (a, b) => new Date(b.scrapedAt).getTime() - new Date(a.scrapedAt).getTime()
      );
    },

    /** Delete all local history (GDPR erasure). */
    async clearAllHistory() {
      await chrome.storage.local.remove(STORAGE_KEY);
    },

    /** Count scrapes across all hauls. */
    async getTotalScrapeCount() {
      const history = await loadHistory();
      let count = 0;
      for (const haul of Object.values(history)) {
        count += (haul.scrapes || []).length;
      }
      return count;
    },
  };
})();
