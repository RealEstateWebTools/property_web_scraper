/**
 * popup.js — Displays WebSocket connection status.
 */

async function init() {
  try {
    const wsStatus = await chrome.runtime.sendMessage({ type: 'GET_WS_STATUS' });
    const statusEl = document.getElementById('ws-status');
    const labelEl = document.getElementById('ws-label');
    if (wsStatus?.connected) {
      statusEl.classList.remove('ws-disconnected');
      statusEl.classList.add('ws-connected');
      labelEl.textContent = 'Connected to Claude Code';
    } else {
      labelEl.textContent = 'Not connected to Claude Code';
    }
  } catch { /* ignore */ }
}

init();
