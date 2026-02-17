import { describe, it, expect } from 'vitest';
import { constantTimeCompare } from '../../src/lib/services/constant-time.js';

describe('constantTimeCompare', () => {
  it('returns true for identical strings', () => {
    expect(constantTimeCompare('secret-key-123', 'secret-key-123')).toBe(true);
  });

  it('returns false for different strings with same length', () => {
    expect(constantTimeCompare('secret-key-123', 'secret-key-456')).toBe(false);
  });

  it('returns false for different lengths', () => {
    expect(constantTimeCompare('short', 'longer')).toBe(false);
  });
});
