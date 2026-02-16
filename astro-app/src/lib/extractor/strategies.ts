import * as cheerio from 'cheerio';
import type { FieldMapping } from './mapping-loader.js';

/**
 * Extract text using a CSS selector (Cheerio).
 * Port of Ruby get_text_from_css.
 */
export function getTextFromCss(
  $: cheerio.CheerioAPI,
  elements: cheerio.Cheerio<cheerio.AnyNode>,
  mapping: FieldMapping
): string {
  let text = elements.text();

  if (mapping.cssAttr) {
    const attrVal = elements.attr(mapping.cssAttr);
    if (attrVal) text = attrVal;
  } else if (mapping.xmlAttr) {
    const attrVal = elements.attr(mapping.xmlAttr);
    if (attrVal) text = attrVal;
  }

  if (mapping.cssCountId != null) {
    try {
      const idx = parseInt(mapping.cssCountId, 10);
      const el = elements.eq(idx);
      text = el.text() || '';
    } catch {
      // ignore errors, keep current text
    }
  }

  return text;
}

/**
 * Extract text from URL path.
 * Port of Ruby get_text_from_url.
 */
export function getTextFromUrl(urlPathPart: string, uri: URL): string {
  let text = uri.pathname;
  const partNum = parseInt(urlPathPart, 10);
  if (partNum > 0) {
    const segments = uri.pathname.split('/');
    text = segments[partNum] || '';
  }
  return text;
}

/**
 * Main text retrieval combining all strategies.
 * Port of Ruby retrieve_target_text.
 */
export function retrieveTargetText(
  $: cheerio.CheerioAPI,
  html: string,
  mapping: FieldMapping,
  uri: URL
): string {
  let retrievedText = '';

  // Regex strategy on <script> contents
  if (mapping.scriptRegEx) {
    const regex = new RegExp(mapping.scriptRegEx);
    const scriptText = $('script').text();
    const match = scriptText.match(regex);
    retrievedText = match ? match[0] : '';
  }

  // URL-path strategy
  if (mapping.urlPathPart) {
    retrievedText = getTextFromUrl(mapping.urlPathPart, uri);
  }

  // CSS selector strategy
  if (mapping.cssLocator) {
    const elements = $(mapping.cssLocator);
    retrievedText = getTextFromCss($, elements, mapping);
  }

  // XPath strategy (no longer supported — all mappings converted to CSS)
  if (mapping.xpath) {
    console.warn(`[Extractor] XPath is no longer supported, skipping: ${mapping.xpath}`);
  }

  // Post-processing
  retrievedText = cleanUpString(retrievedText, mapping);

  return retrievedText;
}

/**
 * Post-processing of extracted strings.
 * Port of Ruby clean_up_string.
 */
export function cleanUpString(str: string, mapping: FieldMapping): string {
  let result = str;

  if (mapping.splitTextCharacter != null) {
    try {
      const splitChar = mapping.splitTextCharacter || ' ';
      const splitIdx = parseInt(mapping.splitTextArrayId || '0', 10);
      const parts = result.split(splitChar);
      result = parts[splitIdx] || '';
    } catch {
      // ignore errors
    }
  }

  if (mapping.stripString) {
    result = result.replace(mapping.stripString, '');
  }

  return result;
}
