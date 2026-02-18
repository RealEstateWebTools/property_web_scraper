/**
 * background.js — Service worker for the MCP Bridge extension.
 * Maintains a WebSocket connection to the MCP server and handles
 * page capture requests from Claude Code.
 */

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
    console.log('[MCP Bridge] Connected to MCP server');
    wsConnected = true;
    sendTabUpdate();
  };

  ws.onclose = () => {
    console.log('[MCP Bridge] Disconnected from MCP server');
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

// ─── Capture handling ────────────────────────────────────────

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

// ─── Tab tracking ────────────────────────────────────────────

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

// ─── Message handler ─────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'GET_WS_STATUS') {
    sendResponse({ connected: wsConnected });
    return false;
  }
});

// ─── Listeners ───────────────────────────────────────────────

chrome.tabs.onActivated.addListener(() => sendTabUpdate());
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') sendTabUpdate();
});

// ─── Start ───────────────────────────────────────────────────

connectWebSocket();
