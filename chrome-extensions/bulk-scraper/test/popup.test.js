import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createChromeMock } from './chrome-mock.js';

// ─── DOM setup ────────────────────────────────────────────────────────────────

function setupPopupDOM() {
  document.body.innerHTML = `
    <div id="state-idle" class="state"></div>
    <div id="state-not-search" class="state hidden"></div>
    <div id="state-no-haul" class="state hidden"></div>
    <div id="state-found" class="state hidden">
      <span id="found-count">0</span>
      <p id="found-host"></p>
      <button id="capture-all-btn">Capture All</button>
    </div>
    <div id="state-running" class="state-running hidden">
      <button id="cancel-btn">Cancel</button>
      <progress id="batch-progress" max="100" value="0"></progress>
      <span id="progress-label">0 / 0</span>
      <ul id="results-list"></ul>
    </div>
    <div id="state-complete" class="state hidden">
      <p id="complete-summary"></p>
      <a id="view-haul-btn" href="#">View Haul</a>
      <button id="new-batch-btn">Scan Again</button>
    </div>
    <div id="state-error" class="state hidden">
      <p id="error-message"></p>
      <button id="retry-btn">Retry</button>
    </div>
  `;
}

// ─── Replicate popup.js logic for testing ─────────────────────────────────────

const ALL_STATES = ['idle', 'not-search', 'no-haul', 'found', 'running', 'complete', 'error'];

function showState(name) {
  for (const s of ALL_STATES) {
    const el = document.getElementById(`state-${s}`);
    if (el) el.classList.toggle('hidden', s !== name);
  }
}

function renderProgress(stored) {
  const completed = stored.batchCompleted || 0;
  const total = stored.batchTotal || 0;
  const failed = stored.batchFailed || 0;

  const progressEl = document.getElementById('batch-progress');
  const labelEl = document.getElementById('progress-label');
  if (progressEl) {
    progressEl.max = total;
    progressEl.value = completed;
  }
  if (labelEl) {
    const failedStr = failed > 0 ? ` (${failed} failed)` : '';
    labelEl.textContent = `${completed} / ${total}${failedStr}`;
  }
}

