/**
 * popup.js — Main popup logic.
 * Captures HTML → sends to haul API → displays results.
 */

const $ = (sel) => document.querySelector(sel);

const states = {
  loading: $('#state-loading'),
  unsupported: $('#state-unsupported'),
  noKey: $('#state-no-key'),
  haulExpired: $('#state-haul-expired'),
  limitReached: $('#state-limit-reached'),
  error: $('#state-error'),
  results: $('#state-results'),
};

let extractedData = null;
let haulUrl = null;

// ─── State management ────────────────────────────────────────────

function showState(name) {
  Object.entries(states).forEach(([key, el]) => {
    el.classList.toggle('hidden', key !== name);
  });
}

// ─── Init ────────────────────────────────────────────────────────

async function init() {
  showState('loading');

  const config = await chrome.storage.sync.get(['apiUrl', 'haulId']);

  // Show history immediately if we have a haul (fire-and-forget)
  if (config.haulId) {
    renderHistory(config.haulId);
  }

  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) {
    showError('Unable to access the current tab');
    return;
  }

  // Block non-http pages (chrome://, about:, etc.)
  if (!tab.url.startsWith('http://') && !tab.url.startsWith('https://')) {
    showState('unsupported');
    return;
  }

  // Capture HTML from content script
  let captured;
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'CAPTURE_HTML' });
    captured = response;
  } catch {
    // Content script not loaded — inject it
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content-script.js'],
      });
      captured = await chrome.tabs.sendMessage(tab.id, { type: 'CAPTURE_HTML' });
    } catch (err) {
      showError('Unable to capture page content. Refresh the page and try again.');
      return;
    }
  }

  if (!captured?.html) {
    showError('No HTML content received from page');
    return;
  }

  // Send to API
  try {
    const result = await chrome.runtime.sendMessage({
      type: 'EXTRACT',
      url: captured.url,
      html: captured.html,
    });

    if (!result?.success) {
      const msg = result?.error?.message || 'Extraction failed';
      if (isHaulExpiredError(msg)) {
        showState('haulExpired');
      } else {
        showError(msg);
      }
      return;
    }

    // If the server returned a new haul_id, render its history
    if (result.haul_id && !config.haulId) {
      renderHistory(result.haul_id);
    }

    extractedData = result;
    renderResults(result);
  } catch (err) {
    showError(err.message || 'API call failed');
  }
}

// ─── Error display ───────────────────────────────────────────────

function showError(msg) {
  $('#error-message').textContent = msg;
  showState('error');
}

async function showLimitReached() {
  const config = await chrome.storage.sync.get(['apiUrl']);
  const apiUrl = (config.apiUrl || 'https://property-web-scraper.pages.dev').replace(/\/+$/, '');
  $('#popup-signup-link').href = `${apiUrl}/signup`;
  showState('limitReached');
}

$('#retry-btn').addEventListener('click', init);
$('#try-anyway-btn').addEventListener('click', init);

function isHaulExpiredError(msg) {
  const lower = msg.toLowerCase();
  return lower.includes('not found') || lower.includes('expired');
}

$('#new-haul-btn').addEventListener('click', async () => {
  const btn = $('#new-haul-btn');
  const status = $('#new-haul-status');
  btn.disabled = true;
  btn.textContent = 'Creating…';
  status.classList.add('hidden');

  try {
    const result = await chrome.runtime.sendMessage({ type: 'CREATE_HAUL' });
    if (result?.error?.code === 'HAUL_LIMIT_REACHED') { showLimitReached(); return; }
    if (!result?.haul_id) throw new Error(result?.error?.message || 'Failed to create haul');

    await chrome.storage.sync.set({ haulId: result.haul_id });
    btn.textContent = 'Created! Retrying…';
    init();
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Create New Haul';
    status.textContent = err.message || 'Could not create haul';
    status.classList.remove('hidden');
  }
});

// ─── Use existing haul ──────────────────────────────────────────

async function useExistingHaul(inputEl, statusEl) {
  const haulId = (inputEl.value || '').trim();
  if (!haulId) {
    statusEl.textContent = 'Please enter a haul ID';
    statusEl.classList.remove('hidden');
    return;
  }
  await chrome.storage.sync.set({ haulId });
  statusEl.classList.add('hidden');
  init();
}

$('#use-haul-btn').addEventListener('click', () => {
  useExistingHaul($('#use-haul-input'), $('#new-haul-status'));
});

$('#use-haul-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') useExistingHaul($('#use-haul-input'), $('#new-haul-status'));
});

