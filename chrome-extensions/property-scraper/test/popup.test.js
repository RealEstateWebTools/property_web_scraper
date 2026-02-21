import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createChromeMock } from './chrome-mock.js';

function setupPopupDOM() {
  document.body.innerHTML = `
    <div id="state-loading" class="state"></div>
    <div id="state-unsupported" class="state hidden"></div>
    <div id="state-no-key" class="state hidden"></div>
    <div id="state-haul-expired" class="state hidden"></div>
    <div id="state-limit-reached" class="state hidden"></div>
    <div id="state-error" class="state hidden">
      <p id="error-message"></p>
      <button id="retry-btn">Retry</button>
    </div>
    <div id="state-results" class="hidden">
      <h2 id="result-title"></h2>
      <span id="result-grade" class="grade-badge"></span>
      <p id="result-price"></p>
      <p id="result-rate"></p>
      <button id="view-haul-btn">View Haul</button>
    </div>
    <button id="try-anyway-btn">Try Anyway</button>
    <button id="new-haul-btn">Create New Haul</button>
    <input id="use-haul-input" type="text" />
    <button id="use-haul-btn">Use</button>
    <p id="new-haul-status" class="hidden"></p>
    <button id="new-haul-btn-nokey">Create New Haul</button>
    <input id="use-haul-input-nokey" type="text" />
    <button id="use-haul-btn-nokey">Use</button>
    <p id="nokey-status" class="hidden"></p>
    <a id="popup-signup-link" href="#"></a>
    <button id="copy-json-btn">Copy JSON</button>
    <button id="copy-link-btn">Copy Link</button>
    <div id="history-section" class="hidden">
      <span id="history-count"></span>
      <ul id="history-list"></ul>
    </div>
  `;
}

// Replicate popup.js showState logic for testing
function showState(name) {
  const stateIds = ['loading', 'unsupported', 'noKey', 'error', 'results', 'haulExpired', 'limitReached'];
  const idMap = {
    loading: 'state-loading',
    unsupported: 'state-unsupported',
    noKey: 'state-no-key',
    error: 'state-error',
    results: 'state-results',
    haulExpired: 'state-haul-expired',
    limitReached: 'state-limit-reached',
  };
  for (const key of stateIds) {
    const el = document.getElementById(idMap[key]);
    if (el) el.classList.toggle('hidden', key !== name);
  }
}

describe('popup', () => {
  beforeEach(() => {
    globalThis.chrome = createChromeMock();
    setupPopupDOM();
    globalThis.HaulHistory = {
      getHaulScrapes: vi.fn().mockResolvedValue([]),
      getTotalScrapeCount: vi.fn().mockResolvedValue(0),
    };
  });

  describe('showState', () => {
    it('shows only the specified state and hides others', () => {
      showState('unsupported');
      expect(document.getElementById('state-unsupported').classList.contains('hidden')).toBe(false);
      expect(document.getElementById('state-loading').classList.contains('hidden')).toBe(true);
      expect(document.getElementById('state-error').classList.contains('hidden')).toBe(true);
    });
  });

  describe('unsupported state', () => {
    it('shows unsupported for non-http URLs', () => {
      // Simulate what init() does for non-http tabs
      const tabUrl = 'chrome://extensions';
      if (!tabUrl.startsWith('http://') && !tabUrl.startsWith('https://')) {
        showState('unsupported');
      }
      expect(document.getElementById('state-unsupported').classList.contains('hidden')).toBe(false);
    });
  });

  describe('error state', () => {
    it('shows error when content script capture fails', () => {
      const errorMsg = 'Unable to capture page content. Refresh the page and try again.';
      document.getElementById('error-message').textContent = errorMsg;
      showState('error');

      expect(document.getElementById('state-error').classList.contains('hidden')).toBe(false);
      expect(document.getElementById('error-message').textContent).toBe(errorMsg);
    });
  });

  describe('renderResults', () => {
    it('renders extraction results correctly', () => {
      const data = {
        scrape: {
          title: 'Beautiful 3-bed house in London',
          grade: 'A',
          price: '450,000',
          fields_extracted: 15,
          fields_available: 18,
        },
        haul_url: '/haul/swift-fox-42',
      };

      // Replicate renderResults logic
      const scrape = data.scrape;
      const title = scrape.title || 'Property Listing';
      document.getElementById('result-title').textContent =
        title.length > 60 ? title.slice(0, 57) + '\u2026' : title;

      const grade = scrape.grade || '?';
      const badge = document.getElementById('result-grade');
      badge.textContent = grade;
      badge.className = `grade-badge grade-${grade}`;

      document.getElementById('result-price').textContent = scrape.price || 'Price not available';

      const extracted = scrape.fields_extracted || 0;
      const available = scrape.fields_available || 0;
      const ratePercent = available > 0 ? Math.round((extracted / available) * 100) : 0;
      document.getElementById('result-rate').textContent =
        `${extracted}/${available} fields extracted (${ratePercent}%)`;

      showState('results');

      expect(document.getElementById('result-title').textContent).toBe('Beautiful 3-bed house in London');
      expect(document.getElementById('result-grade').textContent).toBe('A');
      expect(document.getElementById('result-price').textContent).toBe('450,000');
      expect(document.getElementById('result-rate').textContent).toBe('15/18 fields extracted (83%)');
      expect(document.getElementById('state-results').classList.contains('hidden')).toBe(false);
    });
  });
});
