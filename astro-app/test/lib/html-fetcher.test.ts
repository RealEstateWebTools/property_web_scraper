import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchHtml } from '../../src/lib/services/html-fetcher.js';

describe('fetchHtml', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns HTML on successful fetch', async () => {
    const mockHtml = '<html><body>Hello</body></html>';
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: () => Promise.resolve(mockHtml),
    });

    const result = await fetchHtml('https://www.example.com/page');

    expect(result.success).toBe(true);
    expect(result.html).toBe(mockHtml);
    expect(result.error).toBeUndefined();
    expect(globalThis.fetch).toHaveBeenCalledOnce();
  });

  it('sends realistic browser headers', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: () => Promise.resolve('<html></html>'),
    });

    await fetchHtml('https://www.example.com/page');

    const callArgs = (globalThis.fetch as any).mock.calls[0];
    const headers = callArgs[1].headers;
    expect(headers['User-Agent']).toContain('Mozilla/5.0');
    expect(headers['Accept']).toContain('text/html');
    expect(headers['Accept-Language']).toContain('en-US');
  });

  it('returns error on HTTP 404', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: () => Promise.resolve(''),
    });

    const result = await fetchHtml('https://www.example.com/missing');

    expect(result.success).toBe(false);
    expect(result.html).toBeUndefined();
    expect(result.error).toBe('HTTP 404 Not Found');
  });

  it('returns error on HTTP 500', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: () => Promise.resolve(''),
    });

    const result = await fetchHtml('https://www.example.com/error');

    expect(result.success).toBe(false);
    expect(result.error).toBe('HTTP 500 Internal Server Error');
  });

  it('returns error on network failure', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('fetch failed'));

    const result = await fetchHtml('https://www.unreachable.test/page');

    expect(result.success).toBe(false);
    expect(result.html).toBeUndefined();
    expect(result.error).toBe('fetch failed');
  });

  it('returns timeout error when request exceeds timeout', async () => {
    globalThis.fetch = vi.fn().mockImplementation((_url, opts) => {
      return new Promise((_resolve, reject) => {
        opts?.signal?.addEventListener('abort', () => {
          const err = new DOMException('The operation was aborted.', 'AbortError');
          reject(err);
        });
      });
    });

    const result = await fetchHtml('https://www.slow-site.test/page', 50);

    expect(result.success).toBe(false);
    expect(result.error).toContain('timed out');
  });
});
