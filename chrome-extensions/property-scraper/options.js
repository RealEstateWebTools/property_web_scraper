/**
 * options.js — Settings page logic.
 */

const $ = (sel) => document.querySelector(sel);
const haulIdInput = $('#haul-id');
const apiUrlInput = $('#api-url');
const saveBtn = $('#save-btn');
const createBtn = $('#create-btn');
const statusEl = $('#status');
const haulLinkEl = $('#haul-link');
const clearHistoryBtn = $('#clear-history-btn');
const scrapeCountEl = $('#scrape-count');

const DEFAULT_URL = 'https://property-web-scraper.pages.dev';

// Load saved settings
chrome.storage.sync.get(['haulId', 'apiUrl'], (config) => {
  haulIdInput.value = config.haulId || '';
  apiUrlInput.value = config.apiUrl || DEFAULT_URL;
  if (config.haulId) showHaulLink(config.haulId, config.apiUrl);
});

// Save
saveBtn.addEventListener('click', () => {
  const haulId = haulIdInput.value.trim();
  const apiUrl = apiUrlInput.value.trim() || DEFAULT_URL;

  if (!haulId) {
    showStatus('Haul ID is required', 'error');
    return;
  }

  if (!/^[a-z]+-[a-z]+-\d{2,3}$/.test(haulId)) {
    showStatus('Invalid haul ID format', 'error');
    return;
  }

  // Validate URL
  try {
    new URL(apiUrl);
  } catch {
    showStatus('Invalid API URL', 'error');
    return;
  }

  chrome.storage.sync.set({ haulId, apiUrl }, () => {
    showStatus('Settings saved', 'success');
    showHaulLink(haulId, apiUrl);
  });
});

// Create New haul
createBtn.addEventListener('click', async () => {
  createBtn.disabled = true;
  createBtn.textContent = 'Creating...';

  try {
    const apiUrl = (apiUrlInput.value.trim() || DEFAULT_URL).replace(/\/+$/, '');
    const response = await fetch(`${apiUrl}/ext/v1/hauls`, { method: 'POST' });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `Error: ${response.status}`);
    }
    const data = await response.json();
    haulIdInput.value = data.haul_id;

    // Persist haul to local history
    HaulHistory.saveHaul(data.haul_id).then(updateScrapeCount).catch(() => {});

    // Auto-save
    chrome.storage.sync.set({ haulId: data.haul_id, apiUrl: apiUrl || DEFAULT_URL }, () => {
      showStatus('Haul created and saved', 'success');
      showHaulLink(data.haul_id, apiUrl);
    });
  } catch (err) {
    showStatus(err.message || 'Failed to create haul', 'error');
  }

  createBtn.disabled = false;
  createBtn.textContent = 'Create New';
});

function showHaulLink(haulId, apiUrl) {
  const base = (apiUrl || DEFAULT_URL).replace(/\/+$/, '');
  haulLinkEl.innerHTML = `<a href="${base}/haul/${haulId}" target="_blank">View haul page →</a>`;
  haulLinkEl.style.display = 'block';
}

function showStatus(msg, type) {
  statusEl.textContent = msg;
  statusEl.className = `status show ${type}`;
  setTimeout(() => {
    statusEl.classList.remove('show');
  }, 3000);
}

// ─── History / Privacy ──────────────────────────────────────────

async function updateScrapeCount() {
  const count = await HaulHistory.getTotalScrapeCount();
  scrapeCountEl.textContent = `${count} scrape${count !== 1 ? 's' : ''} stored`;
}

clearHistoryBtn.addEventListener('click', async () => {
  await HaulHistory.clearAllHistory();
  updateScrapeCount();
  showStatus('History cleared', 'success');
});

updateScrapeCount();
