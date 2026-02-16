import { describe, it, expect, beforeEach } from 'vitest';
import { getRuntimeConfig, updateRuntimeConfig, resetRuntimeConfig } from '../../src/lib/services/runtime-config.js';

describe('runtime-config', () => {
  beforeEach(() => {
    resetRuntimeConfig();
  });

  it('returns defaults when no overrides are set', () => {
    const config = getRuntimeConfig();
    expect(config.maxRequests).toBe(60);
  });

  it('updates maxRequests via updateRuntimeConfig', () => {
    updateRuntimeConfig({ maxRequests: 100 });
    expect(getRuntimeConfig().maxRequests).toBe(100);
  });

  it('rejects maxRequests below 1', () => {
    expect(() => updateRuntimeConfig({ maxRequests: 0 })).toThrow('maxRequests must be between 1 and 1000');
    expect(() => updateRuntimeConfig({ maxRequests: -5 })).toThrow('maxRequests must be between 1 and 1000');
  });

  it('rejects maxRequests above 1000', () => {
    expect(() => updateRuntimeConfig({ maxRequests: 1001 })).toThrow('maxRequests must be between 1 and 1000');
  });

  it('rejects non-number values for maxRequests', () => {
    expect(() => updateRuntimeConfig({ maxRequests: 'fast' as any })).toThrow('maxRequests must be between 1 and 1000');
    expect(() => updateRuntimeConfig({ maxRequests: true as any })).toThrow('maxRequests must be between 1 and 1000');
  });

  it('resetRuntimeConfig restores defaults', () => {
    updateRuntimeConfig({ maxRequests: 200 });
    expect(getRuntimeConfig().maxRequests).toBe(200);
    resetRuntimeConfig();
    expect(getRuntimeConfig().maxRequests).toBe(60);
  });

  it('later updates overwrite earlier ones', () => {
    updateRuntimeConfig({ maxRequests: 100 });
    updateRuntimeConfig({ maxRequests: 500 });
    expect(getRuntimeConfig().maxRequests).toBe(500);
  });

  it('accepts boundary values 1 and 1000', () => {
    updateRuntimeConfig({ maxRequests: 1 });
    expect(getRuntimeConfig().maxRequests).toBe(1);
    updateRuntimeConfig({ maxRequests: 1000 });
    expect(getRuntimeConfig().maxRequests).toBe(1000);
  });
});
