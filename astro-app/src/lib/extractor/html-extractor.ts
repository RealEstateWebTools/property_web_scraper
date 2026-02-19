import * as cheerio from 'cheerio';
import type { ScraperMapping, FieldMapping } from './mapping-loader.js';
import { findByName } from './mapping-loader.js';
import { retrieveTargetText } from './strategies.js';
import { extractImages } from './image-extractor.js';
import { extractFeatures } from './feature-extractor.js';
import { booleanEvaluators } from './field-processors.js';
import {
  assessQualityWeighted,
  getFieldImportance,
  type QualityGrade,
  type QualityAssessment,
  type FieldResult,
} from './quality-scorer.js';
import { splitPropertyHash, type SplitSchema } from './schema-splitter.js';
import { computeFingerprint } from '../services/listing-fingerprint.js';
import { sanitizePropertyHash } from '../services/content-sanitizer.js';

export interface FieldTrace {
  field: string;
  section: string;
  strategy: string;
  rawText: string;
  value: unknown;
  fallbackUsed?: number;
}

export interface ContentAnalysis {
  htmlLength: number;
  hasScriptTags: boolean;
  jsonLdCount: number;
  scriptJsonVarsFound: string[];
  appearsBlocked: boolean;
  appearsJsOnly: boolean;
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
  successClassification: 'excellent' | 'good' | 'partial' | 'failed';
  expectedExtractionRate?: number;
  expectedQualityGrade?: QualityGrade;
  meetsExpectation: boolean;
  expectationGap?: number;
  expectationStatus?: 'unknown' | 'above' | 'meets' | 'below' | 'well_below';
  weightedExtractionRate?: number;
  criticalFieldsMissing?: string[];
  contentAnalysis?: ContentAnalysis;
}

export type ExtractionStatus = 'full' | 'partial' | 'blocked' | 'failed';

export interface ExtractionResult {
  success: boolean;
  status: ExtractionStatus;
  properties: Record<string, unknown>[];
  errorMessage?: string;
  warnings: string[];
  diagnostics?: ExtractionDiagnostics;
  splitSchema?: SplitSchema;
  fingerprint?: string;
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

const KNOWN_SCRIPT_VARS = ['PAGE_MODEL', '__NEXT_DATA__', '__INITIAL_STATE__', 'dataLayer'];

/**
 * Analyze content for provenance tracking.
 */
function analyzeContent($: cheerio.CheerioAPI, html: string): ContentAnalysis {
  const scriptTags = $('script');
  const hasScriptTags = scriptTags.length > 0;
  const jsonLdCount = $('script[type="application/ld+json"]').length;

  const scriptJsonVarsFound: string[] = [];
  let scriptText: string | null = null;
  const getScriptText = (): string => {
    if (scriptText === null) {
      scriptText = scriptTags.text();
    }
    return scriptText;
  };
  for (const varName of KNOWN_SCRIPT_VARS) {
    const pattern = new RegExp(`(?:window\\.)?${varName}\\s*=`);
    if (pattern.test(getScriptText()) || $(`script#${varName}`).length > 0) {
      scriptJsonVarsFound.push(varName);
    }
  }

  const bodyText = $('body').text().trim();
  const bodyLength = bodyText.length;
  const divCount = $('div').length;

  // Bot block detection: short body + captcha/verification keywords
  const blockKeywords = /captcha|verify|access denied|cloudflare|just a moment/i;
  const appearsBlocked = bodyLength < 500 && blockKeywords.test(bodyText);

  // JS-only shell detection: short body text + many scripts + few divs
  const appearsJsOnly = bodyLength < 200 && scriptTags.length > 5 && divCount < 10;

  return {
    htmlLength: html.length,
    hasScriptTags,
    jsonLdCount,
    scriptJsonVarsFound,
    appearsBlocked,
    appearsJsOnly,
  };
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
      status: 'failed' as ExtractionStatus,
      properties: [],
      warnings: [],
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }

  const warnings: string[] = [];

  const $ = cheerio.load(html);
  const uri = new URL(sourceUrl);
  const propertyHash: Record<string, unknown> = {};
  const traces: FieldTrace[] = [];

  // Content analysis (provenance tracking)
  const contentAnalysis = analyzeContent($, html);

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
      const images = propertyHash['image_urls'] as Array<{ url: string }>;
      traces.push({
        field: 'image_urls',
        section: 'images',
        strategy: describeStrategy(imageMapping),
        rawText: images.length > 0 ? `${images.length} images` : '',
        value: images,
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
      const result = retrieveTargetText($, html, fieldMapping, uri);
      propertyHash[key] = parseInt(result.text.trim(), 10) || 0;
      traces.push({
        field: key,
        section: 'intFields',
        strategy: result.strategyDescription,
        rawText: result.text.slice(0, 120),
        value: propertyHash[key],
        fallbackUsed: result.strategyIndex > 0 ? result.strategyIndex : undefined,
      });
    }
  }

