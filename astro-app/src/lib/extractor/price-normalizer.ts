export interface NormalizedPrice {
  priceCents: number;
  currency: string;
  displayString: string;
}

export const CURRENCY_SYMBOLS: Record<string, string> = {
  '$': 'USD',
  '\u00a3': 'GBP',
  '\u20ac': 'EUR',
  '\u20b9': 'INR',
};

/**
 * Detect currency from a price string by symbol, with optional fallback.
 */
export function detectCurrency(priceString: string, fallbackCurrency?: string): string {
  for (const [symbol, code] of Object.entries(CURRENCY_SYMBOLS)) {
    if (priceString.includes(symbol)) {
      return code;
    }
  }
  return fallbackCurrency || 'USD';
}

/**
 * Parse a price string to cents, handling locale-aware formatting.
 * EU: 1.250.000,50 → periods as thousands, comma as decimal
 * US: 1,250,000.50 → commas as thousands, period as decimal
 */
export function parsePriceToCents(priceString: string): number {
  // Strip currency symbols and whitespace
  let cleaned = priceString.replace(/[$\u00a3\u20ac\u20b9]/g, '').trim();

  // Detect format by looking at last separator
  const lastComma = cleaned.lastIndexOf(',');
  const lastPeriod = cleaned.lastIndexOf('.');

  let normalized: string;

  if (lastComma > lastPeriod) {
    // EU format: 1.250.000,50 — comma is decimal separator
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (lastPeriod > lastComma) {
    // US format: 1,250,000.50 — period is decimal separator
    normalized = cleaned.replace(/,/g, '');
  } else {
    // No mixed separators — just strip commas
    normalized = cleaned.replace(/,/g, '');
  }

  // Remove any remaining non-numeric chars except period
  normalized = normalized.replace(/[^\d.]/g, '');

  const value = parseFloat(normalized);
  if (isNaN(value)) return 0;
  return Math.round(value * 100);
}

/**
 * Normalize a price into structured form with cents and currency.
 */
export function normalizePrice(
  priceString: string,
  priceFloat: number,
  fallbackCurrency?: string,
): NormalizedPrice {
  const currency = detectCurrency(priceString, fallbackCurrency);

  let priceCents: number;
  if (priceFloat > 0) {
    // Use the already-parsed float if available
    priceCents = Math.round(priceFloat * 100);
  } else {
    priceCents = parsePriceToCents(priceString);
  }

  const displayString = priceString.trim() || formatCents(priceCents, currency);

  return { priceCents, currency, displayString };
}

function formatCents(cents: number, currency: string): string {
  if (cents === 0) return '';
  const value = cents / 100;
  const symbol = Object.entries(CURRENCY_SYMBOLS).find(([, c]) => c === currency)?.[0] || '';
  return `${symbol}${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
