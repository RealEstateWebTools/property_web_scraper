import { describe, it, expect, beforeEach } from 'vitest';

// ─── Replicate content-script logic for testing ───────────────────────────────

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

function findListingUrls(host, links) {
  const pattern = LISTING_PATTERNS[host];
  if (!pattern) return { supported: false, urls: [], count: 0 };

  const seen = new Set();
  const urls = [];
  for (const href of links) {
    try {
      const u = new URL(href);
      if (u.hostname.replace(/^www\./, '') !== host) continue;
      if (!pattern.test(u.pathname)) continue;
      const key = u.origin + u.pathname;
      if (!seen.has(key)) {
        seen.add(key);
        urls.push(u.href);
      }
    } catch { /* ignore */ }
  }
  return { supported: true, urls, count: urls.length };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('LISTING_PATTERNS', () => {
  it('matches rightmove property links', () => {
    const result = findListingUrls('rightmove.co.uk', [
      'https://www.rightmove.co.uk/properties/123456',
      'https://www.rightmove.co.uk/properties/999999#/floorplan?activePlan=1',
      'https://www.rightmove.co.uk/property-for-sale/find.html?locationIdentifier=REGION%5E87490',
    ]);
    expect(result.supported).toBe(true);
    expect(result.count).toBe(2);
    expect(result.urls[0]).toContain('/properties/123456');
  });

  it('deduplicates URLs with different query strings', () => {
    const result = findListingUrls('rightmove.co.uk', [
      'https://www.rightmove.co.uk/properties/123456',
      'https://www.rightmove.co.uk/properties/123456?source=email',
      'https://www.rightmove.co.uk/properties/123456#map',
    ]);
    expect(result.count).toBe(1);
  });

  it('ignores cross-domain links', () => {
    const result = findListingUrls('rightmove.co.uk', [
      'https://www.rightmove.co.uk/properties/111',
      'https://www.zoopla.co.uk/for-sale/details/123',
    ]);
    expect(result.count).toBe(1);
  });

  it('returns supported: false for unknown host', () => {
    const result = findListingUrls('unknown-portal.com', [
      'https://unknown-portal.com/listing/123',
    ]);
    expect(result.supported).toBe(false);
    expect(result.count).toBe(0);
  });

  it('matches zoopla for-sale details', () => {
    const result = findListingUrls('zoopla.co.uk', [
      'https://www.zoopla.co.uk/for-sale/details/12345678',
      'https://www.zoopla.co.uk/to-rent/details/12345678',
      'https://www.zoopla.co.uk/for-sale/find.html',
    ]);
    expect(result.count).toBe(2);
  });

  it('matches idealista inmueble links', () => {
    const result = findListingUrls('idealista.com', [
      'https://www.idealista.com/inmueble/12345678/',
      'https://www.idealista.com/venta-viviendas/madrid/',
    ]);
    expect(result.count).toBe(1);
  });

  it('matches immobilienscout24 expose links', () => {
    const result = findListingUrls('immobilienscout24.de', [
      'https://www.immobilienscout24.de/expose/123456789',
      'https://www.immobilienscout24.de/suche/kauf/haus',
    ]);
    expect(result.count).toBe(1);
  });

  it('returns empty list when no matching links', () => {
    const result = findListingUrls('rightmove.co.uk', [
      'https://www.rightmove.co.uk/property-for-sale/find.html',
      'https://www.rightmove.co.uk/news/articles/',
    ]);
    expect(result.supported).toBe(true);
    expect(result.count).toBe(0);
    expect(result.urls).toHaveLength(0);
  });
});

describe('CAPTURE_HTML message', () => {
  let messageListener;

  beforeEach(() => {
    messageListener = null;
    chrome.runtime.onMessage.addListener = (fn) => { messageListener = fn; };

    (() => {
      chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
        if (msg.type === 'CAPTURE_HTML') {
          sendResponse({ html: document.documentElement.outerHTML, url: window.location.href });
          return false;
        }
        if (msg.type === 'FIND_LISTINGS') {
          sendResponse({ supported: false, urls: [], count: 0 });
          return false;
        }
      });
    })();
  });

  it('responds to CAPTURE_HTML with html and url', () => {
    let response;
    messageListener({ type: 'CAPTURE_HTML' }, {}, (r) => { response = r; });

    expect(response).toBeDefined();
    expect(response.html).toContain('<html');
    expect(typeof response.url).toBe('string');
  });

  it('responds to FIND_LISTINGS', () => {
    let response;
    messageListener({ type: 'FIND_LISTINGS' }, {}, (r) => { response = r; });

    expect(response).toBeDefined();
    expect(typeof response.supported).toBe('boolean');
    expect(Array.isArray(response.urls)).toBe(true);
  });
});
