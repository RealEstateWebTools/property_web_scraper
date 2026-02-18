# Chrome Extension

A Manifest V3 Chrome extension that extracts structured property data from supported real estate listing pages with one click — and bridges to Claude Code via WebSocket for MCP-powered fixture capture.

## Features

- **One-click extraction** — Click the extension icon on any supported listing page to get structured data
- **Badge indicator** — Green badge appears on supported sites so you know when extraction is available
- **Property card UI** — Results shown in a polished popup with image, price, stats, features, and quality grade
- **Copy actions** — Copy extracted JSON or listing URL to clipboard
- **MCP bridge** — WebSocket connection to the MCP server lets Claude Code capture rendered HTML from the active tab
- **Connection status** — Popup shows live connection state to Claude Code
- **Configurable** — Set your API key and custom API URL via the settings page

## Architecture

```
chrome-extensions/property-scraper/
├── manifest.json       # MV3 manifest, <all_urls> host permissions
├── content-script.js   # Injected into pages, captures HTML on demand
├── background.js       # Service worker: badge updates, API proxy, WebSocket client
├── popup.html          # Popup structure (includes connection status bar)
├── popup.css           # Styling (dark header, grade badges, stats grid, WS status)
├── popup.js            # Extraction flow + result rendering + WS status check
├── options.html        # Settings page (API key, URL, portal list)
├── options.js          # Settings persistence via chrome.storage.sync
└── icons/
    ├── icon-16.png
    ├── icon-48.png
    └── icon-128.png
```

## How It Works

The extension supports two flows: interactive popup extraction and MCP-driven capture.

### Flow 1: Popup Extraction (user-initiated)

```
User clicks extension icon
        │
        ▼
   ┌─────────┐     CAPTURE_HTML     ┌────────────────┐
   │  Popup   │ ──────────────────▶  │ Content Script  │
   │          │ ◀──────────────────  │ (on page)       │
   └─────────┘    { html, url }     └────────────────┘
        │
        │  EXTRACT { url, html }
        ▼
   ┌──────────────┐    POST /public_api/v1/listings    ┌──────────┐
   │ Background   │ ─────────────────────────────────▶  │ PWS API  │
   │ Service Worker│ ◀─────────────────────────────────  │          │
   └──────────────┘   { properties, diagnostics }       └──────────┘
        │
        ▼
   Render property card in popup
```

1. **Popup opens** → checks API key in `chrome.storage.sync`
2. **Content script** captures `document.documentElement.outerHTML`
3. **Background service worker** forwards to the PWS API with API key
4. **Popup** renders the property card with extracted data

### Flow 2: MCP Capture (Claude Code-initiated)

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

## MCP Server Bridge

The extension maintains a persistent WebSocket connection to the MCP server running on `localhost:17824`. This bridge enables Claude Code to:

- **Check extension status** — query whether the extension is connected and what page the user is viewing (`extension_status` tool)
- **Capture page HTML** — request the active tab's rendered HTML and save it as a test fixture (`capture_page` tool)

### WebSocket Protocol

All messages are JSON-serialized over `ws://localhost:17824`.

#### Extension → Server

| `type` | Fields | Description |
|--------|--------|-------------|
| `tab_update` | `url`, `title` | Sent on connect and on every tab switch/navigation |
| `capture_response` | `html`, `url`, `title` | Page HTML in response to a `capture_request` |
| `capture_response` | `error` | Error message if capture failed |

#### Server → Extension

| `type` | Fields | Description |
|--------|--------|-------------|
| `capture_request` | _(none)_ | Asks the extension to capture the active tab's HTML |

### Connection Lifecycle

- **Startup**: `connectWebSocket()` runs when the service worker starts
- **Reconnect**: 5-second flat retry on disconnect or error (no backoff)
- **Guard**: skips connection attempt if already CONNECTING or OPEN
- **On connect**: immediately sends a `tab_update` with current tab info

## Connection Status

The popup displays a connection indicator below the header:

| State | Indicator | Label |
|-------|-----------|-------|
| **Connected** | Green dot | "Connected to Claude Code" |
| **Disconnected** | Grey dot | "Not connected to Claude Code" |

