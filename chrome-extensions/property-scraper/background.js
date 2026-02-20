/**
 * background.js — Service worker for the extension.
 * Handles API communication and badge logic.
 */

importScripts('./haul-history.js');

const SUPPORTED_HOSTS = [
  'rightmove.co.uk', 'zoopla.co.uk', 'onthemarket.com',
  'idealista.com', 'idealista.pt', 'fotocasa.es', 'pisos.com',
  'daft.ie', 'realtor.com', 'realestateindia.com',
  'forsalebyowner.com', 'jitty.com',
  'immobilienscout24.de', 'seloger.com', 'leboncoin.fr',
  'domain.com.au', 'realestate.com.au',
];

/**
 * Check if a hostname matches any supported portal.
 */
function isSupportedHost(hostname) {
  const h = hostname.replace(/^www\./, '');
  return SUPPORTED_HOSTS.some(s => h === s || h.endsWith('.' + s));
}

// ─── Badge updates on tab change ─────────────────────────────────

function updateBadge(tabId, url) {
  try {
    const hostname = new URL(url).hostname;
    if (isSupportedHost(hostname)) {
      chrome.action.setBadgeText({ tabId, text: '✓' });
      chrome.action.setBadgeBackgroundColor({ tabId, color: '#22c55e' });
      chrome.action.setTitle({ tabId, title: 'Property Web Scraper — Supported site' });
    } else if (url.startsWith('http://') || url.startsWith('https://')) {
      chrome.action.setBadgeText({ tabId, text: '~' });
      chrome.action.setBadgeBackgroundColor({ tabId, color: '#3b82f6' });
      chrome.action.setTitle({ tabId, title: 'Property Web Scraper — Generic extraction available' });
    } else {
      chrome.action.setBadgeText({ tabId, text: '' });
      chrome.action.setTitle({ tabId, title: 'Property Web Scraper' });
    }
  } catch {
    chrome.action.setBadgeText({ tabId, text: '' });
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    updateBadge(tabId, tab.url);
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) updateBadge(tab.id, tab.url);
  } catch { /* ignore */ }
});

// ─── API communication ──────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'EXTRACT') {
    handleExtraction(msg).then(sendResponse).catch(err => {
      sendResponse({ success: false, error: { message: err.message } });
    });
    return true; // async response
  }

  if (msg.type === 'CHECK_SUPPORT') {
    sendResponse({
      supported: isSupportedHost(msg.hostname),
      level: isSupportedHost(msg.hostname) ? 'supported' : 'generic',
    });
    return false;
  }

  if (msg.type === 'CREATE_HAUL') {
    handleCreateHaul().then(sendResponse).catch(err => {
      sendResponse({ success: false, error: { code: err.code || '', message: err.message } });
    });
    return true;
  }

});

async function handleExtraction({ url, html }) {
  const config = await chrome.storage.sync.get(['apiUrl', 'haulId']);
  const apiUrl = (config.apiUrl || 'https://property-web-scraper.pages.dev').replace(/\/+$/, '');
  const haulId = config.haulId || '';

  // Use the auto-haul endpoint, passing haul_id if we have one
  const payload = { url, html };
  if (haulId) payload.haul_id = haulId;

  const response = await fetch(`${apiUrl}/ext/v1/scrapes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();

  // Persist the haul_id returned by the server (may be newly created)
  const returnedHaulId = data.haul_id;
  if (returnedHaulId && returnedHaulId !== haulId) {
    await chrome.storage.sync.set({ haulId: returnedHaulId });
  }

  // Persist scrape summary to local history
  const activeHaulId = returnedHaulId || haulId;
  try {
    const scrape = data.scrape || {};
    const extracted = scrape.fields_extracted || 0;
    const available = scrape.fields_available || 0;
    const rate = available > 0 ? Math.round((extracted / available) * 100) : 0;
    let hostname = '';
    let sourceUrl = '';
    try {
      const parsed = new URL(url);
      hostname = parsed.hostname.replace(/^www\./, '');
      sourceUrl = parsed.origin + parsed.pathname;
    } catch {}
    await HaulHistory.saveScrape(activeHaulId, {
      resultId: data.result_id || scrape.result_id || '',
      title: scrape.title || '',
      grade: scrape.grade || '?',
      price: scrape.price || '',
      rate,
      hostname,
      sourceUrl,
    });
  } catch { /* non-critical */ }

  return data;
}

async function handleCreateHaul() {
  const config = await chrome.storage.sync.get(['apiUrl', 'apiKey']);
  const apiUrl = (config.apiUrl || 'https://property-web-scraper.pages.dev').replace(/\/+$/, '');
  const apiKey = config.apiKey || '';

  const headers = {};
  if (apiKey) headers['X-Api-Key'] = apiKey;

  const response = await fetch(`${apiUrl}/ext/v1/hauls`, { method: 'POST', headers });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const code = err.error?.code || '';
    const message = err.error?.message || `API error: ${response.status}`;
    const error = new Error(message);
    error.code = code;
    throw error;
  }

  const data = await response.json();

  // Persist haul to local history
  try {
    await HaulHistory.saveHaul(data.haul_id);
  } catch { /* non-critical */ }

  return data;
}

// ─── Startup ───────────────────────────────────────────────────

HaulHistory.pruneExpired();
