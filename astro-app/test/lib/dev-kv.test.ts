import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DevKV } from '../../src/lib/services/dev-kv.js';

describe('DevKV', () => {
  let dir: string;
  let kv: DevKV;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'dev-kv-test-'));
    kv = new DevKV(dir);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('round-trips a string value', async () => {
    await kv.put('key1', 'hello');
    const val = await kv.get('key1');
    expect(val).toBe('hello');
  });

  it('round-trips a JSON value', async () => {
    const obj = { id: 'abc', items: [1, 2, 3] };
    await kv.put('key2', JSON.stringify(obj));
    const val = await kv.get('key2', 'json');
    expect(val).toEqual(obj);
  });

  it('returns null for a missing key', async () => {
    const val = await kv.get('nonexistent', 'json');
    expect(val).toBeNull();
  });

  it('handles keys with special characters', async () => {
    await kv.put('haul:abc-123', JSON.stringify({ ok: true }));
    const val = await kv.get('haul:abc-123', 'json');
    expect(val).toEqual({ ok: true });
  });

  it('respects TTL expiry', async () => {
    await kv.put('expiring', 'data', { expirationTtl: 5 });

    // Before expiry — value available
    const before = await kv.get('expiring');
    expect(before).toBe('data');

    // Fast-forward past TTL
    const future = Date.now() + 6000;
    vi.spyOn(Date, 'now').mockReturnValue(future);

    const after = await kv.get('expiring');
    expect(after).toBeNull();

    vi.restoreAllMocks();
  });

  it('overwrites existing key', async () => {
    await kv.put('k', 'v1');
    await kv.put('k', 'v2');
    const val = await kv.get('k');
    expect(val).toBe('v2');
  });
});
