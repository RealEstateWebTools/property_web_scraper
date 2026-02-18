# MCP Bridge Extension

A minimal Manifest V3 Chrome extension that bridges Chrome to the MCP server via WebSocket, enabling Claude Code to capture rendered HTML from the browser's active tab.

This is a **development-only** extension — it is not published to the Chrome Web Store.

## Architecture

```
chrome-extensions/mcp-bridge/
├── manifest.json       # MV3 manifest, <all_urls> host permissions
├── background.js       # WebSocket client + capture handler
├── content-script.js   # Injected into pages, captures HTML on demand
├── popup.html          # Minimal popup (connection status only)
├── popup.js            # WS status check
├── popup.css           # Status indicator styles
└── icons/              # Shared icons (copied from property-scraper)
```

## How It Works

```
   ┌────────────┐  stdio (MCP protocol)   ┌──────────────┐
   │ Claude Code │ ◀─────────────────────▶  │  MCP Server   │
   │             │                          │ (mcp-server.ts)│
   └────────────┘                          └──────────────┘
                                                  │
                                           WebSocket :17824
                                                  │
                                           ┌──────────────┐
                                           │  Background   │
                                           │ Service Worker │
                                           └──────────────┘
                                                  │
                                          chrome.tabs API
                                                  │
                                           ┌──────────────┐
                                           │Content Script │
                                           │ (active tab)  │
                                           └──────────────┘
```

1. Claude Code calls `capture_page` MCP tool
2. MCP server sends `capture_request` over WebSocket
3. Background service worker injects content script into active tab
4. Content script returns `{ html, url, title }`
5. Background sends `capture_response` back over WebSocket
6. MCP server saves HTML as test fixture and runs extraction

## WebSocket Protocol

All messages are JSON-serialized over `ws://localhost:17824`.

### Extension → Server

| `type` | Fields | Description |
|--------|--------|-------------|
| `tab_update` | `url`, `title` | Sent on connect and on every tab switch/navigation |
| `capture_response` | `html`, `url`, `title` | Page HTML in response to a `capture_request` |
| `capture_response` | `error` | Error message if capture failed |

### Server → Extension

| `type` | Fields | Description |
|--------|--------|-------------|
| `capture_request` | _(none)_ | Asks the extension to capture the active tab's HTML |

## Connection Lifecycle

- **Startup**: `connectWebSocket()` runs when the service worker starts
- **Reconnect**: 5-second flat retry on disconnect or error (no backoff)
- **Guard**: skips connection attempt if already CONNECTING or OPEN
- **On connect**: immediately sends a `tab_update` with current tab info

## Installation

1. Open `chrome://extensions/` in Chrome
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked** → select the `chrome-extensions/mcp-bridge/` folder
4. Start the MCP server: `npx tsx astro-app/mcp-server.ts`
5. The popup will show "Connected to Claude Code" when the bridge is active

## MCP Tools

### `extension_status`

Check if the extension is connected and what page the user is viewing.

### `capture_page`

Capture rendered HTML from the browser's active tab and save as a test fixture.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `save_as` | string | no | Fixture filename (without `.html`) |
| `force` | boolean | no | Overwrite existing fixture file |

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Popup shows "Not connected to Claude Code" | Start the MCP server: `npx tsx astro-app/mcp-server.ts` |
| Extension connects then immediately disconnects | Check that port 17824 is not in use by another process |
| `capture_page` returns "No Chrome extension connected" | Reload the extension at `chrome://extensions/` |
| `capture_page` times out (15s) | Ensure the active tab has finished loading |

## Development Notes

- **WebSocket port**: `17824` (configurable server-side via `PWS_CAPTURE_PORT` env var)
- **Reconnect interval**: 5 seconds (flat, no backoff)
- **MCP transport**: stdio between Claude Code and the MCP server; WebSocket is a side-channel for the extension bridge only
