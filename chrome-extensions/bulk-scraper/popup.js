/**
 * popup.js — State machine for the bulk scraper popup.
 *
 * States:
 *   idle         — scanning page for listings
 *   not-search   — unsupported page or no listings found
 *   no-haul      — haulId not configured in storage
 *   found        — listings discovered, awaiting user click
 *   running      — batch capture in progress
 *   complete     — batch finished
 *   error        — fatal error
 */

const ALL_STATES = ['idle', 'not-search', 'no-haul', 'found', 'running', 'complete', 'error'];

let pendingUrls = [];
let storageWatcher = null;

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

  // Render last 5 results
  const results = stored.batchResults || [];
  const list = document.getElementById('results-list');
  if (list && results.length) {
    const recent = results.slice(-5);
    list.innerHTML = recent.map(r => {
      const icon = r.success ? '✓' : '✗';
      const cls = r.success ? 'result-ok' : 'result-fail';
      const label = r.title || new URL(r.url).pathname.slice(0, 40) || r.url;
      return `<li class="result-item ${cls}"><span class="result-icon">${icon}</span><span class="result-label">${escapeHtml(label)}</span></li>`;
    }).join('');
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

  const viewBtn = document.getElementById('view-haul-btn');
  if (viewBtn && stored.batchHaulUrl) {
    const config = { apiUrl: 'https://property-web-scraper.pages.dev' };
    chrome.storage.sync.get(['apiUrl']).then(c => {
      const base = (c.apiUrl || config.apiUrl).replace(/\/+$/, '');
      viewBtn.href = base + stored.batchHaulUrl;
    });
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function watchProgress() {
  // Merge the latest values as changes arrive
  const current = {};

  storageWatcher = (changes, area) => {
    if (area !== 'local') return;

    const keys = ['batchCompleted', 'batchFailed', 'batchTotal', 'batchStatus', 'batchHaulUrl', 'batchResults'];
    let changed = false;
    for (const k of keys) {
      if (changes[k] !== undefined) {
        current[k] = changes[k].newValue;
        changed = true;
      }
    }

    if (!changed) return;
    renderProgress(current);

    if (current.batchStatus === 'complete') {
      showState('complete');
      renderComplete(current);
      chrome.storage.onChanged.removeListener(storageWatcher);
    }
  };

  chrome.storage.onChanged.addListener(storageWatcher);
}

async function init() {
  // Check if a batch is already running or just completed
  const stored = await chrome.storage.local.get([
    'batchStatus', 'batchCompleted', 'batchTotal', 'batchFailed',
    'batchHaulUrl', 'batchResults',
  ]);

  if (stored.batchStatus === 'running') {
    showState('running');
    renderProgress(stored);
    watchProgress();
    return;
  }

  if (stored.batchStatus === 'complete') {
    showState('complete');
    renderComplete(stored);
    return;
  }

  // Fresh start: check haul config and scan page
  const { haulId } = await chrome.storage.sync.get(['haulId']);
  if (!haulId) {
    showState('no-haul');
    return;
  }

  showState('idle');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    showState('error');
    const msg = document.getElementById('error-message');
    if (msg) msg.textContent = 'Could not get active tab.';
    return;
  }

  // Inject content script (no-op if already injected)
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content-script.js'] });
  } catch { /* already injected or restricted page */ }

  let result = null;
  try {
    result = await chrome.tabs.sendMessage(tab.id, { type: 'FIND_LISTINGS' });
  } catch { /* content script not available */ }

  if (!result || !result.supported || result.count === 0) {
    showState('not-search');
    return;
  }

  pendingUrls = result.urls;
  const countEl = document.getElementById('found-count');
  if (countEl) countEl.textContent = result.count;

  const hostEl = document.getElementById('found-host');
  if (hostEl) {
    try {
      hostEl.textContent = new URL(tab.url).hostname;
    } catch { /* ignore */ }
  }

  showState('found');
}

// ─── Button handlers ──────────────────────────────────────────────────────────

document.getElementById('capture-all-btn')?.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'START_BATCH', urls: pendingUrls });
  showState('running');

  // Seed progress display with total
  const stored = await chrome.storage.local.get([
    'batchCompleted', 'batchTotal', 'batchFailed', 'batchResults',
  ]);
  renderProgress(stored);
  watchProgress();
});

document.getElementById('cancel-btn')?.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'CANCEL_BATCH' });
  if (storageWatcher) {
    chrome.storage.onChanged.removeListener(storageWatcher);
    storageWatcher = null;
  }
  showState('not-search');
});

document.getElementById('retry-btn')?.addEventListener('click', () => {
  init();
});

document.getElementById('new-batch-btn')?.addEventListener('click', async () => {
  await chrome.storage.local.set({ batchStatus: 'idle' });
  init();
});

// ─── Start ────────────────────────────────────────────────────────────────────

init();
