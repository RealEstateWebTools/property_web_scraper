/**
 * Detects whether a listing is a sale or rental based on extracted properties and URL patterns.
 * Mirrors the logic in PWB's PropertyImportFromScrapeService#detect_listing_type.
 */

export type ListingType = 'sale' | 'rental';

const RENTAL_URL_PATTERNS = [
  /\/rent\b/i,
  /\/to-rent\b/i,
  /\/for-rent\b/i,
  /\/rental/i,
  /\/alquiler/i,
  /\/location/i,
  /\/miete/i,
  /\/affitto/i,
  /\/arrendamento/i,
  /\/louer/i,
];

/**
 * Infers listing type from extracted boolean properties and source URL.
 *
 * Priority:
 * 1. for_rent_long_term / for_rent_short_term booleans → "rental"
 * 2. for_sale boolean → "sale"
 * 3. URL path patterns (e.g. /rent, /alquiler) → "rental"
 * 4. Default → "sale"
 */
export function detectListingType(
  props: Record<string, unknown>,
  sourceUrl?: string,
): ListingType {
  if (props.for_rent_long_term === true || props.for_rent_short_term === true) {
    return 'rental';
  }

  if (props.for_sale === true) {
    return 'sale';
  }

  if (sourceUrl) {
    try {
      const path = new URL(sourceUrl).pathname;
      for (const pattern of RENTAL_URL_PATTERNS) {
        if (pattern.test(path)) return 'rental';
      }
    } catch {
      // Invalid URL, skip pattern matching
    }
  }

  return 'sale';
}
