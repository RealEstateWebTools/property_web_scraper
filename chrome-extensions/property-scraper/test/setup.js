import { beforeEach, vi } from 'vitest';
import { createChromeMock } from './chrome-mock.js';

beforeEach(() => {
  // Install fresh Chrome mock
  globalThis.chrome = createChromeMock();
  // Reset HaulHistory (set by haul-history.js IIFE)
  globalThis.HaulHistory = undefined;
  // Stub importScripts (used by background.js service worker)
  globalThis.importScripts = vi.fn();
  // Stub fetch
  globalThis.fetch = vi.fn();
});
