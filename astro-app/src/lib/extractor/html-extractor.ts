import * as cheerio from 'cheerio';
import type { ScraperMapping, FieldMapping } from './mapping-loader.js';
import { findByName } from './mapping-loader.js';
import { retrieveTargetText } from './strategies.js';
import { extractImages } from './image-extractor.js';
import { extractFeatures } from './feature-extractor.js';
import { booleanEvaluators } from './field-processors.js';
import { assessQuality, type QualityGrade, type QualityAssessment } from './quality-scorer.js';

export interface FieldTrace {
  field: string;
  section: string;
  strategy: string;
  rawText: string;
  value: unknown;
}

export interface ExtractionDiagnostics {
  scraperName: string;
  fieldTraces: FieldTrace[];
  totalFields: number;
  populatedFields: number;
  emptyFields: string[];
  extractableFields: number;
  populatedExtractableFields: number;
  extractionRate: number;
  qualityGrade: QualityGrade;
  qualityLabel: string;
  expectedExtractionRate?: number;
  meetsExpectation: boolean;
}

export interface ExtractionResult {
  success: boolean;
  properties: Record<string, unknown>[];
  errorMessage?: string;
  diagnostics?: ExtractionDiagnostics;
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

function describeStrategy(m: FieldMapping): string {
  if (m.flightDataPath) return `flightDataPath:${m.flightDataPath}`;
  if (m.jsonLdPath) return `jsonLdPath:${m.jsonLdPath}`;
  if (m.scriptJsonPath && m.scriptJsonVar) return `scriptJsonPath:${m.scriptJsonVar}.${m.scriptJsonPath}`;
  if (m.scriptRegEx) return `scriptRegEx:${m.scriptRegEx.slice(0, 40)}`;
  if (m.urlPathPart) return `urlPathPart:${m.urlPathPart}`;
  if (m.cssLocator) return `cssLocator:${m.cssLocator}`;
  if (m.value) return `default:${m.value}`;
  return 'none';
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
  const traces: FieldTrace[] = [];

  // Default values
  if (mapping.defaultValues) {
    for (const [key, fieldMapping] of Object.entries(mapping.defaultValues)) {
      propertyHash[key] = fieldMapping.value;
      traces.push({
        field: key,
        section: 'defaultValues',
        strategy: describeStrategy(fieldMapping),
        rawText: fieldMapping.value || '',
        value: propertyHash[key],
      });
    }
  }

  // Images
  if (mapping.images) {
    for (const imageMapping of mapping.images) {
      propertyHash['image_urls'] = extractImages($, html, imageMapping, uri);
      const urls = propertyHash['image_urls'] as string[];
      traces.push({
        field: 'image_urls',
        section: 'images',
        strategy: describeStrategy(imageMapping),
        rawText: urls.length > 0 ? `${urls.length} images` : '',
        value: urls,
      });
    }
  }

  // Features
  if (mapping.features) {
    for (const featureMapping of mapping.features) {
      propertyHash['features'] = extractFeatures($, featureMapping, uri);
      const feats = propertyHash['features'] as string[];
      traces.push({
        field: 'features',
        section: 'features',
        strategy: describeStrategy(featureMapping),
        rawText: feats.length > 0 ? `${feats.length} features` : '',
        value: feats,
      });
    }
  }

  // Int fields
  if (mapping.intFields) {
    for (const [key, fieldMapping] of Object.entries(mapping.intFields)) {
      const text = retrieveTargetText($, html, fieldMapping, uri);
      propertyHash[key] = parseInt(text.trim(), 10) || 0;
      traces.push({
        field: key,
        section: 'intFields',
        strategy: describeStrategy(fieldMapping),
        rawText: text.slice(0, 120),
        value: propertyHash[key],
      });
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
      traces.push({
        field: key,
        section: 'floatFields',
        strategy: describeStrategy(fieldMapping),
        rawText: text.slice(0, 120),
        value: propertyHash[key],
      });
    }
  }

  // Text fields
  if (mapping.textFields) {
    for (const [key, fieldMapping] of Object.entries(mapping.textFields)) {
      const text = retrieveTargetText($, html, fieldMapping, uri);
      propertyHash[key] = text.trim();
      traces.push({
        field: key,
        section: 'textFields',
        strategy: describeStrategy(fieldMapping),
        rawText: text.slice(0, 120),
        value: propertyHash[key],
      });
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
      traces.push({
        field: key,
        section: 'booleanFields',
        strategy: describeStrategy(fieldMapping),
        rawText: text.slice(0, 120),
        value: propertyHash[key],
      });
    }
  }

  const emptyFields = traces
    .filter(t => t.rawText === '' || t.value === 0 || t.value === false || t.value === '')
    .map(t => t.field);

  // Quality scoring: exclude defaultValues to measure actual extraction success
  const extractableTraces = traces.filter(t => t.section !== 'defaultValues');
  const populatedExtractable = extractableTraces.filter(
    t => t.rawText !== '' && t.value !== 0 && t.value !== false && t.value !== ''
  );
  const extractableFields = extractableTraces.length;
  const populatedExtractableFields = populatedExtractable.length;
  const extractionRate = extractableFields > 0 ? populatedExtractableFields / extractableFields : 0;
  const quality: QualityAssessment = assessQuality(extractionRate, mapping.expectedExtractionRate);

  const diagnostics: ExtractionDiagnostics = {
    scraperName: mapping.name,
    fieldTraces: traces,
    totalFields: traces.length,
    populatedFields: traces.length - emptyFields.length,
    emptyFields,
    extractableFields,
    populatedExtractableFields,
    extractionRate,
    qualityGrade: quality.grade,
    qualityLabel: quality.label,
    expectedExtractionRate: mapping.expectedExtractionRate,
    meetsExpectation: quality.meetsExpectation,
  };

  console.log(`[Extractor] ${mapping.name}: Grade ${quality.grade} (${quality.label}) — ${populatedExtractableFields}/${extractableFields} extractable fields (${Math.round(extractionRate * 100)}%)`);
  if (emptyFields.length > 0) {
    console.log(`[Extractor] Empty fields: ${emptyFields.join(', ')}`);
  }
  for (const t of traces) {
    const status = t.rawText ? '\u2713' : '\u2717';
    console.log(`[Extractor]   ${status} ${t.field} (${t.strategy}) \u2192 ${JSON.stringify(t.value)}`);
  }

  return { success: true, properties: [propertyHash], diagnostics };
}
