import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

// Mock api-key-service so auth.ts can import it
vi.mock('../../src/lib/services/api-key-service.js', () => ({
  validateApiKey: vi.fn().mockResolvedValue(null),
}));

import {
  authenticateApiKey,
  extractHtmlInput,
  validateUrlLength,
  MAX_HTML_SIZE,
} from '../../src/lib/services/auth.js';
import { validateApiKey as mockValidateApiKey } from '../../src/lib/services/api-key-service.js';

describe('authenticateApiKey', () => {
  afterEach(() => {
    import.meta.env.PWS_API_KEY = '';
    import.meta.env.PWS_LOCKED_ENDPOINTS = '';
    vi.mocked(mockValidateApiKey).mockReset().mockResolvedValue(null);
  });

  it('skips auth when no key is configured (backwards compatible)', async () => {
    import.meta.env.PWS_API_KEY = '';
    const request = new Request('http://localhost/api/test');
    const result = await authenticateApiKey(request);
    expect(result.authorized).toBe(true);
    expect(result.userId).toBe('anonymous');
    expect(result.tier).toBe('free');
  });

  it('authorizes master key via header with enterprise tier', async () => {
    import.meta.env.PWS_API_KEY = 'secret-key-123';
    const request = new Request('http://localhost/api/test', {
      headers: { 'X-Api-Key': 'secret-key-123' },
    });
    const result = await authenticateApiKey(request);
    expect(result.authorized).toBe(true);
    expect(result.userId).toBe('master');
    expect(result.tier).toBe('enterprise');
  });

  it('authorizes master key via query param', async () => {
    import.meta.env.PWS_API_KEY = 'secret-key-123';
    const request = new Request('http://localhost/api/test?api_key=secret-key-123');
    const result = await authenticateApiKey(request);
    expect(result.authorized).toBe(true);
    expect(result.userId).toBe('master');
  });

  it('authorizes per-user key when api-key-service validates', async () => {
    import.meta.env.PWS_API_KEY = 'master';
    vi.mocked(mockValidateApiKey).mockResolvedValue({
      userId: 'user-42',
      tier: 'starter',
      label: 'my-key',
    });
    const request = new Request('http://localhost/api/test', {
      headers: { 'X-Api-Key': 'pws_live_0123456789abcdef0123456789abcdef' },
    });
    const result = await authenticateApiKey(request);
    expect(result.authorized).toBe(true);
    expect(result.userId).toBe('user-42');
    expect(result.tier).toBe('starter');
  });

  it('rejects when invalid key is provided', async () => {
    import.meta.env.PWS_API_KEY = 'secret-key-123';
    const request = new Request('http://localhost/api/test', {
      headers: { 'X-Api-Key': 'wrong-key' },
    });
    const result = await authenticateApiKey(request);
    expect(result.authorized).toBe(false);
    expect(result.errorResponse).toBeInstanceOf(Response);
  });

  it('allows anonymous access at free tier even when master key is configured', async () => {
    import.meta.env.PWS_API_KEY = 'secret-key-123';
    const request = new Request('http://localhost/api/test');
    const result = await authenticateApiKey(request);
    expect(result.authorized).toBe(true);
    expect(result.userId).toBe('anonymous');
    expect(result.tier).toBe('free');
  });

  it('rejects anonymous request to locked endpoint', async () => {
    import.meta.env.PWS_API_KEY = 'secret-key-123';
    import.meta.env.PWS_LOCKED_ENDPOINTS = '/public_api/v1/export,/public_api/v1/billing';
    const request = new Request('http://localhost/public_api/v1/export?format=json');
    const result = await authenticateApiKey(request);
    expect(result.authorized).toBe(false);
    expect(result.errorResponse).toBeInstanceOf(Response);
    expect(result.errorResponse!.status).toBe(401);
  });

  it('allows anonymous request to non-locked endpoint when others are locked', async () => {
    import.meta.env.PWS_API_KEY = 'secret-key-123';
    import.meta.env.PWS_LOCKED_ENDPOINTS = '/public_api/v1/export';
    const request = new Request('http://localhost/public_api/v1/listings');
    const result = await authenticateApiKey(request);
    expect(result.authorized).toBe(true);
    expect(result.userId).toBe('anonymous');
    expect(result.tier).toBe('free');
  });

  it('allows keyed request to locked endpoint', async () => {
    import.meta.env.PWS_API_KEY = 'secret-key-123';
    import.meta.env.PWS_LOCKED_ENDPOINTS = '/public_api/v1/export';
    const request = new Request('http://localhost/public_api/v1/export?format=json', {
      headers: { 'X-Api-Key': 'secret-key-123' },
    });
    const result = await authenticateApiKey(request);
    expect(result.authorized).toBe(true);
    expect(result.userId).toBe('master');
    expect(result.tier).toBe('enterprise');
  });

  it('error response has 401 status', async () => {
    import.meta.env.PWS_API_KEY = 'secret-key-123';
    const request = new Request('http://localhost/api/test', {
      headers: { 'X-Api-Key': 'wrong-key' },
    });
    const result = await authenticateApiKey(request);
    expect(result.errorResponse!.status).toBe(401);
    const body = await result.errorResponse!.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('prefers header over query param', async () => {
    import.meta.env.PWS_API_KEY = 'secret-key-123';
    const request = new Request('http://localhost/api/test?api_key=wrong', {
      headers: { 'X-Api-Key': 'secret-key-123' },
    });
    const result = await authenticateApiKey(request);
    expect(result.authorized).toBe(true);
  });

  it('rejects pws_live_ key when api-key-service returns null', async () => {
    import.meta.env.PWS_API_KEY = 'master';
    vi.mocked(mockValidateApiKey).mockResolvedValue(null);
    const request = new Request('http://localhost/api/test', {
      headers: { 'X-Api-Key': 'pws_live_invalidinvalidinvalidinvalid' },
    });
    const result = await authenticateApiKey(request);
    expect(result.authorized).toBe(false);
  });
});

describe('extractHtmlInput', () => {
  it('extracts HTML from application/json body', async () => {
    const request = new Request('http://localhost/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html: '<html><body>test</body></html>' }),
    });
    const result = await extractHtmlInput(request);
    expect(result).toBe('<html><body>test</body></html>');
  });

  it('returns null from JSON body when html field is missing', async () => {
    const request = new Request('http://localhost/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' }),
    });
    const result = await extractHtmlInput(request);
    expect(result).toBeNull();
  });

  it('extracts HTML from URL-encoded body', async () => {
    const params = new URLSearchParams();
    params.set('html', '<html>encoded</html>');
    const request = new Request('http://localhost/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const result = await extractHtmlInput(request);
    expect(result).toBe('<html>encoded</html>');
  });

  it('returns null for URL-encoded body without html param', async () => {
    const params = new URLSearchParams();
    params.set('url', 'https://example.com');
    const request = new Request('http://localhost/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const result = await extractHtmlInput(request);
    expect(result).toBeNull();
  });

  it('extracts HTML from multipart form-data with html field', async () => {
    const formData = new FormData();
    formData.set('html', '<html>from form</html>');
    const request = new Request('http://localhost/api/test', {
      method: 'POST',
      body: formData,
    });
    const result = await extractHtmlInput(request);
    expect(result).toBe('<html>from form</html>');
  });

  it('extracts HTML from multipart form-data with html_file', async () => {
    const file = new File(['<html>from file</html>'], 'page.html', { type: 'text/html' });
    const formData = new FormData();
    formData.set('html_file', file);
    const request = new Request('http://localhost/api/test', {
      method: 'POST',
      body: formData,
    });
    const result = await extractHtmlInput(request);
    expect(result).toBe('<html>from file</html>');
  });

  it('returns null for unsupported content type', async () => {
    const request = new Request('http://localhost/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'html=<html>plain</html>',
    });
    const result = await extractHtmlInput(request);
    expect(result).toBeNull();
  });

  it('returns null when no content-type header is present', async () => {
    const request = new Request('http://localhost/api/test', {
      method: 'POST',
      body: 'html=<html>no type</html>',
    });
    const result = await extractHtmlInput(request);
    expect(result).toBeNull();
  });

  it('throws when JSON html exceeds the max payload size', async () => {
    const tooLargeHtml = 'a'.repeat(MAX_HTML_SIZE + 1);
    const request = new Request('http://localhost/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html: tooLargeHtml }),
    });
    await expect(extractHtmlInput(request)).rejects.toThrow(/exceeds/i);
  });
});

describe('validateUrlLength', () => {
  it('allows URL at or under the limit', () => {
    expect(() => validateUrlLength('https://example.com/path')).not.toThrow();
  });

  it('throws for URLs above the limit', () => {
    const veryLongUrl = `https://example.com/${'a'.repeat(2050)}`;
    expect(() => validateUrlLength(veryLongUrl)).toThrow(/exceeds/i);
  });
});