The popup queries the background service worker via `GET_WS_STATUS` on open. The status reflects whether the WebSocket to `localhost:17824` is currently open.

## Installation (Development)

1. Open `chrome://extensions/` in Chrome
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked** → select the `chrome-extensions/property-scraper/` folder
4. Click the extension icon → gear icon → enter your API key
5. Navigate to any supported listing page and click the extension icon

To enable MCP capture, start the MCP server:

```bash
npx tsx astro-app/mcp-server.ts
```

The popup will show "Connected to Claude Code" when the bridge is active.

## Configuration

Open the extension settings (gear icon) to configure:

| Setting | Description | Default |
|---------|-------------|---------|
| **API Key** | Your PropertyWebScraper API key (required) | — |
| **API URL** | API endpoint URL | `https://property-web-scraper.pages.dev` |

Settings are stored in `chrome.storage.sync` and synced across Chrome instances.

## Supported Portals

The extension uses `<all_urls>` host permissions so it can capture HTML from any property portal. The green badge activates on these known portals:

| Country | Portals |
|---------|---------|
| UK | Rightmove, Zoopla, OnTheMarket, Jitty |
| Spain | Idealista, Fotocasa, Pisos.com |
| Portugal | Idealista PT |
| Ireland | Daft.ie |
| USA | Realtor.com, ForSaleByOwner |
| India | RealEstateIndia |
| Netherlands | Jitty |
| Germany | ImmobilienScout24 |
| France | SeLoger, Leboncoin |
| Australia | Domain, RealEstate.com.au |

## Popup UI States

The popup shows different states depending on the situation:

| State | When |
|-------|------|
| **Loading** | Extracting data from the page |
| **Results** | Property card with image, price, stats, features, quality grade |
| **Unsupported** | Current site is not a supported portal |
| **No API Key** | API key not configured — links to settings |
| **Error** | API call failed — shows message + retry button |
| **Connected** | WebSocket to MCP server is open (green dot in status bar) |
| **Disconnected** | WebSocket to MCP server is closed (grey dot in status bar) |

## Result Card Fields

When extraction succeeds, the popup displays:

- **Header**: Property title + quality grade badge (A/B/C/F)
- **Image**: Main listing photo
- **Price**: Formatted with currency
- **Address**: Street address or city/region
- **Stats row**: Bedrooms, bathrooms, area
- **Details grid**: Property type, tenure, sale/rent status, plot area, year built, reference
- **Features**: Up to 12 features as tags
- **Actions**: Copy JSON, Copy Link

## Server-Side CORS Support

The API server (`api-response.ts`) was updated to allow `chrome-extension://` origins through CORS, enabling the extension to make direct API calls without being blocked.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Popup shows "Not connected to Claude Code" | Start the MCP server: `npx tsx astro-app/mcp-server.ts` |
| Extension connects then immediately disconnects | Check that port 17824 is not in use by another process |
| `capture_page` returns "No Chrome extension connected" | Reload the extension at `chrome://extensions/` |
| `capture_page` times out (15s) | Ensure the active tab has finished loading; check for content script errors in the extension's service worker console |
| Badge does not appear on supported sites | Check that the extension has host permissions granted |

## Publishing to Chrome Web Store

When ready for production distribution:

1. Zip the `chrome-extensions/property-scraper/` directory
2. Upload to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
3. Fill in listing details, screenshots, and privacy policy
4. Submit for review

## Development Notes

- The extension uses **Manifest V3** (required for new Chrome extensions)
- **Service worker** (`background.js`) replaces the MV2 persistent background page
- **`chrome.scripting.executeScript`** is used as fallback if the content script isn't injected
- Badge logic uses `chrome.tabs.onUpdated` and `chrome.tabs.onActivated` listeners
- No build step required — plain JS files, load directly
- **WebSocket port**: `17824` (configurable server-side via `PWS_CAPTURE_PORT` env var)
- **Reconnect interval**: 5 seconds (flat, no backoff)
- **MCP transport**: stdio between Claude Code and the MCP server; WebSocket is a side-channel for the extension bridge only
