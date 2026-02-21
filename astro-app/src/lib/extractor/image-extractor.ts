import type { CheerioAPI, Cheerio, AnyNode } from 'cheerio';
import type { FieldMapping } from './mapping-loader.js';
import { getTextFromCss, cleanUpString, getOrParseScriptJson, getByDotPath } from './strategies.js';
import { normalizeImageUrl } from './image-normalizer.js';
import type { ImageInfo } from '../types/image-info.js';

/**
 * Extract an array of image objects from HTML.
 * Port of Ruby retrieve_images_array.
 */
export function extractImages(
  $: CheerioAPI,
  html: string,
  mapping: FieldMapping,
  uri: URL
): ImageInfo[] {
  const retrieved: string[] = [];

  // Script JSON path strategy — extract image URLs from embedded JSON
  if (mapping.scriptJsonPath && mapping.scriptJsonVar) {
    const parsed = getOrParseScriptJson($, mapping.scriptJsonVar);
    const value = getByDotPath(parsed, mapping.scriptJsonPath);
    if (Array.isArray(value)) {
      const attrKey = mapping.cssAttr || mapping.xmlAttr || 'url';
      const usesDotPath = attrKey.includes('.');
      for (const item of value) {
        if (typeof item === 'string') {
          retrieved.push(item);
        } else if (typeof item === 'object' && item !== null) {
          // Support dot-path traversal (e.g. "urls.large") for nested structures
          const resolved = usesDotPath
            ? getByDotPath(item, attrKey)
            : (item as Record<string, unknown>)[attrKey];
          if (resolved !== undefined && resolved !== null) {
            retrieved.push(String(resolved));
          }
        }
      }
    }
  }

  // CSS selector path
  if (mapping.cssLocator) {
    const elements = $(mapping.cssLocator);
    elements.each((_i, el) => {
      const $el = $(el);
      let imgUrl = getTextFromCss($, $el, mapping);

      // Ensure URL is absolute
      try {
        const imgUri = new URL(imgUrl, uri.href);
        // If the original didn't have a host, it was relative
        if (!imgUrl.match(/^https?:\/\//)) {
          if (mapping.imagePathPrefix) {
            imgUri.pathname = mapping.imagePathPrefix + imgUri.pathname;
          }
        }
        imgUrl = imgUri.href;
      } catch {
        // If URL parsing fails, keep the original
      }

      retrieved.push(imgUrl);
    });
  }

  // XPath path (no longer supported — all mappings converted to CSS)
  if (mapping.xpath) {
    console.warn(`[ImageExtractor] XPath is no longer supported, skipping: ${mapping.xpath}`);
  }

  // Clean up all results, normalize URLs, wrap as ImageInfo objects
  return retrieved
    .map((s) => cleanUpString(s, mapping))
    .map((url) => normalizeImageUrl(url, {
      enforceHttps: true,
      thumbnailPatterns: mapping.thumbnailPatterns,
    }))
    .filter((url): url is string => url !== null)
    .map((url) => ({ url }));
}
