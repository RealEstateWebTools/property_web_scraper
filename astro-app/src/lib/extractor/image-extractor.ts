import type { CheerioAPI, Cheerio, AnyNode } from 'cheerio';
import type { FieldMapping } from './mapping-loader.js';
import { getTextFromCss, cleanUpString, evaluateXPath } from './strategies.js';

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

  // XPath path
  if (mapping.xpath) {
    const xpathTexts = evaluateXPathMultiple(html, mapping.xpath);
    retrieved.push(...xpathTexts);
  }

  // Clean up all results
  return retrieved.map((s) => cleanUpString(s, mapping));
}

/**
 * Evaluate XPath and return all matching text values.
 */
function evaluateXPathMultiple(html: string, xpathExpr: string): string[] {
  // Use JSDOM for XPath evaluation
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM(html, { contentType: 'text/html' });
  const doc = dom.window.document;

  const result = doc.evaluate(
    xpathExpr,
    doc,
    null,
    dom.window.XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
    null
  );

  const texts: string[] = [];
  for (let i = 0; i < result.snapshotLength; i++) {
    const node = result.snapshotItem(i);
    if (node) {
      texts.push(node.nodeValue || node.textContent || '');
    }
  }
  return texts;
}
