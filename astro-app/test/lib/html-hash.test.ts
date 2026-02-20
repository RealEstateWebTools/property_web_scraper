import { describe, it, expect } from 'vitest';
import { computeHtmlHash } from '../../src/lib/utils/html-hash.js';

describe('computeHtmlHash', () => {
  it('same input always produces the same hash', async () => {
    const html = '<html><body><h1>Test</h1></body></html>';
    const h1 = await computeHtmlHash(html);
    const h2 = await computeHtmlHash(html);
    expect(h1).toBe(h2);
  });

  it('different input produces different hash', async () => {
    const h1 = await computeHtmlHash('<html>page A</html>');
    const h2 = await computeHtmlHash('<html>page B</html>');
    expect(h1).not.toBe(h2);
  });

  it('empty string hashes without error', async () => {
    const hash = await computeHtmlHash('');
    expect(typeof hash).toBe('string');
    expect(hash.length).toBe(16);
  });

  it('hash is exactly 16 hex characters', async () => {
    const hash = await computeHtmlHash('<html><body>content</body></html>');
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('large input (100KB) hashes without error', async () => {
    const html = 'x'.repeat(100 * 1024);
    const hash = await computeHtmlHash(html);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });
});
