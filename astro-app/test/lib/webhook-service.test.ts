/**
 * Tests for webhook-service — registration, HMAC signing, and event filtering.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerWebhook,
  removeWebhook,
  listWebhooks,
  getWebhook,
  clearWebhookStore,
  computeHmacSha256,
  type WebhookEvent,
} from '../../src/lib/services/webhook-service.js';

beforeEach(() => {
  clearWebhookStore();
});

describe('webhook registration', () => {
  it('registers a webhook with id and timestamps', async () => {
    const wh = await registerWebhook('https://example.com/hook', ['extraction.completed']);
    expect(wh.id).toMatch(/^wh_/);
    expect(wh.url).toBe('https://example.com/hook');
    expect(wh.events).toEqual(['extraction.completed']);
    expect(wh.active).toBe(true);
    expect(wh.createdAt).toBeTruthy();
  });

  it('registers with secret', async () => {
    const wh = await registerWebhook('https://example.com/hook', ['extraction.completed'], 'my-secret');
    expect(wh.secret).toBe('my-secret');
  });

  it('registers multiple events', async () => {
    const wh = await registerWebhook('https://example.com/hook', ['extraction.completed', 'extraction.failed']);
    expect(wh.events).toHaveLength(2);
    expect(wh.events).toContain('extraction.completed');
    expect(wh.events).toContain('extraction.failed');
  });

  it('generates unique IDs', async () => {
    const wh1 = await registerWebhook('https://a.com/hook', ['extraction.completed']);
    const wh2 = await registerWebhook('https://b.com/hook', ['extraction.completed']);
    expect(wh1.id).not.toBe(wh2.id);
  });
});

describe('webhook listing', () => {
  it('lists all registered webhooks', async () => {
    await registerWebhook('https://a.com/hook', ['extraction.completed']);
    await registerWebhook('https://b.com/hook', ['extraction.failed']);
    const list = await listWebhooks();
    expect(list).toHaveLength(2);
  });

  it('returns empty array when none registered', async () => {
    const list = await listWebhooks();
    expect(list).toHaveLength(0);
  });
});

describe('webhook retrieval', () => {
  it('retrieves by id', async () => {
    const wh = await registerWebhook('https://example.com/hook', ['extraction.completed']);
    const retrieved = await getWebhook(wh.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.url).toBe('https://example.com/hook');
  });

  it('returns null for unknown id', async () => {
    const retrieved = await getWebhook('wh_nonexistent');
    expect(retrieved).toBeNull();
  });
});

describe('webhook removal', () => {
  it('removes a registered webhook', async () => {
    const wh = await registerWebhook('https://example.com/hook', ['extraction.completed']);
    const removed = await removeWebhook(wh.id);
    expect(removed).toBe(true);
    const list = await listWebhooks();
    expect(list).toHaveLength(0);
  });

  it('returns false for non-existent webhook', async () => {
    const removed = await removeWebhook('wh_nonexistent');
    expect(removed).toBe(false);
  });
});

describe('HMAC signing', () => {
  it('produces consistent signatures', async () => {
    const sig1 = await computeHmacSha256('test-payload', 'test-secret');
    const sig2 = await computeHmacSha256('test-payload', 'test-secret');
    expect(sig1).toBe(sig2);
  });

  it('produces different signatures for different payloads', async () => {
    const sig1 = await computeHmacSha256('payload-a', 'secret');
    const sig2 = await computeHmacSha256('payload-b', 'secret');
    expect(sig1).not.toBe(sig2);
  });

  it('produces different signatures for different secrets', async () => {
    const sig1 = await computeHmacSha256('payload', 'secret-a');
    const sig2 = await computeHmacSha256('payload', 'secret-b');
    expect(sig1).not.toBe(sig2);
  });

  it('returns hex string', async () => {
    const sig = await computeHmacSha256('test', 'key');
    expect(sig).toMatch(/^[0-9a-f]+$/);
    expect(sig.length).toBe(64); // SHA-256 = 32 bytes = 64 hex chars
  });
});

describe('clearWebhookStore', () => {
  it('clears all webhooks', async () => {
    await registerWebhook('https://a.com', ['extraction.completed']);
    await registerWebhook('https://b.com', ['extraction.failed']);
    clearWebhookStore();
    expect(await listWebhooks()).toHaveLength(0);
  });
});
