/**
 * popup.js — Main popup logic.
 * Captures HTML → sends to API → displays results.
 */

const $ = (sel) => document.querySelector(sel);

const states = {
  loading: $('#state-loading'),
  unsupported: $('#state-unsupported'),
  noKey: $('#state-no-key'),
  error: $('#state-error'),
  results: $('#state-results'),
};

let extractedData = null;
let resultsUrl = null;

// ─── State management ────────────────────────────────────────────

function showState(name) {
  Object.entries(states).forEach(([key, el]) => {
    el.classList.toggle('hidden', key !== name);
  });
}

// ─── Init ────────────────────────────────────────────────────────

async function init() {
  showState('loading');

  // Check API key
  const config = await chrome.storage.sync.get(['apiUrl', 'apiKey']);
  if (!config.apiKey) {
    showState('noKey');
    return;
  }

  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) {
    showError('Unable to access the current tab');
    return;
  }

  // Check if site is supported
  const hostname = new URL(tab.url).hostname;
  const supportCheck = await chrome.runtime.sendMessage({ type: 'CHECK_SUPPORT', hostname });
  if (!supportCheck?.supported) {
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
      showError(result?.error?.message || 'Extraction failed');
      return;
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

$('#retry-btn').addEventListener('click', init);

// ─── Render results ──────────────────────────────────────────────

function renderResults(data) {
  const props = data.listings?.[0] || {};
  const diag = data.extraction?.diagnostics || {};

  // Title
  const title = props.title || 'Property Listing';
  $('#result-title').textContent = title.length > 60 ? title.slice(0, 57) + '…' : title;

  // Grade badge
  const grade = diag.qualityGrade || '?';
  const badge = $('#result-grade');
  badge.textContent = grade;
  badge.className = `grade-badge grade-${grade}`;

  // Price
  const priceStr = props.price_string || (props.price_float ? formatPrice(props.price_float, props.currency) : '');
  $('#result-price').textContent = priceStr || 'Price not available';

  // Extraction rate
  const extracted = data.extraction?.fields_extracted || 0;
  const available = data.extraction?.fields_available || 0;
  const ratePercent = available > 0 ? Math.round((extracted / available) * 100) : 0;
  $('#result-rate').textContent = `${extracted}/${available} fields extracted (${ratePercent}%)`;

  // Store results URL for the view button
  resultsUrl = data.extraction?.results_url || null;
  const viewBtn = $('#view-results-btn');
  viewBtn.classList.toggle('hidden', !resultsUrl);

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

$('#view-results-btn').addEventListener('click', async () => {
  if (!resultsUrl) return;
  const config = await chrome.storage.sync.get(['apiUrl']);
  const apiUrl = (config.apiUrl || 'https://property-web-scraper.pages.dev').replace(/\/+$/, '');
  chrome.tabs.create({ url: apiUrl + resultsUrl });
});

// ─── Start ───────────────────────────────────────────────────────

init();
