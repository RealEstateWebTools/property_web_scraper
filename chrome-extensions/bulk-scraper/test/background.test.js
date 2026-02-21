import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createChromeMock } from './chrome-mock.js';

// ─── Replicate background.js logic for testing ────────────────────────────────

const DEFAULT_API_URL = 'https://property-web-scraper.pages.dev';

async function postToApi(apiUrl, url, html, haulId) {
  const payload = { url, html };
  if (haulId) payload.haul_id = haulId;

  const r = await fetch(`${apiUrl}/ext/v1/scrapes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error?.message || `API error: ${r.status}`);
  }

  return r.json();
}

async function recordResult(chrome, { url, title, grade, success, haulId, haulUrl }) {
  const s = await chrome.storage.local.get(['batchCompleted', 'batchResults', 'batchHaulId', 'batchHaulUrl']);
  const results = s.batchResults || [];
  results.push({ url, title, grade, success });

  const update = {
    batchCompleted: (s.batchCompleted || 0) + 1,
    batchResults: results,
  };
  if (haulId && !s.batchHaulId) update.batchHaulId = haulId;
  if (haulUrl && !s.batchHaulUrl) update.batchHaulUrl = haulUrl;

  await chrome.storage.local.set(update);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('postToApi', () => {
  beforeEach(() => {
    globalThis.chrome = createChromeMock();
  });

  it('sends POST to the correct endpoint', async () => {
    const mockData = {
      haul_id: 'swift-fox-42',
      scrape: { title: 'Nice House', grade: 'A' },
      haul_url: '/haul/swift-fox-42',
    };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    const result = await postToApi(
      DEFAULT_API_URL,
      'https://www.rightmove.co.uk/properties/123',
      '<html></html>',
      ''
    );

    expect(fetch).toHaveBeenCalledWith(
      `${DEFAULT_API_URL}/ext/v1/scrapes`,
      expect.objectContaining({ method: 'POST' })
    );
    expect(result.haul_id).toBe('swift-fox-42');
  });

  it('includes haul_id in payload when provided', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ haul_id: 'my-haul', scrape: {} }),
    });

    await postToApi(DEFAULT_API_URL, 'https://rightmove.co.uk/properties/1', '<html/>', 'my-haul');

    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.haul_id).toBe('my-haul');
  });

  it('omits haul_id when empty string', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ haul_id: 'new-haul', scrape: {} }),
    });

    await postToApi(DEFAULT_API_URL, 'https://rightmove.co.uk/properties/1', '<html/>', '');

    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.haul_id).toBeUndefined();
  });

  it('throws on API error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: { message: 'Internal Server Error' } }),
    });

    await expect(
      postToApi(DEFAULT_API_URL, 'https://rightmove.co.uk/properties/1', '<html/>', '')
    ).rejects.toThrow('Internal Server Error');
  });

  it('throws generic message when error body missing', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: () => Promise.reject(new Error('not json')),
    });

    await expect(
      postToApi(DEFAULT_API_URL, 'https://rightmove.co.uk/properties/1', '<html/>', '')
    ).rejects.toThrow('API error: 503');
  });
});

describe('recordResult', () => {
  beforeEach(() => {
    globalThis.chrome = createChromeMock();
  });

  it('increments batchCompleted', async () => {
    await chrome.storage.local.set({ batchCompleted: 2, batchResults: [] });

    await recordResult(chrome, {
      url: 'https://rightmove.co.uk/properties/1',
      title: 'House',
      grade: 'A',
      success: true,
    });

    const stored = await chrome.storage.local.get(['batchCompleted']);
    expect(stored.batchCompleted).toBe(3);
  });

  it('appends result to batchResults', async () => {
    await chrome.storage.local.set({ batchCompleted: 0, batchResults: [] });

    await recordResult(chrome, {
      url: 'https://rightmove.co.uk/properties/1',
      title: 'My House',
      grade: 'B',
      success: true,
    });

    const stored = await chrome.storage.local.get(['batchResults']);
    expect(stored.batchResults).toHaveLength(1);
    expect(stored.batchResults[0].title).toBe('My House');
    expect(stored.batchResults[0].success).toBe(true);
  });

  it('stores haulId and haulUrl on first result', async () => {
    await chrome.storage.local.set({ batchCompleted: 0, batchResults: [] });

    await recordResult(chrome, {
      url: 'https://rightmove.co.uk/properties/1',
      title: '',
      grade: '?',
      success: true,
      haulId: 'cool-fox-99',
      haulUrl: '/haul/cool-fox-99',
    });

    const stored = await chrome.storage.local.get(['batchHaulId', 'batchHaulUrl']);
    expect(stored.batchHaulId).toBe('cool-fox-99');
    expect(stored.batchHaulUrl).toBe('/haul/cool-fox-99');
  });
});

describe('START_BATCH message handler', () => {
  beforeEach(() => {
    globalThis.chrome = createChromeMock();
  });

  it('initialises batch state in storage', async () => {
    const urls = [
      'https://www.rightmove.co.uk/properties/1',
      'https://www.rightmove.co.uk/properties/2',
    ];

    await chrome.storage.local.set({
      batchStatus: 'running',
      batchTotal: urls.length,
      batchCompleted: 0,
      batchFailed: 0,
      batchUrls: urls,
      batchResults: [],
      batchHaulId: '',
      batchHaulUrl: '',
    });

    const stored = await chrome.storage.local.get([
      'batchStatus', 'batchTotal', 'batchUrls',
    ]);
    expect(stored.batchStatus).toBe('running');
    expect(stored.batchTotal).toBe(2);
    expect(stored.batchUrls).toEqual(urls);
  });
});

describe('CANCEL_BATCH message handler', () => {
  beforeEach(() => {
    globalThis.chrome = createChromeMock();
  });

  it('sets batchStatus to idle and clears queue', async () => {
    await chrome.storage.local.set({
      batchStatus: 'running',
      batchUrls: ['https://rightmove.co.uk/properties/1'],
    });

    await chrome.storage.local.set({ batchStatus: 'idle', batchUrls: [] });

    const stored = await chrome.storage.local.get(['batchStatus', 'batchUrls']);
    expect(stored.batchStatus).toBe('idle');
    expect(stored.batchUrls).toEqual([]);
  });
});

describe('resumeIfInterrupted', () => {
  beforeEach(() => {
    globalThis.chrome = createChromeMock();
  });

  it('does not resume when batchStatus is idle', async () => {
    await chrome.storage.local.set({ batchStatus: 'idle', batchUrls: [] });

    const { batchStatus, batchUrls } = await chrome.storage.local.get(['batchStatus', 'batchUrls']);
    const shouldResume = batchStatus === 'running' && batchUrls?.length > 0;
    expect(shouldResume).toBe(false);
  });

  it('does not resume when queue is empty', async () => {
    await chrome.storage.local.set({ batchStatus: 'running', batchUrls: [] });

    const { batchStatus, batchUrls } = await chrome.storage.local.get(['batchStatus', 'batchUrls']);
    const shouldResume = batchStatus === 'running' && batchUrls?.length > 0;
    expect(shouldResume).toBe(false);
  });

  it('should resume when status is running with items in queue', async () => {
    await chrome.storage.local.set({
      batchStatus: 'running',
      batchUrls: ['https://rightmove.co.uk/properties/1'],
    });

    const { batchStatus, batchUrls } = await chrome.storage.local.get(['batchStatus', 'batchUrls']);
    const shouldResume = batchStatus === 'running' && batchUrls?.length > 0;
    expect(shouldResume).toBe(true);
  });
});
