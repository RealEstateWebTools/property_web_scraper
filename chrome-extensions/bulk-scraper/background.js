/**
 * background.js — Service worker for the bulk scraper extension.
 *
 * Manages a tab queue that opens each listing URL in a background tab,
 * captures its HTML via scripting.executeScript, then POSTs to the haul API.
 *
 * Batch state is persisted to chrome.storage.local so progress survives
 * popup close/open and service worker restarts.
 *
 * Storage keys (chrome.storage.local):
 *   batchStatus:    'idle' | 'running' | 'complete' | 'error'
 *   batchTotal:     number
 *   batchCompleted: number
 *   batchFailed:    number
 *   batchUrls:      string[]   — remaining queue
 *   batchResults:   object[]   — { url, title, grade, success }
 *   batchHaulId:    string
 *   batchHaulUrl:   string
 */

const DEFAULT_API_URL = 'https://property-web-scraper.pages.dev';

// ─── Utility ─────────────────────────────────────────────────────────────────

function waitForTabLoad(tabId, timeoutMs) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(h);
      reject(new Error('Tab load timeout'));
    }, timeoutMs);

    function h(id, info) {
      if (id === tabId && info.status === 'complete') {
        clearTimeout(t);
        chrome.tabs.onUpdated.removeListener(h);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(h);
  });
}

async function postToApi(apiUrl, url, html, haulId) {
  const payload = { url, html };
  if (haulId) payload.haul_id = haulId;

  const r = await fetch(`${apiUrl}/ext/v1/scrapes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error?.message || `API error: ${r.status}`);
  }

  return r.json();
}

async function recordResult({ url, title, grade, success, haulId, haulUrl }) {
  const s = await chrome.storage.local.get(['batchCompleted', 'batchResults', 'batchHaulId', 'batchHaulUrl']);
  const results = s.batchResults || [];
  results.push({ url, title, grade, success });

  const update = {
    batchCompleted: (s.batchCompleted || 0) + 1,
    batchResults: results,
  };
  if (haulId && !s.batchHaulId) update.batchHaulId = haulId;
  if (haulUrl && !s.batchHaulUrl) update.batchHaulUrl = haulUrl;

  await chrome.storage.local.set(update);
}

// ─── Queue processing ─────────────────────────────────────────────────────────

async function processNext(apiUrl, haulId) {
  const { batchStatus, batchUrls } = await chrome.storage.local.get(['batchStatus', 'batchUrls']);

  if (batchStatus !== 'running' || !batchUrls?.length) {
    await chrome.storage.local.set({ batchStatus: 'complete' });
    return;
  }

  const [url, ...rest] = batchUrls;
  await chrome.storage.local.set({ batchUrls: rest });

  let tab;
  try {
    tab = await chrome.tabs.create({ url, active: false });
    await waitForTabLoad(tab.id, 30_000);

    const [{ result: html }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.documentElement.outerHTML,
    });

    await chrome.tabs.remove(tab.id);
    tab = null;

    const data = await postToApi(apiUrl, url, html, haulId);
    const rid = data.haul_id || haulId;
    if (rid && rid !== haulId) {
      await chrome.storage.sync.set({ haulId: rid });
      haulId = rid;
    }

    await recordResult({
      url,
      title: data.scrape?.title || '',
      grade: data.scrape?.grade || '?',
      success: true,
      haulId,
      haulUrl: data.haul_url || '',
    });

  } catch (err) {
    try { if (tab) await chrome.tabs.remove(tab.id); } catch { /* ignore */ }

    await recordResult({ url, title: '', grade: '?', success: false });

    const s = await chrome.storage.local.get('batchFailed');
    await chrome.storage.local.set({ batchFailed: (s.batchFailed || 0) + 1 });
  }

  // Process next item without blocking (tail recursion equivalent)
  processNext(apiUrl, haulId);
}

// ─── Message handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'START_BATCH') {
    handleStartBatch(msg.urls).then(sendResponse).catch(err => {
      sendResponse({ success: false, error: err.message });
    });
    return true; // async response
  }

  if (msg.type === 'CANCEL_BATCH') {
    chrome.storage.local.set({ batchStatus: 'idle', batchUrls: [] }).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
});

async function handleStartBatch(urls) {
  const config = await chrome.storage.sync.get(['apiUrl', 'haulId']);
  const apiUrl = (config.apiUrl || DEFAULT_API_URL).replace(/\/+$/, '');
  const haulId = config.haulId || '';

  await chrome.storage.local.set({
    batchStatus: 'running',
    batchTotal: urls.length,
    batchCompleted: 0,
    batchFailed: 0,
    batchUrls: urls,
    batchResults: [],
    batchHaulId: haulId,
    batchHaulUrl: '',
  });

  processNext(apiUrl, haulId);
  return { success: true };
}

// ─── Service worker resume on restart ────────────────────────────────────────

async function resumeIfInterrupted() {
  const s = await chrome.storage.local.get(['batchStatus', 'batchUrls']);
  if (s.batchStatus === 'running' && s.batchUrls?.length > 0) {
    const c = await chrome.storage.sync.get(['apiUrl', 'haulId']);
    processNext(
      (c.apiUrl || DEFAULT_API_URL).replace(/\/+$/, ''),
      c.haulId || ''
    );
  }
}

chrome.runtime.onStartup.addListener(resumeIfInterrupted);

// Resume on first load of the service worker
resumeIfInterrupted();
