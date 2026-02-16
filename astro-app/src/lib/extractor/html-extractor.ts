import * as cheerio from 'cheerio';
import type { ScraperMapping, FieldMapping } from './mapping-loader.js';
import { findByName } from './mapping-loader.js';
import { retrieveTargetText } from './strategies.js';
import { extractImages } from './image-extractor.js';
import { extractFeatures } from './feature-extractor.js';
import { booleanEvaluators } from './field-processors.js';

export interface ExtractionResult {
  success: boolean;
  properties: Record<string, unknown>[];
  errorMessage?: string;
}

export interface ExtractParams {
  html: string;
  sourceUrl: string;
  scraperMappingName?: string;
  scraperMapping?: ScraperMapping;
}

/**
 * Resolves the scraper mapping to use.
 * Port of Ruby HtmlExtractor#resolve_mapping.
 */
function resolveMapping(
  mapping?: ScraperMapping,
  name?: string,
  _host?: string
): ScraperMapping {
  if (mapping) return mapping;
  if (name) {
    const found = findByName(name);
    if (!found) throw new Error(`Unknown scraper mapping: ${name}`);
    return found;
  }
  throw new Error('No scraper mapping provided and auto-detection not implemented in PoC');
}

/**
 * Main entry point: extract structured property data from raw HTML.
 * Port of Ruby HtmlExtractor.call.
 *
 * Pure function with zero network I/O.
 */
export function extractFromHtml(params: ExtractParams): ExtractionResult {
  const { html, sourceUrl, scraperMappingName, scraperMapping: providedMapping } = params;

  let mapping: ScraperMapping;
  try {
    mapping = resolveMapping(providedMapping, scraperMappingName);
  } catch (err: unknown) {
    return {
      success: false,
      properties: [],
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }

  const $ = cheerio.load(html);
  const uri = new URL(sourceUrl);
  const propertyHash: Record<string, unknown> = {};

  // Default values
  if (mapping.defaultValues) {
    for (const [key, fieldMapping] of Object.entries(mapping.defaultValues)) {
      propertyHash[key] = fieldMapping.value;
    }
  }

  // Images
  if (mapping.images) {
    for (const imageMapping of mapping.images) {
      propertyHash['image_urls'] = extractImages($, html, imageMapping, uri);
    }
  }

  // Features
  if (mapping.features) {
    for (const featureMapping of mapping.features) {
      propertyHash['features'] = extractFeatures($, featureMapping, uri);
    }
  }

  // Int fields
  if (mapping.intFields) {
    for (const [key, fieldMapping] of Object.entries(mapping.intFields)) {
      const text = retrieveTargetText($, html, fieldMapping, uri);
      propertyHash[key] = parseInt(text.trim(), 10) || 0;
    }
  }

  // Float fields
  if (mapping.floatFields) {
    for (const [key, fieldMapping] of Object.entries(mapping.floatFields)) {
      let text = retrieveTargetText($, html, fieldMapping, uri);
      if (fieldMapping.stripPunct) {
        text = text.replace(/\./g, '').replace(/,/g, '');
      }
      if (fieldMapping.stripFirstChar) {
        text = text.trim().slice(1) || '';
      }
      propertyHash[key] = parseFloat(text.trim()) || 0;
    }
  }

  // Text fields
  if (mapping.textFields) {
    for (const [key, fieldMapping] of Object.entries(mapping.textFields)) {
      const text = retrieveTargetText($, html, fieldMapping, uri);
      propertyHash[key] = text.trim();
    }
  }

  // Boolean fields
  if (mapping.booleanFields) {
    for (const [key, fieldMapping] of Object.entries(mapping.booleanFields)) {
      let text = retrieveTargetText($, html, fieldMapping, uri);
      let evaluatorParam = fieldMapping.evaluatorParam || '';

      if (fieldMapping.caseInsensitive) {
        text = text.toLowerCase();
        evaluatorParam = evaluatorParam.toLowerCase();
      }

      const evaluatorFn = fieldMapping.evaluator
        ? booleanEvaluators[fieldMapping.evaluator]
        : undefined;

      propertyHash[key] = evaluatorFn
        ? evaluatorFn(text.trim(), evaluatorParam)
        : false;
    }
  }

  return { success: true, properties: [propertyHash] };
}
