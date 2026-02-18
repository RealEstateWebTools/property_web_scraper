/**
 * background.js — Service worker for the extension.
 * Handles API communication and badge logic.
 */

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
    } else {
      chrome.action.setBadgeText({ tabId, text: '' });
      chrome.action.setTitle({ tabId, title: 'Property Web Scraper — Site not supported' });
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
    sendResponse({ supported: isSupportedHost(msg.hostname) });
    return false;
  }

});

async function handleExtraction({ url, html }) {
  const config = await chrome.storage.sync.get(['apiUrl', 'apiKey']);
  const apiUrl = (config.apiUrl || 'https://property-web-scraper.pages.dev').replace(/\/+$/, '');
  const apiKey = config.apiKey || '';

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['X-Api-Key'] = apiKey;

  const response = await fetch(`${apiUrl}/public_api/v1/listings`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ url, html }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error: ${response.status}`);
  }

  return response.json();
}
