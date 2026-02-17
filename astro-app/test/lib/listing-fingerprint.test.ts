import { describe, it, expect } from 'vitest';
import { computeFingerprint } from '../../src/lib/services/listing-fingerprint.js';

describe('listing-fingerprint', () => {
  it('produces the same fingerprint for identical inputs', () => {
    const a = computeFingerprint({ title: 'Lovely flat', price_float: 250000, address_string: '10 Main St' });
    const b = computeFingerprint({ title: 'Lovely flat', price_float: 250000, address_string: '10 Main St' });
    expect(a).toBe(b);
  });

  it('produces different fingerprints for different prices', () => {
    const a = computeFingerprint({ title: 'Lovely flat', price_float: 250000, address_string: '10 Main St' });
    const b = computeFingerprint({ title: 'Lovely flat', price_float: 300000, address_string: '10 Main St' });
    expect(a).not.toBe(b);
  });

  it('is case insensitive for title', () => {
    const a = computeFingerprint({ title: 'Lovely Flat', price_float: 250000, address_string: '10 Main St' });
    const b = computeFingerprint({ title: 'lovely flat', price_float: 250000, address_string: '10 main st' });
    expect(a).toBe(b);
  });

  it('handles missing fields gracefully', () => {
    const a = computeFingerprint({});
    const b = computeFingerprint({ title: undefined, price_float: undefined, address_string: undefined });
    expect(a).toBe(b);
    // Should not throw
    expect(typeof a).toBe('string');
  });

  it('produces a 16-character hex string', () => {
    const fp = computeFingerprint({ title: 'Test', price_float: 100000, address_string: '1 Test Rd' });
    expect(fp).toMatch(/^[0-9a-f]{16}$/);
  });

  it('produces different fingerprints for different addresses', () => {
    const a = computeFingerprint({ title: 'Flat', price_float: 200000, address_string: '1 High St' });
    const b = computeFingerprint({ title: 'Flat', price_float: 200000, address_string: '2 Low St' });
    expect(a).not.toBe(b);
  });

  it('produces different fingerprints for different titles', () => {
    const a = computeFingerprint({ title: 'Modern apartment', price_float: 200000, address_string: '1 High St' });
    const b = computeFingerprint({ title: 'Period cottage', price_float: 200000, address_string: '1 High St' });
    expect(a).not.toBe(b);
  });

  it('trims whitespace from title and address', () => {
    const a = computeFingerprint({ title: '  Lovely flat  ', address_string: '  10 Main St  ' });
    const b = computeFingerprint({ title: 'Lovely flat', address_string: '10 Main St' });
    expect(a).toBe(b);
  });
});
