import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { authenticateApiKey, extractHtmlInput } from '../../src/lib/services/auth.js';

// Mock import.meta.env for auth tests
const originalEnv = import.meta.env;

describe('authenticateApiKey', () => {
  afterEach(() => {
    // Restore env
    import.meta.env.PWS_API_KEY = '';
  });

  it('skips auth when no key is configured (backwards compatible)', () => {
    import.meta.env.PWS_API_KEY = '';
    const request = new Request('http://localhost/api/test');
    const result = authenticateApiKey(request);
    expect(result.authorized).toBe(true);
    expect(result.errorResponse).toBeUndefined();
  });

  it('authorizes when valid key is provided via header', () => {
    import.meta.env.PWS_API_KEY = 'secret-key-123';
    const request = new Request('http://localhost/api/test', {
      headers: { 'X-Api-Key': 'secret-key-123' },
    });
    const result = authenticateApiKey(request);
    expect(result.authorized).toBe(true);
    expect(result.errorResponse).toBeUndefined();
  });

  it('authorizes when valid key is provided via query param', () => {
    import.meta.env.PWS_API_KEY = 'secret-key-123';
    const request = new Request('http://localhost/api/test?api_key=secret-key-123');
    const result = authenticateApiKey(request);
    expect(result.authorized).toBe(true);
    expect(result.errorResponse).toBeUndefined();
  });

  it('rejects when invalid key is provided', () => {
    import.meta.env.PWS_API_KEY = 'secret-key-123';
    const request = new Request('http://localhost/api/test', {
      headers: { 'X-Api-Key': 'wrong-key' },
    });
    const result = authenticateApiKey(request);
    expect(result.authorized).toBe(false);
    expect(result.errorResponse).toBeInstanceOf(Response);
  });

  it('rejects when no key is provided but one is expected', () => {
    import.meta.env.PWS_API_KEY = 'secret-key-123';
    const request = new Request('http://localhost/api/test');
    const result = authenticateApiKey(request);
    expect(result.authorized).toBe(false);
    expect(result.errorResponse).toBeInstanceOf(Response);
  });

  it('error response has 401 status', async () => {
    import.meta.env.PWS_API_KEY = 'secret-key-123';
    const request = new Request('http://localhost/api/test');
    const result = authenticateApiKey(request);
    expect(result.errorResponse!.status).toBe(401);
    const body = await result.errorResponse!.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('prefers header over query param', () => {
    import.meta.env.PWS_API_KEY = 'secret-key-123';
    const request = new Request('http://localhost/api/test?api_key=wrong', {
      headers: { 'X-Api-Key': 'secret-key-123' },
    });
    const result = authenticateApiKey(request);
    expect(result.authorized).toBe(true);
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
});
