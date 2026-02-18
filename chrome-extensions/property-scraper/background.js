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

  if (msg.type === 'GET_WS_STATUS') {
    sendResponse({ connected: wsConnected });
    return false;
  }
});

async function handleExtraction({ url, html }) {
  const config = await chrome.storage.sync.get(['apiUrl', 'apiKey']);
  const apiUrl = config.apiUrl || 'https://property-web-scraper.pages.dev';
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

// ─── WebSocket bridge to MCP server ──────────────────────────
const WS_URL = 'ws://localhost:17824';
let ws = null;
let wsConnected = false;

function connectWebSocket() {
  if (ws && ws.readyState <= 1) return; // CONNECTING or OPEN

  try {
    ws = new WebSocket(WS_URL);
  } catch {
    ws = null;
    wsConnected = false;
    setTimeout(connectWebSocket, 5000);
    return;
  }

  ws.onopen = () => {
    console.log('[PWS] Connected to MCP server');
    wsConnected = true;
    sendTabUpdate();
  };

  ws.onclose = () => {
    console.log('[PWS] Disconnected from MCP server');
    ws = null;
    wsConnected = false;
    setTimeout(connectWebSocket, 5000);
  };

  ws.onerror = () => {
    ws?.close();
  };

  ws.onmessage = async (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }

    if (msg.type === 'capture_request') {
      await handleCaptureRequest();
    }
  };
}

async function handleCaptureRequest() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      sendWS({ type: 'capture_response', error: 'No active tab found' });
      return;
    }

    let captured;
    try {
      captured = await chrome.tabs.sendMessage(tab.id, { type: 'CAPTURE_HTML' });
    } catch {
      // Content script not loaded — inject it first
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content-script.js'],
        });
        captured = await chrome.tabs.sendMessage(tab.id, { type: 'CAPTURE_HTML' });
      } catch (err) {
        sendWS({
          type: 'capture_response',
          error: `Cannot capture from this page: ${err.message}. Try refreshing the page.`,
        });
        return;
      }
    }

    if (!captured?.html) {
      sendWS({ type: 'capture_response', error: 'No HTML content received from page' });
      return;
    }

    sendWS({
      type: 'capture_response',
      html: captured.html,
      url: captured.url,
      title: captured.title,
    });
  } catch (err) {
    sendWS({ type: 'capture_response', error: err.message });
  }
}

async function sendTabUpdate() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      sendWS({ type: 'tab_update', url: tab.url, title: tab.title });
    }
  } catch { /* ignore */ }
}

function sendWS(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

// Track tab changes to keep MCP server informed
chrome.tabs.onActivated.addListener(() => sendTabUpdate());
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') sendTabUpdate();
});

// Start WebSocket connection
connectWebSocket();
