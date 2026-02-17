/**
 * Post-extraction filtering.
 * Inspired by Fredy's per-provider blacklist/filter pattern.
 *
 * Allows API consumers to filter extraction results by:
 * - Excluded terms (case-insensitive, checked against title + description)
 * - Price range (min/max)
 * - Minimum bedrooms
 * - Required fields (reject if any are missing)
 */

export interface ExtractionFilter {
  excludeTerms?: string[];
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  requiredFields?: string[];
}

export interface FilterResult {
  passed: boolean;
  reasons: string[];
}

/**
 * Check whether extracted properties pass the given filters.
 * Returns { passed: true } if all filters pass, or { passed: false, reasons }
 * listing which filters failed.
 */
export function applyFilters(
  properties: Record<string, unknown>,
  filters: ExtractionFilter,
): FilterResult {
  const reasons: string[] = [];

  // Exclude terms — case-insensitive match against title and description
  if (filters.excludeTerms && filters.excludeTerms.length > 0) {
    const title = String(properties.title || '').toLowerCase();
    const description = String(properties.description || '').toLowerCase();
    const combined = `${title} ${description}`;
    for (const term of filters.excludeTerms) {
      if (combined.includes(term.toLowerCase())) {
        reasons.push(`excludeTerm matched: "${term}"`);
      }
    }
  }

  // Price range
  const price = typeof properties.price_float === 'number' ? properties.price_float : 0;
  if (filters.minPrice != null && price > 0 && price < filters.minPrice) {
    reasons.push(`price ${price} below minimum ${filters.minPrice}`);
  }
  if (filters.maxPrice != null && price > 0 && price > filters.maxPrice) {
    reasons.push(`price ${price} above maximum ${filters.maxPrice}`);
  }

  // Minimum bedrooms
  if (filters.minBedrooms != null) {
    const bedrooms = typeof properties.count_bedrooms === 'number' ? properties.count_bedrooms : 0;
    if (bedrooms < filters.minBedrooms) {
      reasons.push(`bedrooms ${bedrooms} below minimum ${filters.minBedrooms}`);
    }
  }

  // Required fields
  if (filters.requiredFields) {
    for (const field of filters.requiredFields) {
      const value = properties[field];
      const isEmpty = value === undefined || value === null || value === '' || value === 0;
      if (isEmpty) {
        reasons.push(`required field missing: ${field}`);
      }
    }
  }

  return { passed: reasons.length === 0, reasons };
}
