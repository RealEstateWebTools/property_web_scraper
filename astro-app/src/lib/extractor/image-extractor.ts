import type { CheerioAPI, Cheerio, AnyNode } from 'cheerio';
import type { FieldMapping } from './mapping-loader.js';
import { getTextFromCss, cleanUpString } from './strategies.js';

/**
 * Extract an array of image URLs from HTML.
 * Port of Ruby retrieve_images_array.
 */
export function extractImages(
  $: CheerioAPI,
  html: string,
  mapping: FieldMapping,
  uri: URL
): string[] {
  const retrieved: string[] = [];

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

  // Clean up all results
  return retrieved.map((s) => cleanUpString(s, mapping));
}
