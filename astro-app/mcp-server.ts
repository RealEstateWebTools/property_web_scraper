#!/usr/bin/env node
/**
 * MCP Server for property-web-scraper extraction engine.
 *
 * Exposes 4 tools:
 *   - extract_property   — extract structured data from HTML
 *   - list_supported_portals — list all supported property portals
 *   - validate_url       — check if a URL is supported
 *   - get_scraper_mapping — return raw mapping JSON for debugging
 *
 * Run: npx tsx astro-app/mcp-server.ts
 */

import { readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import JSON5 from 'json5';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as cheerio from 'cheerio';
import { createHash } from 'node:crypto';

import type {
  ScraperMapping,
  FieldMapping,
  PortalMetadata,
} from './src/lib/extractor/mapping-loader.js';
import { retrieveTargetText } from './src/lib/extractor/strategies.js';
import { extractImages } from './src/lib/extractor/image-extractor.js';
import { extractFeatures } from './src/lib/extractor/feature-extractor.js';
import { booleanEvaluators } from './src/lib/extractor/field-processors.js';
import {
  assessQualityWeighted,
  getFieldImportance,
  type QualityGrade,
  type QualityAssessment,
  type FieldResult,
} from './src/lib/extractor/quality-scorer.js';
import { splitPropertyHash, type SplitSchema } from './src/lib/extractor/schema-splitter.js';

// NOTE: We cannot import from portal-registry.ts because it transitively
// imports mapping-loader.ts -> mappings-bundle.ts which uses Vite's
// import.meta.glob. Instead, we inline the PortalConfig type and hardcoded
// registry, and build auto-discovered portals from our own disk-loaded mappings.

interface PortalConfig {
  scraperName: string;
  slug: string;
  hosts: string[];
  country: string;
  currency: string;
  localeCode: string;
  areaUnit: string;
  contentSource: 'html' | 'script-json' | 'json-ld' | 'flight-data';
  expectedExtractionRate?: number;
  stripTrailingSlash: boolean;
  requiresJsRendering: boolean;
}

const PORTAL_REGISTRY: Record<string, PortalConfig> = {
  uk_rightmove: { scraperName: 'uk_rightmove', slug: 'uk_rightmove', hosts: ['www.rightmove.co.uk', 'rightmove.co.uk'], country: 'GB', currency: 'GBP', localeCode: 'en-GB', areaUnit: 'sqft', contentSource: 'script-json', stripTrailingSlash: false, requiresJsRendering: false },
  es_idealista: { scraperName: 'es_idealista', slug: 'es_idealista', hosts: ['www.idealista.com', 'idealista.com'], country: 'ES', currency: 'EUR', localeCode: 'es-ES', areaUnit: 'sqmt', contentSource: 'html', stripTrailingSlash: false, requiresJsRendering: false },
  uk_zoopla: { scraperName: 'uk_zoopla', slug: 'uk_zoopla', hosts: ['www.zoopla.co.uk', 'zoopla.co.uk'], country: 'GB', currency: 'GBP', localeCode: 'en-GB', areaUnit: 'sqft', contentSource: 'script-json', stripTrailingSlash: false, requiresJsRendering: false },
  us_realtor: { scraperName: 'us_realtor', slug: 'us_realtor', hosts: ['www.realtor.com', 'realtor.com'], country: 'US', currency: 'USD', localeCode: 'en-US', areaUnit: 'sqft', contentSource: 'flight-data', stripTrailingSlash: false, requiresJsRendering: false },
  es_fotocasa: { scraperName: 'es_fotocasa', slug: 'es_fotocasa', hosts: ['www.fotocasa.es', 'fotocasa.es'], country: 'ES', currency: 'EUR', localeCode: 'es-ES', areaUnit: 'sqmt', contentSource: 'html', stripTrailingSlash: false, requiresJsRendering: false },
  es_pisos: { scraperName: 'es_pisos', slug: 'es_pisos', hosts: ['www.pisos.com', 'pisos.com'], country: 'ES', currency: 'EUR', localeCode: 'es-ES', areaUnit: 'sqmt', contentSource: 'html', stripTrailingSlash: false, requiresJsRendering: false },
  in_realestateindia: { scraperName: 'in_realestateindia', slug: 'in_realestateindia', hosts: ['www.realestateindia.com', 'realestateindia.com'], country: 'IN', currency: 'INR', localeCode: 'en-IN', areaUnit: 'sqft', contentSource: 'html', stripTrailingSlash: false, requiresJsRendering: false },
  us_forsalebyowner: { scraperName: 'us_forsalebyowner', slug: 'us_forsalebyowner', hosts: ['www.forsalebyowner.com', 'forsalebyowner.com'], country: 'US', currency: 'USD', localeCode: 'en-US', areaUnit: 'sqft', contentSource: 'html', stripTrailingSlash: false, requiresJsRendering: false },
  uk_jitty: { scraperName: 'uk_jitty', slug: 'uk_jitty', hosts: ['jitty.com', 'www.jitty.com'], country: 'GB', currency: 'GBP', localeCode: 'en-GB', areaUnit: 'sqft', contentSource: 'html', stripTrailingSlash: false, requiresJsRendering: false },
  uk_onthemarket: { scraperName: 'uk_onthemarket', slug: 'uk_onthemarket', hosts: ['www.onthemarket.com', 'onthemarket.com'], country: 'GB', currency: 'GBP', localeCode: 'en-GB', areaUnit: 'sqft', contentSource: 'html', stripTrailingSlash: false, requiresJsRendering: false },
  ie_daft: { scraperName: 'ie_daft', slug: 'ie_daft', hosts: ['www.daft.ie', 'daft.ie'], country: 'IE', currency: 'EUR', localeCode: 'en-IE', areaUnit: 'sqmt', contentSource: 'html', stripTrailingSlash: false, requiresJsRendering: false },
};

// ---------------------------------------------------------------------------
// Mapping loader (standalone, no Vite dependency)
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const MAPPINGS_DIR = resolve(__dirname, '..', 'config', 'scraper_mappings');

function loadAllMappings(): Record<string, ScraperMapping> {
  const mappings: Record<string, ScraperMapping> = {};
  for (const file of readdirSync(MAPPINGS_DIR)) {
    if (!file.endsWith('.json')) continue;
    const raw = readFileSync(resolve(MAPPINGS_DIR, file), 'utf-8');
    const parsed = JSON5.parse(raw);
    const mapping: ScraperMapping = Array.isArray(parsed) ? parsed[0] : parsed;
    mappings[file.replace('.json', '')] = mapping;
  }
  return mappings;
}

const ALL_MAPPINGS = loadAllMappings();

// ---------------------------------------------------------------------------
// Portal registry (merged from hardcoded + mapping metadata)
// ---------------------------------------------------------------------------

function buildPortalRegistry(): Record<string, PortalConfig> {
  const discovered: Record<string, PortalConfig> = {};
  for (const [name, mapping] of Object.entries(ALL_MAPPINGS)) {
    if (!mapping.portal) continue;
    if (PORTAL_REGISTRY[name]) continue;
    const p = mapping.portal;
    discovered[name] = {
      scraperName: name,
      slug: name,
      hosts: p.hosts,
      country: p.country,
      currency: p.currency,
      localeCode: p.localeCode,
      areaUnit: p.areaUnit,
      contentSource: p.contentSource || 'html',
      stripTrailingSlash: p.stripTrailingSlash || false,
      requiresJsRendering: p.requiresJsRendering || false,
    };
  }
  return { ...discovered, ...PORTAL_REGISTRY };
}

const MERGED_REGISTRY = buildPortalRegistry();

const HOST_INDEX = new Map<string, PortalConfig>();
for (const config of Object.values(MERGED_REGISTRY)) {
  for (const host of config.hosts) {
    HOST_INDEX.set(host, config);
  }
}

// ---------------------------------------------------------------------------
// Extraction engine (replicates html-extractor.ts without Vite deps)
// ---------------------------------------------------------------------------

interface FieldTrace {
  field: string;
  section: string;
  strategy: string;
  rawText: string;
  value: unknown;
  fallbackUsed?: number;
}

interface ContentAnalysis {
  htmlLength: number;
  hasScriptTags: boolean;
  jsonLdCount: number;
  scriptJsonVarsFound: string[];
  appearsBlocked: boolean;
  appearsJsOnly: boolean;
}

type ExtractionStatus = 'full' | 'partial' | 'blocked' | 'failed';

interface ExtractionResult {
  success: boolean;
  status: ExtractionStatus;
  properties: Record<string, unknown>[];
  errorMessage?: string;
  warnings: string[];
  diagnostics?: {
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
    weightedExtractionRate?: number;
    criticalFieldsMissing?: string[];
    contentAnalysis?: ContentAnalysis;
  };
  splitSchema?: SplitSchema;
  fingerprint?: string;
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

function analyzeContent($: cheerio.CheerioAPI, html: string): ContentAnalysis {
  const scriptTags = $('script');
  const hasScriptTags = scriptTags.length > 0;
  const jsonLdCount = $('script[type="application/ld+json"]').length;

  const scriptJsonVarsFound: string[] = [];
  const scriptText = scriptTags.text();
  for (const varName of KNOWN_SCRIPT_VARS) {
    const pattern = new RegExp(`(?:window\\.)?${varName}\\s*=`);
    if (pattern.test(scriptText) || $(`script#${varName}`).length > 0) {
      scriptJsonVarsFound.push(varName);
    }
  }

  const bodyText = $('body').text().trim();
  const bodyLength = bodyText.length;
  const divCount = $('div').length;

  const blockKeywords = /captcha|verify|access denied|cloudflare|just a moment/i;
  const appearsBlocked = bodyLength < 500 && blockKeywords.test(bodyText);
  const appearsJsOnly = bodyLength < 200 && scriptTags.length > 5 && divCount < 10;

  return { htmlLength: html.length, hasScriptTags, jsonLdCount, scriptJsonVarsFound, appearsBlocked, appearsJsOnly };
}

function computeFingerprint(fields: { title?: string; price_float?: number; address_string?: string }): string {
  const parts = [
    (fields.title || '').toLowerCase().trim(),
    String(fields.price_float || 0),
    (fields.address_string || '').toLowerCase().trim(),
  ];
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 16);
}

function runExtraction(html: string, sourceUrl: string, mapping: ScraperMapping): ExtractionResult {
  const warnings: string[] = [];
  const $ = cheerio.load(html);
  const uri = new URL(sourceUrl);
  const propertyHash: Record<string, unknown> = {};
  const traces: FieldTrace[] = [];

  const contentAnalysis = analyzeContent($, html);

  // 1. Default values
  if (mapping.defaultValues) {
    for (const [key, fieldMapping] of Object.entries(mapping.defaultValues)) {
      propertyHash[key] = fieldMapping.value;
      traces.push({ field: key, section: 'defaultValues', strategy: describeStrategy(fieldMapping), rawText: fieldMapping.value || '', value: propertyHash[key] });
    }
  }

  // 2. Images
  if (mapping.images) {
    for (const imageMapping of mapping.images) {
      propertyHash['image_urls'] = extractImages($, html, imageMapping, uri);
      const urls = propertyHash['image_urls'] as string[];
      traces.push({ field: 'image_urls', section: 'images', strategy: describeStrategy(imageMapping), rawText: urls.length > 0 ? `${urls.length} images` : '', value: urls });
    }
  }

  // 3. Features
  if (mapping.features) {
    for (const featureMapping of mapping.features) {
      propertyHash['features'] = extractFeatures($, featureMapping, uri);
      const feats = propertyHash['features'] as string[];
      traces.push({ field: 'features', section: 'features', strategy: describeStrategy(featureMapping), rawText: feats.length > 0 ? `${feats.length} features` : '', value: feats });
    }
  }

  // 4. Int fields
  if (mapping.intFields) {
    for (const [key, fieldMapping] of Object.entries(mapping.intFields)) {
      const result = retrieveTargetText($, html, fieldMapping, uri);
      propertyHash[key] = parseInt(result.text.trim(), 10) || 0;
      traces.push({ field: key, section: 'intFields', strategy: result.strategyDescription, rawText: result.text.slice(0, 120), value: propertyHash[key], fallbackUsed: result.strategyIndex > 0 ? result.strategyIndex : undefined });
    }
  }

  // 5. Float fields
  if (mapping.floatFields) {
    for (const [key, fieldMapping] of Object.entries(mapping.floatFields)) {
      const result = retrieveTargetText($, html, fieldMapping, uri);
      let text = result.text;
      if (fieldMapping.stripPunct) text = text.replace(/\./g, '').replace(/,/g, '');
      if (fieldMapping.stripFirstChar) text = text.trim().slice(1) || '';
      propertyHash[key] = parseFloat(text.trim()) || 0;
      traces.push({ field: key, section: 'floatFields', strategy: result.strategyDescription, rawText: text.slice(0, 120), value: propertyHash[key], fallbackUsed: result.strategyIndex > 0 ? result.strategyIndex : undefined });
    }
  }

  // 6. Text fields
  if (mapping.textFields) {
    for (const [key, fieldMapping] of Object.entries(mapping.textFields)) {
      const result = retrieveTargetText($, html, fieldMapping, uri);
      propertyHash[key] = result.text.trim();
      traces.push({ field: key, section: 'textFields', strategy: result.strategyDescription, rawText: result.text.slice(0, 120), value: propertyHash[key], fallbackUsed: result.strategyIndex > 0 ? result.strategyIndex : undefined });
    }
  }

  // 7. Boolean fields
  if (mapping.booleanFields) {
    for (const [key, fieldMapping] of Object.entries(mapping.booleanFields)) {
      const result = retrieveTargetText($, html, fieldMapping, uri);
      let text = result.text;
      let evaluatorParam = fieldMapping.evaluatorParam || '';
      if (fieldMapping.caseInsensitive) {
        text = text.toLowerCase();
        evaluatorParam = evaluatorParam.toLowerCase();
      }
      const evaluatorFn = fieldMapping.evaluator ? booleanEvaluators[fieldMapping.evaluator] : undefined;
      propertyHash[key] = evaluatorFn ? evaluatorFn(text.trim(), evaluatorParam) : false;
      traces.push({ field: key, section: 'booleanFields', strategy: result.strategyDescription, rawText: text.slice(0, 120), value: propertyHash[key], fallbackUsed: result.strategyIndex > 0 ? result.strategyIndex : undefined });
    }
  }

  // Quality scoring
  const emptyFields = traces
    .filter(t => t.rawText === '' || t.value === 0 || t.value === false || t.value === '')
    .map(t => t.field);

  const extractableTraces = traces.filter(t => t.section !== 'defaultValues');
  const populatedExtractable = extractableTraces.filter(
    t => t.rawText !== '' && t.value !== 0 && t.value !== false && t.value !== ''
  );
  const extractableFields = extractableTraces.length;
  const populatedExtractableFields = populatedExtractable.length;
  const extractionRate = extractableFields > 0 ? populatedExtractableFields / extractableFields : 0;

  const fieldResults: FieldResult[] = extractableTraces.map(t => ({
    field: t.field,
    populated: t.rawText !== '' && t.value !== 0 && t.value !== false && t.value !== '',
    importance: getFieldImportance(t.field),
  }));

  const quality: QualityAssessment = assessQualityWeighted(fieldResults, mapping.expectedExtractionRate);

  // Split schema
  const split = splitPropertyHash(propertyHash);

  // Fingerprint
  const fingerprint = computeFingerprint({
    title: typeof propertyHash.title === 'string' ? propertyHash.title : undefined,
    price_float: typeof propertyHash.price_float === 'number' ? propertyHash.price_float : undefined,
    address_string: typeof propertyHash.address_string === 'string' ? propertyHash.address_string : undefined,
  });

  // Warnings
  if (contentAnalysis.appearsBlocked) warnings.push('Page appears to be blocked by bot detection');
  if (contentAnalysis.appearsJsOnly) warnings.push('Page appears to be a JS-only shell — content may require browser rendering');
  if (quality.criticalFieldsMissing && quality.criticalFieldsMissing.length > 0) {
    warnings.push(`Critical fields missing: ${quality.criticalFieldsMissing.join(', ')}`);
  }

  // Status
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

  return {
    success: true,
    status: extractionStatus,
    properties: [propertyHash],
    warnings,
    diagnostics: {
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
      weightedExtractionRate: quality.weightedRate,
      criticalFieldsMissing: quality.criticalFieldsMissing,
      contentAnalysis,
    },
    splitSchema: split,
    fingerprint,
  };
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: 'property-scraper',
  version: '1.0.0',
});

