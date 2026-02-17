/**
 * Image URL normalization utilities.
 * Inspired by Fredy's normalizeImageUrl pattern.
 *
 * Handles:
 * - Protocol-relative URLs (//cdn.example.com/...)
 * - HTTP → HTTPS enforcement
 * - File extension validation
 * - Thumbnail → full-size URL rewriting
 */

export interface ThumbnailPattern {
  match: string;
  replace: string;
}

export interface ImageNormalizeOptions {
  enforceHttps?: boolean;
  allowedExtensions?: string[];
  thumbnailPatterns?: ThumbnailPattern[];
}

const DEFAULT_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg', 'bmp', 'tiff'];

/**
 * Normalize a single image URL.
 * Returns null if the URL is invalid or has a disallowed extension.
 */
export function normalizeImageUrl(
  url: string,
  options: ImageNormalizeOptions = {},
): string | null {
  if (!url || url.trim() === '') return null;

  let normalized = url.trim();

  // Handle protocol-relative URLs
  if (normalized.startsWith('//')) {
    normalized = `https:${normalized}`;
  }

  // Enforce HTTPS
  if (options.enforceHttps !== false && normalized.startsWith('http://')) {
    normalized = normalized.replace(/^http:/, 'https:');
  }

  // Parse to validate
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return null;
  }

  // Only allow http(s)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null;
  }

  // Validate extension (if pathname has one)
  const allowedExts = options.allowedExtensions || DEFAULT_EXTENSIONS;
  const pathname = parsed.pathname.toLowerCase();
  const lastDot = pathname.lastIndexOf('.');
  if (lastDot !== -1) {
    const ext = pathname.slice(lastDot + 1).split('?')[0];
    if (ext && !allowedExts.includes(ext)) {
      return null;
    }
  }

  // Apply thumbnail → full-size replacements
  if (options.thumbnailPatterns) {
    for (const pattern of options.thumbnailPatterns) {
      normalized = normalized.replace(pattern.match, pattern.replace);
    }
  }

  return normalized;
}

/**
 * Normalize an array of image URLs, filtering out invalid ones.
 */
export function normalizeImageUrls(
  urls: string[],
  options: ImageNormalizeOptions = {},
): string[] {
  return urls
    .map((url) => normalizeImageUrl(url, options))
    .filter((url): url is string => url !== null);
}