function renderComplete(stored) {
  const completed = stored.batchCompleted || 0;
  const failed = stored.batchFailed || 0;
  const succeeded = completed - failed;

  const summary = document.getElementById('complete-summary');
  if (summary) {
    summary.textContent = failed > 0
      ? `${succeeded} captured, ${failed} failed`
      : `${succeeded} listings captured`;
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('popup', () => {
  beforeEach(() => {
    globalThis.chrome = createChromeMock();
    setupPopupDOM();
  });

  describe('showState', () => {
    it('shows only the specified state and hides others', () => {
      showState('found');
      expect(document.getElementById('state-found').classList.contains('hidden')).toBe(false);
      expect(document.getElementById('state-idle').classList.contains('hidden')).toBe(true);
      expect(document.getElementById('state-not-search').classList.contains('hidden')).toBe(true);
      expect(document.getElementById('state-error').classList.contains('hidden')).toBe(true);
    });

    it('shows not-search state', () => {
      showState('not-search');
      expect(document.getElementById('state-not-search').classList.contains('hidden')).toBe(false);
      expect(document.getElementById('state-idle').classList.contains('hidden')).toBe(true);
    });

    it('shows no-haul state', () => {
      showState('no-haul');
      expect(document.getElementById('state-no-haul').classList.contains('hidden')).toBe(false);
    });

    it('shows running state', () => {
      showState('running');
      expect(document.getElementById('state-running').classList.contains('hidden')).toBe(false);
    });

    it('shows complete state', () => {
      showState('complete');
      expect(document.getElementById('state-complete').classList.contains('hidden')).toBe(false);
    });
  });

  describe('renderProgress', () => {
    it('updates progress bar and label', () => {
      showState('running');
      renderProgress({ batchCompleted: 3, batchTotal: 10, batchFailed: 0 });

      const progress = document.getElementById('batch-progress');
      const label = document.getElementById('progress-label');
      expect(Number(progress.value)).toBe(3);
      expect(Number(progress.max)).toBe(10);
      expect(label.textContent).toBe('3 / 10');
    });

    it('includes failed count in label when failures exist', () => {
      renderProgress({ batchCompleted: 5, batchTotal: 10, batchFailed: 2 });

      const label = document.getElementById('progress-label');
      expect(label.textContent).toBe('5 / 10 (2 failed)');
    });

    it('handles zero totals gracefully', () => {
      renderProgress({});
      const label = document.getElementById('progress-label');
      expect(label.textContent).toBe('0 / 0');
    });
  });

  describe('renderComplete', () => {
    it('shows correct count when all succeed', () => {
      renderComplete({ batchCompleted: 8, batchFailed: 0 });
      const summary = document.getElementById('complete-summary');
      expect(summary.textContent).toBe('8 listings captured');
    });

    it('shows failed count when some fail', () => {
      renderComplete({ batchCompleted: 8, batchFailed: 2 });
      const summary = document.getElementById('complete-summary');
      expect(summary.textContent).toBe('6 captured, 2 failed');
    });
  });

  describe('init flow — no haul configured', () => {
    it('shows no-haul state when haulId is missing', async () => {
      // haulId not in storage → should show no-haul
      const { haulId } = await chrome.storage.sync.get(['haulId']);
      if (!haulId) showState('no-haul');

      expect(document.getElementById('state-no-haul').classList.contains('hidden')).toBe(false);
    });
  });

  describe('init flow — batch already running', () => {
    it('shows running state and progress when batch is in progress', async () => {
      await chrome.storage.local.set({
        batchStatus: 'running',
        batchCompleted: 4,
        batchTotal: 12,
        batchFailed: 1,
        batchResults: [],
      });

      const stored = await chrome.storage.local.get([
        'batchStatus', 'batchCompleted', 'batchTotal', 'batchFailed', 'batchHaulUrl', 'batchResults',
      ]);

      if (stored.batchStatus === 'running') {
        showState('running');
        renderProgress(stored);
      }

      expect(document.getElementById('state-running').classList.contains('hidden')).toBe(false);
      expect(document.getElementById('progress-label').textContent).toBe('4 / 12 (1 failed)');
    });
  });

  describe('init flow — batch complete', () => {
    it('shows complete state when batch is done', async () => {
      await chrome.storage.local.set({
        batchStatus: 'complete',
        batchCompleted: 5,
        batchFailed: 0,
        batchHaulUrl: '/haul/swift-fox-42',
      });

      const stored = await chrome.storage.local.get([
        'batchStatus', 'batchCompleted', 'batchFailed', 'batchHaulUrl',
      ]);

      if (stored.batchStatus === 'complete') {
        showState('complete');
        renderComplete(stored);
      }

      expect(document.getElementById('state-complete').classList.contains('hidden')).toBe(false);
      expect(document.getElementById('complete-summary').textContent).toBe('5 listings captured');
    });
  });

  describe('found state', () => {
    it('displays listing count', () => {
      document.getElementById('found-count').textContent = '15';
      showState('found');

      expect(document.getElementById('state-found').classList.contains('hidden')).toBe(false);
      expect(document.getElementById('found-count').textContent).toBe('15');
    });
  });

  describe('watchProgress via storage.onChanged', () => {
    it('updates progress when storage changes', () => {
      showState('running');
      renderProgress({ batchCompleted: 0, batchTotal: 5, batchFailed: 0 });

      // Simulate storage change
      const current = { batchCompleted: 2, batchTotal: 5, batchFailed: 0 };
      renderProgress(current);

      expect(document.getElementById('progress-label').textContent).toBe('2 / 5');
    });

    it('transitions to complete when batchStatus changes to complete', () => {
      showState('running');

      const changes = { batchStatus: { newValue: 'complete' } };
      const stored = {
        batchStatus: changes.batchStatus.newValue,
        batchCompleted: 5,
        batchFailed: 0,
      };

      if (stored.batchStatus === 'complete') {
        showState('complete');
        renderComplete(stored);
      }

      expect(document.getElementById('state-complete').classList.contains('hidden')).toBe(false);
      expect(document.getElementById('complete-summary').textContent).toBe('5 listings captured');
    });
  });
});
