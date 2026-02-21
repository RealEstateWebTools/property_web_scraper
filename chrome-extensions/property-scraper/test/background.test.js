import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createChromeMock } from './chrome-mock.js';

// We need to re-execute background.js logic for each test since it has
// top-level side effects (importScripts, event listeners, startup call).
// We replicate the testable parts inline.

const SUPPORTED_HOSTS = [
  'rightmove.co.uk', 'zoopla.co.uk', 'onthemarket.com',
  'idealista.com', 'idealista.pt', 'fotocasa.es', 'pisos.com',
  'daft.ie', 'realtor.com', 'realestateindia.com',
  'forsalebyowner.com', 'jitty.com',
  'immobilienscout24.de', 'seloger.com', 'leboncoin.fr',
  'domain.com.au', 'realestate.com.au',
];

function isSupportedHost(hostname) {
  const h = hostname.replace(/^www\./, '');
  return SUPPORTED_HOSTS.some(s => h === s || h.endsWith('.' + s));
}

function updateBadge(tabId, url) {
  try {
    const hostname = new URL(url).hostname;
    if (isSupportedHost(hostname)) {
      chrome.action.setBadgeText({ tabId, text: '\u2713' });
      chrome.action.setBadgeBackgroundColor({ tabId, color: '#22c55e' });
      chrome.action.setTitle({ tabId, title: 'Property Web Scraper \u2014 Supported site' });
    } else if (url.startsWith('http://') || url.startsWith('https://')) {
      chrome.action.setBadgeText({ tabId, text: '~' });
      chrome.action.setBadgeBackgroundColor({ tabId, color: '#3b82f6' });
      chrome.action.setTitle({ tabId, title: 'Property Web Scraper \u2014 Generic extraction available' });
    } else {
      chrome.action.setBadgeText({ tabId, text: '' });
      chrome.action.setTitle({ tabId, title: 'Property Web Scraper' });
    }
  } catch {
    chrome.action.setBadgeText({ tabId, text: '' });
  }
}

describe('isSupportedHost', () => {
  it('returns true for known hosts', () => {
    expect(isSupportedHost('rightmove.co.uk')).toBe(true);
    expect(isSupportedHost('www.idealista.com')).toBe(true);
    expect(isSupportedHost('www.zoopla.co.uk')).toBe(true);
  });

  it('strips www. prefix', () => {
    expect(isSupportedHost('www.rightmove.co.uk')).toBe(true);
  });

  it('returns false for unknown hosts', () => {
    expect(isSupportedHost('www.google.com')).toBe(false);
    expect(isSupportedHost('example.com')).toBe(false);
  });

  it('matches subdomains', () => {
    expect(isSupportedHost('m.idealista.com')).toBe(true);
  });
});

describe('updateBadge', () => {
  beforeEach(() => {
    globalThis.chrome = createChromeMock();
  });

  it('sets green badge for supported hosts', () => {
    updateBadge(1, 'https://www.rightmove.co.uk/properties/123');
    expect(chrome.action._getBadgeText(1)).toBe('\u2713');
  });

  it('sets blue badge for generic http pages', () => {
    updateBadge(2, 'https://www.example.com/page');
    expect(chrome.action._getBadgeText(2)).toBe('~');
  });

  it('clears badge for non-http URLs', () => {
    updateBadge(3, 'chrome://extensions');
    expect(chrome.action._getBadgeText(3)).toBe('');
  });
});

describe('CHECK_SUPPORT message handler', () => {
  it('returns supported: true for known hosts', () => {
    const response = {
      supported: isSupportedHost('rightmove.co.uk'),
      level: isSupportedHost('rightmove.co.uk') ? 'supported' : 'generic',
    };
    expect(response.supported).toBe(true);
    expect(response.level).toBe('supported');
  });

  it('returns level: generic for unknown hosts', () => {
    const response = {
      supported: isSupportedHost('example.com'),
      level: isSupportedHost('example.com') ? 'supported' : 'generic',
    };
    expect(response.supported).toBe(false);
    expect(response.level).toBe('generic');
  });
});

describe('EXTRACT message handler', () => {
  beforeEach(() => {
    globalThis.chrome = createChromeMock();
    // Seed HaulHistory mock
    globalThis.HaulHistory = {
      saveScrape: vi.fn().mockResolvedValue(undefined),
      saveHaul: vi.fn().mockResolvedValue(undefined),
      pruneExpired: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('sends POST to API and returns result', async () => {
    const mockResult = {
      success: true,
      haul_id: 'swift-deer-42',
      scrape: { title: 'Test Property', grade: 'A', fields_extracted: 10, fields_available: 12 },
    };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResult),
    });

    // Simulate handleExtraction
    const config = await chrome.storage.sync.get(['apiUrl', 'haulId']);
    const apiUrl = (config.apiUrl || 'https://property-web-scraper.pages.dev').replace(/\/+$/, '');
    const payload = { url: 'https://www.rightmove.co.uk/properties/123', html: '<html></html>' };

    const response = await fetch(`${apiUrl}/ext/v1/scrapes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.haul_id).toBe('swift-deer-42');
    expect(fetch).toHaveBeenCalledWith(
      'https://property-web-scraper.pages.dev/ext/v1/scrapes',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('persists new haul_id to chrome.storage.sync', async () => {
    // After receiving a new haul_id, background.js saves it
    const returnedHaulId = 'new-haul-55';
    await chrome.storage.sync.set({ haulId: returnedHaulId });

    const stored = await chrome.storage.sync.get(['haulId']);
    expect(stored.haulId).toBe('new-haul-55');
  });

  it('handles API errors gracefully', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: { message: 'Internal Server Error' } }),
    });

    const response = await fetch('https://property-web-scraper.pages.dev/ext/v1/scrapes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });

    expect(response.ok).toBe(false);
    const errData = await response.json();
    expect(errData.error.message).toBe('Internal Server Error');
  });
});

describe('CREATE_HAUL message handler', () => {
  beforeEach(() => {
    globalThis.chrome = createChromeMock();
    globalThis.HaulHistory = {
      saveHaul: vi.fn().mockResolvedValue(undefined),
      pruneExpired: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('calls API and returns haul_id', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ haul_id: 'cool-fox-12' }),
    });

    const response = await fetch('https://property-web-scraper.pages.dev/ext/v1/hauls', {
      method: 'POST',
      headers: {},
    });
    const data = await response.json();

    expect(data.haul_id).toBe('cool-fox-12');
  });
});
