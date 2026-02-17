import type { CheerioAPI } from 'cheerio';
import type { FieldMapping } from './mapping-loader.js';
import { getTextFromCss, cleanUpString, getOrParseScriptJson, getByDotPath } from './strategies.js';

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

  // Script JSON path strategy — extract features from embedded JSON
  if (mapping.scriptJsonPath && mapping.scriptJsonVar) {
    const parsed = getOrParseScriptJson($, mapping.scriptJsonVar);
    const value = getByDotPath(parsed, mapping.scriptJsonPath);
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') {
          retrieved.push(item);
        }
      }
    }
  }

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
