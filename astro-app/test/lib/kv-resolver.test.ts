import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resolveKV } from '../../src/lib/services/kv-resolver.js';
import { _resetDevKV } from '../../src/lib/services/dev-kv.js';

describe('resolveKV', () => {
  beforeEach(() => {
    _resetDevKV();
    // Ensure DEV_KV_PERSIST is not set by default
    delete process.env.DEV_KV_PERSIST;
  });

  it('returns runtime KV binding when present in locals', () => {
    const fakeKV = { put: vi.fn(), get: vi.fn() };
    const locals = { runtime: { env: { RESULTS: fakeKV } } };
    expect(resolveKV(locals)).toBe(fakeKV);
  });

  it('returns null when no runtime binding and DEV_KV_PERSIST is not set', () => {
    expect(resolveKV({})).toBeNull();
  });

  it('returns null when locals is undefined', () => {
    expect(resolveKV(undefined)).toBeNull();
  });

  it('returns DevKV when DEV_KV_PERSIST is set and no runtime binding', () => {
    process.env.DEV_KV_PERSIST = 'true';
    const result = resolveKV({});
    expect(result).not.toBeNull();
    expect(typeof result.put).toBe('function');
    expect(typeof result.get).toBe('function');
  });

  it('prefers runtime binding over DevKV', () => {
    process.env.DEV_KV_PERSIST = 'true';
    const fakeKV = { put: vi.fn(), get: vi.fn() };
    const locals = { runtime: { env: { RESULTS: fakeKV } } };
    expect(resolveKV(locals)).toBe(fakeKV);
  });
});