  // Float fields
  if (mapping.floatFields) {
    for (const [key, fieldMapping] of Object.entries(mapping.floatFields)) {
      const result = retrieveTargetText($, html, fieldMapping, uri);
      let text = result.text;
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
        strategy: result.strategyDescription,
        rawText: text.slice(0, 120),
        value: propertyHash[key],
        fallbackUsed: result.strategyIndex > 0 ? result.strategyIndex : undefined,
      });
    }
  }

  // Text fields
  if (mapping.textFields) {
    for (const [key, fieldMapping] of Object.entries(mapping.textFields)) {
      const result = retrieveTargetText($, html, fieldMapping, uri);
      propertyHash[key] = result.text.trim();
      traces.push({
        field: key,
        section: 'textFields',
        strategy: result.strategyDescription,
        rawText: result.text.slice(0, 120),
        value: propertyHash[key],
        fallbackUsed: result.strategyIndex > 0 ? result.strategyIndex : undefined,
      });
    }
  }

  // Boolean fields
  if (mapping.booleanFields) {
    for (const [key, fieldMapping] of Object.entries(mapping.booleanFields)) {
      const result = retrieveTargetText($, html, fieldMapping, uri);
      let text = result.text;
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
        strategy: result.strategyDescription,
        rawText: text.slice(0, 120),
        value: propertyHash[key],
        fallbackUsed: result.strategyIndex > 0 ? result.strategyIndex : undefined,
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

  // Build FieldResult array for weighted scoring
  const fieldResults: FieldResult[] = extractableTraces.map(t => ({
    field: t.field,
    populated: t.rawText !== '' && t.value !== 0 && t.value !== false && t.value !== '',
    importance: getFieldImportance(t.field),
  }));

  const quality: QualityAssessment = assessQualityWeighted(fieldResults, mapping.expectedExtractionRate);

  const successClassification: ExtractionDiagnostics['successClassification'] =
    quality.grade === 'A' ? 'excellent'
      : quality.grade === 'B' ? 'good'
        : quality.grade === 'C' ? 'partial'
          : 'failed';

  // Sanitize extracted data (strip HTML, validate URLs)
  const sanitizedHash = sanitizePropertyHash(propertyHash);

  // Split schema
  const split = splitPropertyHash(sanitizedHash);

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
    successClassification,
    expectedExtractionRate: mapping.expectedExtractionRate,
    expectedQualityGrade: quality.expectedGrade,
    meetsExpectation: quality.meetsExpectation,
    expectationGap: quality.expectationGap,
    expectationStatus: quality.expectationStatus,
    weightedExtractionRate: quality.weightedRate,
    criticalFieldsMissing: quality.criticalFieldsMissing,
    contentAnalysis,
  };

  // Collect warnings
  if (contentAnalysis.appearsBlocked) {
    warnings.push('Page appears to be blocked by bot detection');
  }
  if (contentAnalysis.appearsJsOnly) {
    warnings.push('Page appears to be a JS-only shell — content may require browser rendering');
  }
  if (quality.criticalFieldsMissing && quality.criticalFieldsMissing.length > 0) {
    warnings.push(`Critical fields missing: ${quality.criticalFieldsMissing.join(', ')}`);
  }

  // Determine extraction status
  let extractionStatus: ExtractionStatus;
  if (contentAnalysis.appearsBlocked) {
    extractionStatus = 'blocked';
  } else if (extractableFields > 0 && populatedExtractableFields === 0) {
    extractionStatus = 'failed';
  } else if (quality.criticalFieldsMissing && quality.criticalFieldsMissing.length > 0) {
    extractionStatus = 'partial';
  } else if (quality.grade === 'A' || quality.grade === 'B') {
    extractionStatus = 'full';
  } else {
    extractionStatus = 'partial';
  }

  // Compute content fingerprint for deduplication
  const fingerprint = computeFingerprint({
    title: typeof propertyHash.title === 'string' ? propertyHash.title : undefined,
    price_float: typeof propertyHash.price_float === 'number' ? propertyHash.price_float : undefined,
    address_string: typeof propertyHash.address_string === 'string' ? propertyHash.address_string : undefined,
  });

  console.log(`[Extractor] ${mapping.name}: Grade ${quality.grade} (${quality.label}) — ${populatedExtractableFields}/${extractableFields} extractable fields (${Math.round(extractionRate * 100)}%), weighted ${Math.round((quality.weightedRate || 0) * 100)}% [${extractionStatus}]`);
  if (quality.criticalFieldsMissing && quality.criticalFieldsMissing.length > 0) {
    console.log(`[Extractor] Critical fields missing: ${quality.criticalFieldsMissing.join(', ')}`);
  }
  if (emptyFields.length > 0) {
    console.log(`[Extractor] Empty fields: ${emptyFields.join(', ')}`);
  }
  for (const t of traces) {
    const status = t.rawText ? '\u2713' : '\u2717';
    const fb = t.fallbackUsed != null ? ` [fallback ${t.fallbackUsed}]` : '';
    console.log(`[Extractor]   ${status} ${t.field} (${t.strategy}${fb}) \u2192 ${JSON.stringify(t.value)}`);
  }

  return {
    success: true,
    status: extractionStatus,
    properties: [sanitizedHash],
    warnings,
    diagnostics,
    splitSchema: split,
    fingerprint,
  };
}
