/**
 * options.js — Settings page logic.
 */

const $ = (sel) => document.querySelector(sel);
const apiKeyInput = $('#api-key');
const apiUrlInput = $('#api-url');
const saveBtn = $('#save-btn');
const statusEl = $('#status');

const DEFAULT_URL = 'https://property-web-scraper.pages.dev';

// Load saved settings
chrome.storage.sync.get(['apiKey', 'apiUrl'], (config) => {
  apiKeyInput.value = config.apiKey || '';
  apiUrlInput.value = config.apiUrl || DEFAULT_URL;
});

// Save
saveBtn.addEventListener('click', () => {
  const apiKey = apiKeyInput.value.trim();
  const apiUrl = apiUrlInput.value.trim() || DEFAULT_URL;

  if (!apiKey) {
    showStatus('API key is required', 'error');
    return;
  }

  // Validate URL
  try {
    new URL(apiUrl);
  } catch {
    showStatus('Invalid API URL', 'error');
    return;
  }

  chrome.storage.sync.set({ apiKey, apiUrl }, () => {
    showStatus('Settings saved ✓', 'success');
  });
});

function showStatus(msg, type) {
  statusEl.textContent = msg;
  statusEl.className = `status show ${type}`;
  setTimeout(() => {
    statusEl.classList.remove('show');
  }, 3000);
}
