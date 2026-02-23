/**
 * Tests for resilient-fetch.ts — retry, backoff, UA rotation, block detection.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resilientFetch } from '../../src/lib/services/resilient-fetch.js';

// Use real timers; keep delays at 0 to avoid actual waits.
// Stub Math.random → 0 to eliminate jitter.

function makeOkResponse(html: string, status = 200): Response {
  return new Response(html, { status });
}

// Creates a mock that cycles through responses; repeats the last one
function makeFetchMock(responses: Response[]): ReturnType<typeof vi.fn> {
  let callCount = 0;
  return vi.fn().mockImplementation(() => {
    const resp = responses[callCount] ?? responses[responses.length - 1];
    callCount++;
    return Promise.resolve(resp);
  });
}

beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0); // eliminate jitter
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('resilientFetch', () => {
  it('returns HTML and 200 on first successful attempt', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeOkResponse('<html>Hello</html>'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await resilientFetch('https://example.com/', { maxRetries: 0, baseDelay: 0 });

    expect(result.html).toBe('<html>Hello</html>');
    expect(result.statusCode).toBe(200);
    expect(result.blocked).toBe(false);
    expect(result.retryCount).toBe(0);
  });

  it('returns a userAgent string from the pool', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeOkResponse('<html></html>'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await resilientFetch('https://example.com/', { maxRetries: 0, baseDelay: 0 });

    expect(typeof result.userAgent).toBe('string');
    expect(result.userAgent.length).toBeGreaterThan(10);
  });

  it('uses custom userAgentPool', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeOkResponse('<html></html>'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await resilientFetch('https://example.com/', {
      maxRetries: 0,
      baseDelay: 0,
      userAgentPool: ['TestBot/1.0'],
    });

    expect(result.userAgent).toBe('TestBot/1.0');
  });

  it('retries on 429 and succeeds on second attempt', async () => {
    const rate429 = new Response('Too Many Requests', { status: 429 });
    const ok200 = makeOkResponse('<html>OK</html>');
    const fetchMock = makeFetchMock([rate429, ok200]);
    vi.stubGlobal('fetch', fetchMock);

    const result = await resilientFetch('https://example.com/', { maxRetries: 2, baseDelay: 0 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.statusCode).toBe(200);
    expect(result.blocked).toBe(false);
    expect(result.retryCount).toBe(1);
  });

  it('retries on 503', async () => {
    const err503 = new Response('Service Unavailable', { status: 503 });
    const ok200 = makeOkResponse('<html>OK</html>');
    const fetchMock = makeFetchMock([err503, ok200]);
    vi.stubGlobal('fetch', fetchMock);

    const result = await resilientFetch('https://example.com/', { maxRetries: 2, baseDelay: 0 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.statusCode).toBe(200);
  });

  it('marks result as blocked for 403 status', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('Forbidden', { status: 403 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await resilientFetch('https://example.com/', { maxRetries: 0, baseDelay: 0 });

    expect(result.blocked).toBe(true);
    expect(result.statusCode).toBe(403);
  });

  it('marks result as blocked for captcha in short HTML', async () => {
    const captchaHtml = '<html><body>captcha required</body></html>';
    const fetchMock = vi.fn().mockResolvedValue(makeOkResponse(captchaHtml));
    vi.stubGlobal('fetch', fetchMock);

    const result = await resilientFetch('https://example.com/', { maxRetries: 0, baseDelay: 0 });

    expect(result.blocked).toBe(true);
  });

  it('does not mark large HTML as blocked even if it contains block keywords', async () => {
    const largeHtml = '<html><body>' + 'A'.repeat(3000) + '<!-- captcha form here --></body></html>';
    const fetchMock = vi.fn().mockResolvedValue(makeOkResponse(largeHtml));
    vi.stubGlobal('fetch', fetchMock);

    const result = await resilientFetch('https://example.com/', { maxRetries: 0, baseDelay: 0 });

    expect(result.blocked).toBe(false);
  });

  it('handles network errors and returns statusCode 0', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('network error'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await resilientFetch('https://example.com/', { maxRetries: 0, baseDelay: 0 });

    expect(result.statusCode).toBe(0);
    expect(result.html).toBe('');
    expect(result.blocked).toBe(false);
  });

  it('exhausts retries and returns last result after all attempts', async () => {
    // Use mockImplementation so each call gets a fresh Response (body can only be read once)
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(new Response('Rate Limited', { status: 429 })),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await resilientFetch('https://example.com/', { maxRetries: 2, baseDelay: 0 });

    expect(fetchMock).toHaveBeenCalledTimes(3); // initial + 2 retries
    expect(result.statusCode).toBe(429);
    expect(result.blocked).toBe(true);
    expect(result.retryCount).toBe(2);
  });

  it('does not retry non-retryable status codes like 404', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('Not Found', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await resilientFetch('https://example.com/', { maxRetries: 3, baseDelay: 0 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.statusCode).toBe(404);
  });

  it('uses correct User-Agent header in request', async () => {
    const capturedHeaders: Record<string, string>[] = [];
    const fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      capturedHeaders.push(init?.headers as Record<string, string>);
      return Promise.resolve(makeOkResponse('<html></html>'));
    });
    vi.stubGlobal('fetch', fetchMock);

    await resilientFetch('https://example.com/', {
      maxRetries: 0,
      baseDelay: 0,
      userAgentPool: ['CustomAgent/1.0'],
    });

    expect(capturedHeaders[0]['User-Agent']).toBe('CustomAgent/1.0');
  });

  it('marks cloudflare challenge as blocked', async () => {
    const html = '<html><body><h1>Just a moment...</h1></body></html>';
    const fetchMock = vi.fn().mockResolvedValue(makeOkResponse(html));
    vi.stubGlobal('fetch', fetchMock);

    const result = await resilientFetch('https://example.com/', { maxRetries: 0, baseDelay: 0 });

    expect(result.blocked).toBe(true);
  });
});
