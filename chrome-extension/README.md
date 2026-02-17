# Chrome Extension

A Manifest V3 Chrome extension that extracts structured property data from supported real estate listing pages with one click.

## Features

- **One-click extraction** — Click the extension icon on any supported listing page to get structured data
- **Badge indicator** — Green ✓ badge appears on supported sites so you know when extraction is available
- **Property card UI** — Results shown in a polished popup with image, price, stats, features, and quality grade
- **Copy actions** — Copy extracted JSON or listing URL to clipboard
- **Configurable** — Set your API key and custom API URL via the settings page

## Architecture

```
chrome-extension/
├── manifest.json       # MV3 manifest, host permissions for 17 portals
├── content-script.js   # Injected into supported pages, captures HTML on demand
├── background.js       # Service worker: badge updates + API proxy
├── popup.html          # Popup structure
├── popup.css           # Styling (dark header, grade badges, stats grid)
├── popup.js            # Extraction flow + result rendering
├── options.html        # Settings page (API key, URL, portal list)
├── options.js          # Settings persistence via chrome.storage.sync
└── icons/
    ├── icon-16.png
    ├── icon-48.png
    └── icon-128.png
```

## How It Works

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

## Installation (Development)

1. Open `chrome://extensions/` in Chrome
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked** → select the `chrome-extension/` folder
4. Click the extension icon → gear icon → enter your API key
5. Navigate to any supported listing page and click the extension icon

## Configuration

Open the extension settings (gear icon) to configure:

| Setting | Description | Default |
|---------|-------------|---------|
| **API Key** | Your PropertyWebScraper API key (required) | — |
| **API URL** | API endpoint URL | `https://property-web-scraper.pages.dev` |

Settings are stored in `chrome.storage.sync` and synced across Chrome instances.

## Supported Portals

The extension activates (green ✓ badge) on these 17 portals:

| Country | Portals |
|---------|---------|
| 🇬🇧 UK | Rightmove, Zoopla, OnTheMarket, Jitty |
| 🇪🇸 Spain | Idealista, Fotocasa, Pisos.com |
| 🇵🇹 Portugal | Idealista PT |
| 🇮🇪 Ireland | Daft.ie |
| 🇺🇸 USA | Realtor.com, ForSaleByOwner |
| 🇮🇳 India | RealEstateIndia |
| 🇳🇱 Netherlands | Jitty |
| 🇩🇪 Germany | ImmobilienScout24 |
| 🇫🇷 France | SeLoger, Leboncoin |
| 🇦🇺 Australia | Domain, RealEstate.com.au |

## Popup UI States

The popup shows different states depending on the situation:

| State | When |
|-------|------|
| **Loading** | Extracting data from the page |
| **Results** | Property card with image, price, stats, features, quality grade |
| **Unsupported** | Current site is not a supported portal |
| **No API Key** | API key not configured — links to settings |
| **Error** | API call failed — shows message + retry button |

## Result Card Fields

When extraction succeeds, the popup displays:

- **Header**: Property title + quality grade badge (A/B/C/F)
- **Image**: Main listing photo
- **Price**: Formatted with currency
- **Address**: Street address or city/region
- **Stats row**: Bedrooms 🛏️, bathrooms 🛁, area 📐
- **Details grid**: Property type, tenure, sale/rent status, plot area, year built, reference
- **Features**: Up to 12 features as tags
- **Actions**: Copy JSON, Copy Link

## Server-Side CORS Support

The API server (`api-response.ts`) was updated to allow `chrome-extension://` origins through CORS, enabling the extension to make direct API calls without being blocked.

## Publishing to Chrome Web Store

When ready for production distribution:

1. Zip the `chrome-extension/` directory
2. Upload to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
3. Fill in listing details, screenshots, and privacy policy
4. Submit for review

## Development Notes

- The extension uses **Manifest V3** (required for new Chrome extensions)
- **Service worker** (`background.js`) replaces the MV2 persistent background page
- **`chrome.scripting.executeScript`** is used as fallback if the content script isn't injected
- Badge logic uses `chrome.tabs.onUpdated` and `chrome.tabs.onActivated` listeners
- No build step required — plain JS files, load directly
