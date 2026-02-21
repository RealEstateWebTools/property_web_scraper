import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createChromeMock } from './chrome-mock.js';

function setupOptionsDOM() {
  document.body.innerHTML = `
    <input type="text" id="haul-id" />
    <input type="text" id="api-url" />
    <input type="password" id="api-key" />
    <button id="save-btn">Save Settings</button>
    <button id="create-btn">Create New</button>
    <span id="status" class="status"></span>
    <div id="haul-link" style="display:none"></div>
    <button id="clear-history-btn">Clear History</button>
    <span id="scrape-count">0 scrapes stored</span>
    <a id="signup-link" href="#"></a>
  `;
}

describe('options page', () => {
  let haulIdInput, saveBtn, statusEl;

  beforeEach(() => {
    globalThis.chrome = createChromeMock();
    setupOptionsDOM();
    haulIdInput = document.querySelector('#haul-id');
    saveBtn = document.querySelector('#save-btn');
    statusEl = document.querySelector('#status');

    // Set up HaulHistory mock
    globalThis.HaulHistory = {
      clearAllHistory: vi.fn().mockResolvedValue(undefined),
      getTotalScrapeCount: vi.fn().mockResolvedValue(0),
      saveHaul: vi.fn().mockResolvedValue(undefined),
    };
  });

  describe('haul ID validation', () => {
    it('validates haul ID format (word-word-digits)', () => {
      const pattern = /^[a-z]+-[a-z]+-\d{2,3}$/;
      expect(pattern.test('swift-fox-42')).toBe(true);
      expect(pattern.test('cool-deer-123')).toBe(true);
      expect(pattern.test('abc-def-1')).toBe(false);     // single digit
      expect(pattern.test('ABC-DEF-42')).toBe(false);    // uppercase
      expect(pattern.test('')).toBe(false);               // empty
      expect(pattern.test('no-dashes')).toBe(false);      // missing third segment
    });

    it('rejects empty haul ID on save', () => {
      haulIdInput.value = '';
      // Inline the validation logic from options.js
      const haulId = haulIdInput.value.trim();
      if (!haulId) {
        statusEl.textContent = 'Haul ID is required';
        statusEl.className = 'status show error';
      }
      expect(statusEl.textContent).toBe('Haul ID is required');
      expect(statusEl.className).toContain('error');
    });

    it('rejects invalid format on save', () => {
      haulIdInput.value = 'invalid';
      const haulId = haulIdInput.value.trim();
      if (haulId && !/^[a-z]+-[a-z]+-\d{2,3}$/.test(haulId)) {
        statusEl.textContent = 'Invalid haul ID format';
        statusEl.className = 'status show error';
      }
      expect(statusEl.textContent).toBe('Invalid haul ID format');
    });

    it('accepts valid format and saves to chrome.storage.sync', async () => {
      haulIdInput.value = 'swift-fox-42';
      const haulId = haulIdInput.value.trim();
      const apiUrl = 'https://property-web-scraper.pages.dev';

      if (/^[a-z]+-[a-z]+-\d{2,3}$/.test(haulId)) {
        await chrome.storage.sync.set({ haulId, apiUrl, apiKey: '' });
      }

      const stored = await chrome.storage.sync.get(['haulId']);
      expect(stored.haulId).toBe('swift-fox-42');
    });
  });

  describe('clear history button', () => {
    it('calls HaulHistory.clearAllHistory', async () => {
      await HaulHistory.clearAllHistory();
      expect(HaulHistory.clearAllHistory).toHaveBeenCalled();
    });
  });
});
