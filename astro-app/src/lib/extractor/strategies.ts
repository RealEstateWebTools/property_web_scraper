import * as cheerio from 'cheerio';
import type { FieldMapping } from './mapping-loader.js';
import { parseFlightData, searchFlightData } from './flight-data-parser.js';

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
 * Per-HTML cache for parsed flight data.
 * Keyed by the Cheerio instance to avoid re-parsing for every field.
 */
const flightDataCache = new WeakMap<cheerio.CheerioAPI, Record<string, unknown>>();

function getOrParseFlightData($: cheerio.CheerioAPI, html: string): Record<string, unknown> {
  let cached = flightDataCache.get($);
  if (!cached) {
    cached = parseFlightData(html);
    flightDataCache.set($, cached);
  }
  return cached;
}

/**
 * Per-HTML cache for parsed script JSON variables (e.g. window.PAGE_MODEL).
 * Keyed by Cheerio instance + variable name.
 */
const scriptJsonCache = new WeakMap<cheerio.CheerioAPI, Map<string, unknown>>();

/**
 * Extract and parse a JSON object assigned to a named variable in a script tag.
 * Handles patterns like: `window.VAR = {...}` or `var VAR = {...}`
 */
function getOrParseScriptJson($: cheerio.CheerioAPI, varName: string): unknown {
  let cacheMap = scriptJsonCache.get($);
  if (!cacheMap) {
    cacheMap = new Map();
    scriptJsonCache.set($, cacheMap);
  }
  if (cacheMap.has(varName)) {
    return cacheMap.get(varName);
  }

  let result: unknown = undefined;
  const pattern = new RegExp(`(?:window\\.)?${varName}\\s*=\\s*`);

  $('script').each((_i, el) => {
    if (result !== undefined) return;
    const text = $(el).html() || '';
    const match = pattern.exec(text);
    if (!match) return;

    const jsonStart = match.index + match[0].length;
    // Find the JSON by counting braces
    let depth = 0;
    let inString = false;
    let escaped = false;
    let end = jsonStart;

    for (let i = jsonStart; i < text.length; i++) {
      const ch = text[i];
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{' || ch === '[') depth++;
      if (ch === '}' || ch === ']') {
        depth--;
        if (depth === 0) { end = i + 1; break; }
      }
    }

    if (end > jsonStart) {
      try {
        result = JSON.parse(text.slice(jsonStart, end));
      } catch {
        // malformed JSON
      }
    }
  });

  cacheMap.set(varName, result);
  return result;
}

/**
 * Navigate a dot-path into a parsed object.
 */
function getByDotPath(obj: unknown, dotPath: string): unknown {
  let current = obj;
  for (const seg of dotPath.split('.')) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[seg];
  }
  return current;
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

  // Flight data path strategy (Next.js RSC data)
  if (mapping.flightDataPath) {
    const flightData = getOrParseFlightData($, html);
    const value = searchFlightData(flightData, mapping.flightDataPath);
    if (value !== undefined) retrievedText = String(value);
  }

  // Script JSON path strategy (e.g. window.PAGE_MODEL)
  if (mapping.scriptJsonPath && mapping.scriptJsonVar) {
    const parsed = getOrParseScriptJson($, mapping.scriptJsonVar);
    const value = getByDotPath(parsed, mapping.scriptJsonPath);
    if (value !== undefined) retrievedText = String(value);
  }

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
