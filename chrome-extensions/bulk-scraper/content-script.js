/**
 * content-script.js — Injected into property portal pages.
 *
 * Handles two message types:
 *   FIND_LISTINGS — scan page for listing links using portal-specific regexes
 *   CAPTURE_HTML  — return document.documentElement.outerHTML
 */

const LISTING_PATTERNS = {
  'rightmove.co.uk':      /\/properties\/\d+/,
  'zoopla.co.uk':         /\/(for-sale|to-rent)\/details\//,
  'onthemarket.com':      /\/details\//,
  'idealista.com':        /\/(inmueble|viviendas)\//,
  'idealista.pt':         /\/imovel\//,
  'fotocasa.es':          /\/detalle\//,
  'pisos.com':            /\/anuncio\//,
  'daft.ie':              /\/(for-sale|to-rent)\/.+\/\d+/,
  'realtor.com':          /\/realestateandhomes-detail\//,
  'domain.com.au':        /\/(house|apartment|unit|townhouse|land)-for-(sale|rent)\//,
  'realestate.com.au':    /\/property-/,
  'immobilienscout24.de': /\/expose\/\d+/,
  'seloger.com':          /\/annonces\//,
};

function findListingUrls() {
  const host = location.hostname.replace(/^www\./, '');
  const pattern = LISTING_PATTERNS[host];
  if (!pattern) return { supported: false, urls: [], count: 0 };

  const seen = new Set();
  const urls = [];
  for (const a of document.querySelectorAll('a[href]')) {
    try {
      const u = new URL(a.href);
      if (u.hostname.replace(/^www\./, '') !== host) continue;
      if (!pattern.test(u.pathname)) continue;
      const key = u.origin + u.pathname; // deduplicate ignoring query/fragment
      if (!seen.has(key)) {
        seen.add(key);
        urls.push(u.href);
      }
    } catch { /* ignore invalid URLs */ }
  }
  return { supported: true, urls, count: urls.length };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'FIND_LISTINGS') {
    sendResponse(findListingUrls());
    return false;
  }
  if (msg.type === 'CAPTURE_HTML') {
    sendResponse({ html: document.documentElement.outerHTML, url: location.href });
    return false;
  }
});