// Tool 1: extract_property
server.tool(
  'extract_property',
  'Extract structured property data from HTML. Returns fields (title, price, coordinates, images, etc.), quality diagnostics, and schema split.',
  {
    html: z.string().describe('Raw HTML content of the property listing page'),
    source_url: z.string().url().describe('The URL the HTML was fetched from'),
    scraper_name: z.string().optional().describe('Override auto-detection of scraper mapping name'),
  },
  async ({ html, source_url, scraper_name }) => {
    try {
      // Resolve scraper name from URL hostname if not provided
      let resolvedName = scraper_name;
      if (!resolvedName) {
        const uri = new URL(source_url);
        const portal = HOST_INDEX.get(uri.hostname);
        if (portal) {
          resolvedName = portal.scraperName;
        }
      }

      if (!resolvedName) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ success: false, error: `No scraper found for URL: ${source_url}. Use scraper_name parameter or provide a URL from a supported portal.` }),
          }],
        };
      }

      const mapping = ALL_MAPPINGS[resolvedName];
      if (!mapping) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ success: false, error: `Unknown scraper mapping: ${resolvedName}` }),
          }],
        };
      }

      const result = runExtraction(html, source_url, mapping);
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        }],
      };
    } catch (err) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }),
        }],
        isError: true,
      };
    }
  },
);

