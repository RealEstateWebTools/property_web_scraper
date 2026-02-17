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
  const props = data.properties?.[0] || {};
  const diag = data.diagnostics || {};

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

  // Address
  const address = props.address_string || [props.city, props.region, props.postal_code].filter(Boolean).join(', ');
  $('#result-address').textContent = address || '';
  $('#result-address').classList.toggle('hidden', !address);

  // Image
  const img = props.main_image_url;
  const imgWrap = $('#result-image-wrap');
  if (img) {
    $('#result-image').src = img;
    imgWrap.classList.remove('hidden');
  } else {
    imgWrap.classList.add('hidden');
  }

  // Stats row
  const statsRow = $('#result-stats');
  const stats = [];
  if (props.count_bedrooms) stats.push({ icon: '🛏️', value: props.count_bedrooms, label: 'bed' });
  if (props.count_bathrooms) stats.push({ icon: '🛁', value: props.count_bathrooms, label: 'bath' });
  if (props.constructed_area) stats.push({ icon: '📐', value: formatArea(props.constructed_area, props.area_unit), label: '' });
  statsRow.innerHTML = stats.map(s =>
    `<div class="stat"><span class="stat-icon">${s.icon}</span> <span class="stat-value">${s.value}</span> ${s.label}</div>`
  ).join('');
  statsRow.classList.toggle('hidden', stats.length === 0);

  // Details grid
  const detailsGrid = $('#result-details');
  const details = [];
  if (props.property_type) details.push(['Type', props.property_type]);
  if (props.tenure) details.push(['Tenure', props.tenure]);
  if (props.for_sale) details.push(['Status', 'For Sale']);
  else if (props.for_rent) details.push(['Status', 'For Rent']);
  if (props.plot_area) details.push(['Plot', formatArea(props.plot_area, props.area_unit)]);
  if (props.year_construction) details.push(['Built', props.year_construction]);
  if (props.reference) details.push(['Ref', props.reference]);

  detailsGrid.innerHTML = details.map(([label, value]) =>
    `<div class="detail-item"><span class="detail-label">${label}</span><span class="detail-value">${value}</span></div>`
  ).join('');
  detailsGrid.classList.toggle('hidden', details.length === 0);

  // Features
  const features = props.features || [];
  const featWrap = $('#result-features-wrap');
  if (features.length > 0) {
    $('#result-features').innerHTML = features.slice(0, 12).map(f =>
      `<li>${typeof f === 'string' ? f : f.name || f}</li>`
    ).join('');
    featWrap.classList.remove('hidden');
  } else {
    featWrap.classList.add('hidden');
  }

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

function formatArea(area, unit) {
  const u = unit === 'sqmt' ? 'm²' : unit === 'sqft' ? 'ft²' : unit || '';
  return `${Number(area).toLocaleString()} ${u}`;
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

// ─── Start ───────────────────────────────────────────────────────

init();
