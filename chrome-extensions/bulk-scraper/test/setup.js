import { beforeEach, vi } from 'vitest';
import { createChromeMock } from './chrome-mock.js';

beforeEach(() => {
  // Install fresh Chrome mock
  globalThis.chrome = createChromeMock();
  // Stub fetch
  globalThis.fetch = vi.fn();
});
