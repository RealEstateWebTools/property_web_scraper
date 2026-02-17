import sanitizeHtml from 'sanitize-html';

/**
 * Strip all HTML tags, leaving only text.
 * Equivalent to Rails::HTML::FullSanitizer.
 */
export function stripTags(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).trim();
}

/**
 * Boolean evaluator map.
 * Replaces Ruby's dynamic `.send(evaluator, param)` with a safe lookup.
 */
export const booleanEvaluators: Record<string, (text: string, param: string) => boolean> = {
  'include?': (text, param) => text.includes(param),
  'start_with?': (text, param) => text.startsWith(param),
  'end_with?': (text, param) => text.endsWith(param),
  'present?': (text, _param) => text != null && text.trim() !== '',
  'to_i_gt_0': (text, _param) => parseInt(text, 10) > 0,
  '==': (text, param) => text === param,
};

const TEXT_FIELDS = new Set([
  'title', 'description', 'reference', 'price_string', 'currency',
  'address_string', 'street_address', 'street_number', 'street_name',
  'city', 'province', 'region', 'country', 'postal_code', 'locale_code', 'area_unit',
  'title_es', 'description_es', 'title_de', 'description_de',
  'title_fr', 'description_fr', 'title_it', 'description_it',
]);

const URL_FIELDS = new Set(['main_image_url']);
const URL_ARRAY_FIELDS = new Set(['related_urls']);
const SAFE_SCHEMES = new Set(['http:', 'https:']);

/**
 * Sanitize a URL string.
 * Port of Ruby ScrapedContentSanitizer.sanitize_url.
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
    if (!SAFE_SCHEMES.has(parsed.protocol)) return null;
    return stripped;
  } catch {
    return null;
  }
}

/**
 * Sanitize all fields in a property hash.
 * Port of Ruby ScrapedContentSanitizer.call.
 */
export function sanitizePropertyHash(hash: Record<string, unknown>): Record<string, unknown> {
  for (const field of TEXT_FIELDS) {
    const value = hash[field];
    if (typeof value === 'string') {
      hash[field] = stripTags(value).trim();
    }
  }

  for (const field of URL_FIELDS) {
    const value = hash[field];
    if (typeof value === 'string') {
      hash[field] = sanitizeUrl(value);
    }
  }

  for (const field of URL_ARRAY_FIELDS) {
    const value = hash[field];
    if (Array.isArray(value)) {
      hash[field] = value
        .filter((url): url is string => typeof url === 'string')
        .map(sanitizeUrl)
        .filter((url): url is string => url !== null);
    }
  }

  // Sanitize image_urls (array of ImageInfo objects)
  if (Array.isArray(hash['image_urls'])) {
    hash['image_urls'] = (hash['image_urls'] as Array<{ url: string }>)
      .map((img) => {
        const sanitized = sanitizeUrl(img.url);
        return sanitized ? { ...img, url: sanitized } : null;
      })
      .filter((img): img is { url: string } => img !== null);
  }

  if (Array.isArray(hash['features'])) {
    hash['features'] = (hash['features'] as unknown[]).map((f) =>
      typeof f === 'string' ? stripTags(f).trim() : f
    );
  }

  return hash;
}