// Tool 2: list_supported_portals
server.tool(
  'list_supported_portals',
  'List all supported property portals with their hostnames, countries, currencies, and expected extraction rates.',
  {},
  async () => {
    const portals = Object.values(MERGED_REGISTRY).map(config => ({
      name: config.scraperName,
      hosts: config.hosts,
      country: config.country,
      currency: config.currency,
      content_source: config.contentSource,
      expected_extraction_rate: ALL_MAPPINGS[config.scraperName]?.expectedExtractionRate,
    }));

    // Also include mappings that aren't in the portal registry
    for (const [name, mapping] of Object.entries(ALL_MAPPINGS)) {
      if (MERGED_REGISTRY[name]) continue;
      portals.push({
        name,
        hosts: mapping.portal?.hosts || [],
        country: mapping.portal?.country || 'unknown',
        currency: mapping.portal?.currency || 'unknown',
        content_source: mapping.portal?.contentSource || 'html',
        expected_extraction_rate: mapping.expectedExtractionRate,
      });
    }

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({ total: portals.length, portals }, null, 2),
      }],
    };
  },
);

// Tool 3: validate_url
server.tool(
  'validate_url',
  'Check if a URL is from a supported property portal.',
  {
    url: z.string().describe('URL to validate'),
  },
  async ({ url }) => {
    try {
      const uri = new URL(url);
      const portal = HOST_INDEX.get(uri.hostname);

      if (portal) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              supported: true,
              scraper_name: portal.scraperName,
              portal,
            }, null, 2),
          }],
        };
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            supported: false,
            hostname: uri.hostname,
            message: 'No scraper mapping found for this hostname.',
          }, null, 2),
        }],
      };
    } catch {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            supported: false,
            error: 'Invalid URL',
          }, null, 2),
        }],
      };
    }
  },
);

// Tool 4: get_scraper_mapping
server.tool(
  'get_scraper_mapping',
  'Return the full mapping definition for a scraper (CSS selectors, regex patterns, field definitions). Useful for debugging extraction issues.',
  {
    scraper_name: z.string().describe('Name of the scraper mapping (e.g. "uk_rightmove", "es_idealista")'),
  },
  async ({ scraper_name }) => {
    const mapping = ALL_MAPPINGS[scraper_name];
    if (!mapping) {
      const available = Object.keys(ALL_MAPPINGS).sort();
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            error: `Unknown scraper: ${scraper_name}`,
            available_scrapers: available,
          }, null, 2),
        }],
        isError: true,
      };
    }

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(mapping, null, 2),
      }],
    };
  },
);

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`MCP server error: ${err}\n`);
  process.exit(1);
});
