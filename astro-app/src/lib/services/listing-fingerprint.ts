import { createHash } from 'node:crypto';

export interface FingerprintFields {
  title?: string;
  price_float?: number;
  address_string?: string;
  latitude?: number;
  longitude?: number;
}

/**
 * Generate a content-based fingerprint for deduplication.
 * Uses SHA-256 of normalized (title + price + address).
 *
 * Two listings with the same title, price, and address will produce the same
 * fingerprint regardless of which portal they came from.
 *
 * A price change produces a different fingerprint (intentional — the listing
 * has materially changed).
 */
export function computeFingerprint(fields: FingerprintFields): string {
  const parts = [
    (fields.title || '').toLowerCase().trim(),
    String(fields.price_float || 0),
    (fields.address_string || '').toLowerCase().trim(),
  ];
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 16);
}
