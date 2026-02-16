const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'ref', 'source', 'channel',
]);

/**
 * Normalize a URL by lowercasing the host, removing tracking params and fragments,
 * and optionally stripping the trailing slash.
 */
export function canonicalizeUrl(url: string, stripTrailingSlash = false): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  // Normalize protocol to https
  parsed.protocol = 'https:';

  // Lowercase host
  parsed.hostname = parsed.hostname.toLowerCase();

  // Remove tracking params
  for (const param of Array.from(parsed.searchParams.keys())) {
    if (TRACKING_PARAMS.has(param)) {
      parsed.searchParams.delete(param);
    }
  }

  // Remove fragment
  parsed.hash = '';

  let result = parsed.toString();

  // Strip trailing slash (but not root path)
  if (stripTrailingSlash && result.endsWith('/') && parsed.pathname !== '/') {
    result = result.slice(0, -1);
  }

  return result;
}

/**
 * Generate a deduplication key from a URL: hostname + pathname only.
 */
export function deduplicationKey(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.toLowerCase() + parsed.pathname;
  } catch {
    return url;
  }
}
