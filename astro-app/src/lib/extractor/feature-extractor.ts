import type { CheerioAPI } from 'cheerio';
import type { FieldMapping } from './mapping-loader.js';
import { getTextFromCss, cleanUpString } from './strategies.js';

/**
 * Extract an array of feature strings from HTML.
 * Port of Ruby retrieve_features_array.
 */
export function extractFeatures(
  $: CheerioAPI,
  mapping: FieldMapping,
  _uri: URL
): string[] {
  const retrieved: string[] = [];

  if (mapping.cssLocator) {
    const elements = $(mapping.cssLocator);
    elements.each((_i, el) => {
      const $el = $(el);
      const featureText = getTextFromCss($, $el, mapping);
      retrieved.push(featureText);
    });
  }

  // Clean up all results
  return retrieved.map((s) => cleanUpString(s, mapping));
}
