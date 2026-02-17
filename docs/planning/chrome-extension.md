# Chrome Extension (D2)

## Overview

A browser extension that extracts property data from the current tab. The user clicks the extension icon on any supported property listing page, and it sends the page HTML to the PropertyWebScraper API for extraction, displaying results in a popup.

## Architecture

```
┌──────────────────────┐     ┌─────────────────────────┐
│  Chrome Extension    │────▶│  PWS API                │
│                      │     │  POST /public_api/v1/   │
│  popup.html/js       │◀────│       listings           │
│  content-script.js   │     └─────────────────────────┘
│  background.js       │
└──────────────────────┘
```

### Components

| File | Purpose |
|------|---------|
| `manifest.json` | MV3 manifest with `activeTab`, `scripting` permissions |
| `popup.html` | Extension popup UI (results display) |
| `popup.js` | Popup logic — send HTML to API, render results |
| `content-script.js` | Injected into page to capture `document.documentElement.outerHTML` |
| `background.js` | Service worker — manages API key storage, handles messaging |
| `options.html` | Settings page for API key + API URL configuration |

---

## Manifest (V3)

```json
{
  "manifest_version": 3,
  "name": "Property Web Scraper",
  "version": "1.0.0",
  "description": "Extract structured property data from real estate listing pages",
  "permissions": ["activeTab", "scripting", "storage"],
  "host_permissions": ["https://*.rightmove.co.uk/*", "https://*.zoopla.co.uk/*", "https://*.idealista.com/*", "..."],
  "action": {
    "default_popup": "popup.html",
    "default_icon": { "16": "icons/16.png", "48": "icons/48.png", "128": "icons/128.png" }
  },
  "background": { "service_worker": "background.js" },
  "options_page": "options.html",
  "icons": { "16": "icons/16.png", "48": "icons/48.png", "128": "icons/128.png" }
}
```

---

## User Flow

1. User navigates to a property listing (e.g., Rightmove)
2. Clicks extension icon → popup opens
3. Extension icon shows badge indicating supported/unsupported site
4. Content script captures page HTML
5. HTML + URL sent to PWS API via `background.js`
6. Popup displays extracted data in a clean card:
   - Title, price, address
   - Bedrooms, bathrooms, area
   - Quality grade badge
   - Images carousel
7. "Copy JSON" and "Open in PWS" action buttons

## Popup UI Design

```
┌─────────────────────────────────────┐
│  🏠 Property Web Scraper    [⚙️]    │
├─────────────────────────────────────┤
│  ┌─────────────────────────┐        │
│  │  [Property Image]       │        │
│  └─────────────────────────┘        │
│                                     │
│  3 Bed Semi-Detached House    [A]   │
│  £325,000                           │
│  123 Example Road, London           │
│                                     │
│  🛏️ 3  🛁 2  📐 1,200 sqft          │
│                                     │
│  ├─ Property Type: Semi-Detached    │
│  ├─ Tenure: Freehold                │
│  └─ Status: For Sale                │
│                                     │
│  [Copy JSON]  [Open in PWS]  [Save] │
└─────────────────────────────────────┘
```

---

## Key Implementation Details

### Content Script (capture HTML)
```javascript
// content-script.js
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'CAPTURE_HTML') {
    sendResponse({
      html: document.documentElement.outerHTML,
      url: window.location.href,
    });
  }
  return true;
});
```

### Background Service Worker
```javascript
// background.js
chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg.type === 'EXTRACT') {
    const { apiUrl, apiKey } = await chrome.storage.sync.get(['apiUrl', 'apiKey']);
    const response = await fetch(`${apiUrl}/public_api/v1/listings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify({
        url: msg.url,
        html: msg.html,
      }),
    });
    const data = await response.json();
    sendResponse(data);
  }
  return true;
});
```

### Badge Logic
- **Green badge** → URL hostname matches a registered portal
- **Gray badge** → unsupported site
- Check against a bundled list of supported hostnames (from `portal-registry.ts`)

---

## Reuse from Existing Codebase

| Existing Code | Extension Usage |
|---------------|-----------------|
| Portal registry hostnames | Badge detection (bundled as JSON) |
| `POST /public_api/v1/listings` | Primary extraction endpoint |
| `GET /public_api/v1/listings/history` | Show price history inline |
| Quality grade calculation | Already in API response |

The extension is a **thin client** — all extraction happens server-side via the existing API.

---

## Implementation Plan

### Phase 1: Core MVP
1. Create extension project under `chrome-extension/`
2. `manifest.json` with MV3, `activeTab`, `scripting`
3. `content-script.js` to capture page HTML
4. `background.js` for API communication
5. `popup.html/js` with basic results display
6. `options.html` for API key + URL config
7. Generate extension icons with AI

### Phase 2: Polish
1. Supported-site badge detection
2. Copy JSON / Open in PWS buttons
3. Price history integration (if available)
4. Error handling for unsupported sites, auth failures
5. Loading states and animations

### Phase 3: Distribution
1. Chrome Web Store listing with screenshots
2. Landing page at `/extension` on the main site
3. Auto-update from CWS

---

## Directory Structure

```
chrome-extension/
├── manifest.json
├── background.js
├── content-script.js
├── popup.html
├── popup.js
├── popup.css
├── options.html
├── options.js
├── icons/
│   ├── 16.png
│   ├── 48.png
│   └── 128.png
├── lib/
│   └── supported-hosts.json   # Generated from portal-registry
└── package.json               # For build tooling if needed
```

## Dependencies

- No external dependencies in the extension itself
- Requires a valid PWS API key (ties into payment system)
- API must support CORS from `chrome-extension://` origin

## CORS Consideration

Add `chrome-extension://` to allowed origins in `api-response.ts`:

```diff
// Allow Chrome extension origin
+ if (origin?.startsWith('chrome-extension://')) {
+   return { allowOrigin: origin, usingAllowlist: true };
+ }
```
