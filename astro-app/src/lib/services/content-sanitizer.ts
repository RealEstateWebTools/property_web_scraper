/**
 * Content sanitizer for scraped property data.
 * Strips HTML tags from text fields, rejects dangerous URL schemes,
 * and filters invalid URLs from arrays.
 *
 * Applied as a post-processing step after extraction to prevent
 * XSS and other injection attacks in stored/displayed data.
 */
import sanitizeHtml from 'sanitize-html';

const TEXT_FIELDS = [
  'title', 'description', 'reference', 'price_string', 'currency',
  'address_string', 'street_address', 'street_number', 'street_name',
  'city', 'province', 'region', 'country', 'postal_code', 'locale_code',
  'area_unit', 'property_type', 'energy_rating',
];

/** Fields that may contain intentional HTML but must be sanitized to safe tags only. */
const HTML_FIELDS = ['description_html'];

/** Allowlist for HTML fields — only safe formatting tags, no scripts/events. */
const SAFE_HTML_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'div', 'a'],
  allowedAttributes: {
    'a': ['href', 'target', 'rel'],
  },
  allowedSchemes: ['http', 'https'],
};

const URL_FIELDS = ['main_image_url'];
const URL_ARRAY_FIELDS = ['related_urls'];
const SAFE_SCHEMES = ['http:', 'https:'];

/**
 * Decode common HTML entities back to their character equivalents.
 * sanitize-html encodes & as &amp;, etc. when stripping tags.
 */
function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#039;/g, "'");
}

/** Strip all HTML tags and decode entities */
function stripHtml(text: string): string {
  return decodeEntities(
    sanitizeHtml(text, {
      allowedTags: [],
      allowedAttributes: {},
    }).trim()
  );
}

/**
 * Sanitize a single URL string.
 * Rejects dangerous schemes (javascript:, data:, etc.)
 * Fixes protocol-relative URLs (//example.com → https://example.com)
 */
function sanitizeUrl(url: string): string | null {
  if (!url || url.trim() === '') return null;

  let stripped = url.trim();

  // Fix protocol-relative URLs
  if (stripped.startsWith('//')) {
    stripped = `https:${stripped}`;
  }

  try {
    const parsed = new URL(stripped);
    if (!SAFE_SCHEMES.includes(parsed.protocol)) {
      return null;
    }
    return stripped;
  } catch {
    return null;
  }
}

/**
 * Sanitize scraped property data before persistence.
 * Strips HTML tags from text fields, rejects dangerous URLs,
 * and filters invalid URLs from arrays.
 */
export function sanitizePropertyHash(
  propertyHash: Record<string, unknown>
): Record<string, unknown> {
  const sanitized = { ...propertyHash };

  // Sanitize text fields — strip all HTML, decode entities
  for (const field of TEXT_FIELDS) {
    const value = sanitized[field];
    if (typeof value === 'string') {
      sanitized[field] = stripHtml(value);
    }
  }

  // Sanitize HTML fields — allow safe formatting tags only (no scripts/events)
  for (const field of HTML_FIELDS) {
    const value = sanitized[field];
    if (typeof value === 'string') {
      sanitized[field] = sanitizeHtml(value, SAFE_HTML_OPTIONS);
    }
  }

  // Sanitize URL fields
  for (const field of URL_FIELDS) {
    const value = sanitized[field];
    if (typeof value === 'string') {
      sanitized[field] = sanitizeUrl(value) ?? '';
    }
  }

  // Sanitize URL array fields
  for (const field of URL_ARRAY_FIELDS) {
    const value = sanitized[field];
    if (Array.isArray(value)) {
      sanitized[field] = value
        .filter((url): url is string => typeof url === 'string')
        .map(sanitizeUrl)
        .filter((url): url is string => url !== null);
    }
  }

  // Sanitize image_urls (array of ImageInfo objects)
  if (Array.isArray(sanitized.image_urls)) {
    sanitized.image_urls = (sanitized.image_urls as Array<{ url: string }>)
      .map((img) => {
        const cleaned = sanitizeUrl(img.url);
        return cleaned ? { ...img, url: cleaned } : null;
      })
      .filter((img): img is { url: string } => img !== null);
  }

  // Sanitize features array
  if (Array.isArray(sanitized.features)) {
    sanitized.features = (sanitized.features as unknown[]).map((feature) => {
      if (typeof feature === 'string') {
        return stripHtml(feature);
      }
      return feature;
    });
  }

  return sanitized;
}
