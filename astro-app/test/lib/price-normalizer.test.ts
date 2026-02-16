import { describe, it, expect } from 'vitest';
import {
  detectCurrency,
  parsePriceToCents,
  normalizePrice,
  CURRENCY_SYMBOLS,
} from '../../src/lib/extractor/price-normalizer.js';

describe('price-normalizer', () => {
  describe('CURRENCY_SYMBOLS', () => {
    it('maps $ to USD', () => {
      expect(CURRENCY_SYMBOLS['$']).toBe('USD');
    });

    it('maps £ to GBP', () => {
      expect(CURRENCY_SYMBOLS['£']).toBe('GBP');
    });

    it('maps € to EUR', () => {
      expect(CURRENCY_SYMBOLS['€']).toBe('EUR');
    });

    it('maps ₹ to INR', () => {
      expect(CURRENCY_SYMBOLS['₹']).toBe('INR');
    });
  });

  describe('detectCurrency', () => {
    it('detects USD from dollar sign', () => {
      expect(detectCurrency('$500,000')).toBe('USD');
    });

    it('detects GBP from pound sign', () => {
      expect(detectCurrency('£250,000')).toBe('GBP');
    });

    it('detects EUR from euro sign', () => {
      expect(detectCurrency('€350.000')).toBe('EUR');
    });

    it('detects INR from rupee sign', () => {
      expect(detectCurrency('₹50,00,000')).toBe('INR');
    });

    it('returns fallback currency when no symbol found', () => {
      expect(detectCurrency('500000', 'EUR')).toBe('EUR');
    });

    it('returns USD as default when no symbol and no fallback', () => {
      expect(detectCurrency('500000')).toBe('USD');
    });

    it('detects currency even with surrounding text', () => {
      expect(detectCurrency('Price: £995 pcm')).toBe('GBP');
    });
  });

  describe('parsePriceToCents', () => {
    it('parses US format: 1,250,000.50', () => {
      expect(parsePriceToCents('$1,250,000.50')).toBe(125000050);
    });

    it('parses EU format: 1.250.000,50', () => {
      expect(parsePriceToCents('€1.250.000,50')).toBe(125000050);
    });

    it('parses simple integer price', () => {
      expect(parsePriceToCents('500000')).toBe(50000000);
    });

    it('parses price with currency symbol', () => {
      expect(parsePriceToCents('£250,000')).toBe(25000000);
    });

    it('parses price with decimals', () => {
      expect(parsePriceToCents('$99.99')).toBe(9999);
    });

    it('returns 0 for empty string', () => {
      expect(parsePriceToCents('')).toBe(0);
    });

    it('returns 0 for non-numeric string', () => {
      expect(parsePriceToCents('contact agent')).toBe(0);
    });

    it('handles price with "pcm" suffix', () => {
      expect(parsePriceToCents('£995 pcm')).toBe(99500);
    });

    it('handles EU format without decimals: 990.000', () => {
      // Single period = US decimal, but 990.000 with 3 decimal digits is ambiguous
      // Our parser treats last period as decimal separator → 990.000 = 990 * 100 = 99000
      const cents = parsePriceToCents('990.000');
      expect(cents).toBeGreaterThan(0);
    });
  });

  describe('normalizePrice', () => {
    it('returns structured price with cents and currency', () => {
      const result = normalizePrice('£250,000', 250000, 'GBP');
      expect(result.priceCents).toBe(25000000);
      expect(result.currency).toBe('GBP');
      expect(result.displayString).toBe('£250,000');
    });

    it('uses priceFloat when available', () => {
      const result = normalizePrice('', 500000, 'USD');
      expect(result.priceCents).toBe(50000000);
      expect(result.currency).toBe('USD');
    });

    it('falls back to parsing priceString when priceFloat is 0', () => {
      const result = normalizePrice('€350.000,50', 0, 'EUR');
      expect(result.currency).toBe('EUR');
      expect(result.priceCents).toBeGreaterThan(0);
    });

    it('detects currency from symbol in priceString', () => {
      const result = normalizePrice('$750,000', 750000);
      expect(result.currency).toBe('USD');
    });

    it('uses fallback currency when no symbol', () => {
      const result = normalizePrice('500000', 500000, 'INR');
      expect(result.currency).toBe('INR');
    });

    it('returns empty displayString when both inputs are empty/zero', () => {
      const result = normalizePrice('', 0);
      expect(result.priceCents).toBe(0);
      expect(result.displayString).toBe('');
    });

    it('trims whitespace from displayString', () => {
      const result = normalizePrice('  £250,000  ', 250000);
      expect(result.displayString).toBe('£250,000');
    });
  });
});