// No-key state: create new haul
$('#new-haul-btn-nokey').addEventListener('click', async () => {
  const btn = $('#new-haul-btn-nokey');
  const status = $('#nokey-status');
  btn.disabled = true;
  btn.textContent = 'Creating…';
  status.classList.add('hidden');

  try {
    const result = await chrome.runtime.sendMessage({ type: 'CREATE_HAUL' });
    if (result?.error?.code === 'HAUL_LIMIT_REACHED') { showLimitReached(); return; }
    if (!result?.haul_id) throw new Error(result?.error?.message || 'Failed to create haul');

    await chrome.storage.sync.set({ haulId: result.haul_id });
    btn.textContent = 'Created! Retrying…';
    init();
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Create New Haul';
    status.textContent = err.message || 'Could not create haul';
    status.classList.remove('hidden');
  }
});

$('#use-haul-btn-nokey').addEventListener('click', () => {
  useExistingHaul($('#use-haul-input-nokey'), $('#nokey-status'));
});

$('#use-haul-input-nokey').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') useExistingHaul($('#use-haul-input-nokey'), $('#nokey-status'));
});

// ─── Render results ──────────────────────────────────────────────

function renderResults(data) {
  const scrape = data.scrape || {};

  // Title
  const title = scrape.title || 'Property Listing';
  $('#result-title').textContent = title.length > 60 ? title.slice(0, 57) + '…' : title;

  // Grade badge
  const grade = scrape.grade || '?';
  const badge = $('#result-grade');
  badge.textContent = grade;
  badge.className = `grade-badge grade-${grade}`;

  // Price
  $('#result-price').textContent = scrape.price || 'Price not available';

  // Extraction rate
  const extracted = scrape.fields_extracted || 0;
  const available = scrape.fields_available || 0;
  const ratePercent = available > 0 ? Math.round((extracted / available) * 100) : 0;
  $('#result-rate').textContent = `${extracted}/${available} fields extracted (${ratePercent}%)`;

  // Store haul URL for the view button
  haulUrl = data.haul_url || null;

  showState('results');
}

// ─── Helpers ─────────────────────────────────────────────────────

function formatPrice(amount, currency) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'GBP', maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency || ''} ${amount.toLocaleString()}`;
  }
}

// ─── Actions ─────────────────────────────────────────────────────

$('#copy-json-btn').addEventListener('click', async () => {
  if (!extractedData) return;
  await navigator.clipboard.writeText(JSON.stringify(extractedData, null, 2));
  const btn = $('#copy-json-btn');
  btn.innerHTML = '✓ Copied';
  setTimeout(() => { btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy JSON'; }, 2000);
});

$('#copy-link-btn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.url) {
    await navigator.clipboard.writeText(tab.url);
    const btn = $('#copy-link-btn');
    btn.innerHTML = '✓ Copied';
    setTimeout(() => { btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> Copy Link'; }, 2000);
  }
});

$('#view-haul-btn').addEventListener('click', async () => {
  if (!haulUrl) return;
  const config = await chrome.storage.sync.get(['apiUrl']);
  const apiUrl = (config.apiUrl || 'https://property-web-scraper.pages.dev').replace(/\/+$/, '');
  chrome.tabs.create({ url: apiUrl + haulUrl });
});

// ─── History ─────────────────────────────────────────────────────

async function renderHistory(haulId) {
  try {
    const scrapes = await HaulHistory.getHaulScrapes(haulId);
    const total = await HaulHistory.getTotalScrapeCount();
    if (scrapes.length === 0) return;

    const section = $('#history-section');
    const list = $('#history-list');
    const count = $('#history-count');

    count.textContent = total;
    list.innerHTML = scrapes.slice(0, 5).map(s => {
      const displayUrl = s.sourceUrl
        ? escapeHtml(s.sourceUrl.replace(/^https?:\/\/(www\.)?/, ''))
        : escapeHtml(s.hostname || 'Unknown');
      return `
      <li class="history-item">
        <div class="history-item-top">
          <span class="history-item-url" title="${escapeHtml(s.sourceUrl || s.hostname)}">${displayUrl}</span>
          <span class="grade-badge-sm grade-${escapeHtml(s.grade)}">${escapeHtml(s.grade)}</span>
        </div>
        <div class="history-item-meta">
          <span>${escapeHtml(s.hostname)}</span>
          <span>${formatTimeAgo(s.scrapedAt)}</span>
        </div>
      </li>
    `;
    }).join('');

    section.classList.remove('hidden');
  } catch { /* non-critical */ }
}

function formatTimeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ─── Start ───────────────────────────────────────────────────────

init();
