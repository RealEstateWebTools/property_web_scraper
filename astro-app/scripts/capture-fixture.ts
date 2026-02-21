#!/usr/bin/env npx tsx
/**
 * capture-fixture.ts — CLI utility to capture HTML test fixtures for scrapers.
 *
 * Usage:
 *   npx tsx scripts/capture-fixture.ts <url>
 *   npx tsx scripts/capture-fixture.ts --file page.html --url https://...
 *   curl ... | npx tsx scripts/capture-fixture.ts --stdin --url https://...
 *
 * Run with --help for all options.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import JSON5 from 'json5';

// tsx-safe imports — these modules only use `import type` from mapping-loader
import { retrieveTargetText } from '../src/lib/extractor/strategies.js';
import { extractImages } from '../src/lib/extractor/image-extractor.js';
import { extractFeatures } from '../src/lib/extractor/feature-extractor.js';
import { booleanEvaluators } from '../src/lib/extractor/field-processors.js';
import type { FieldMapping, ScraperMapping } from '../src/lib/extractor/mapping-loader.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MAPPINGS_DIR = resolve(__dirname, '..', 'scraper_mappings');
const FIXTURES_DIR = resolve(__dirname, '..', 'test', 'fixtures');

/**
 * Hostname → scraper name lookup.
 * Derived from LOCAL_HOST_MAP in src/lib/services/url-validator.ts (lines 19-36),
 * extended with additional hosts from the mapping files.
 */
const HOSTNAME_MAP: Record<string, string> = {
  // From url-validator.ts LOCAL_HOST_MAP
  'www.idealista.com': 'es_idealista',
  'idealista.com': 'es_idealista',
  'www.rightmove.co.uk': 'uk_rightmove',
  'rightmove.co.uk': 'uk_rightmove',
  'www.zoopla.co.uk': 'uk_zoopla',
  'zoopla.co.uk': 'uk_zoopla',
  'www.realtor.com': 'us_realtor',
  'realtor.com': 'us_realtor',
  'www.fotocasa.es': 'es_fotocasa',
  'fotocasa.es': 'es_fotocasa',
  'www.pisos.com': 'es_pisos',
  'pisos.com': 'es_pisos',
  'www.realestateindia.com': 'in_realestateindia',
  'realestateindia.com': 'in_realestateindia',
  'www.forsalebyowner.com': 'us_forsalebyowner',
  'forsalebyowner.com': 'us_forsalebyowner',

  // Additional hosts from mapping files
  'www.mlslistings.com': 'us_mlslistings',
  'mlslistings.com': 'us_mlslistings',
  'www.wyomingmls.com': 'us_wyomingmls',
  'wyomingmls.com': 'us_wyomingmls',


  'jitty.com': 'uk_jitty',
  'www.jitty.com': 'uk_jitty',
  'www.onthemarket.com': 'uk_onthemarket',
  'onthemarket.com': 'uk_onthemarket',
  'www.daft.ie': 'ie_daft',
  'daft.ie': 'ie_daft',
  'www.idealista.pt': 'pt_idealista',
  'idealista.pt': 'pt_idealista',
  'www.immobilienscout24.de': 'de_immoscout',
  'immobilienscout24.de': 'de_immoscout',
  'www.seloger.com': 'fr_seloger',
  'seloger.com': 'fr_seloger',
  'www.leboncoin.fr': 'fr_leboncoin',
  'leboncoin.fr': 'fr_leboncoin',
  'www.domain.com.au': 'au_domain',
  'domain.com.au': 'au_domain',
  'www.realestate.com.au': 'au_realestate',
  'realestate.com.au': 'au_realestate',
  'www.zillow.com': 'us_zillow',
  'zillow.com': 'us_zillow',
  'www.redfin.com': 'us_redfin',
  'redfin.com': 'us_redfin',
  'www.trulia.com': 'us_trulia',
  'trulia.com': 'us_trulia',
  'www.funda.nl': 'nl_funda',
  'funda.nl': 'nl_funda',
  'www.immobiliare.it': 'it_immobiliare',
  'immobiliare.it': 'it_immobiliare',
};

const HELP_TEXT = `
capture-fixture — Capture HTML test fixtures for scrapers

Usage:
  npx tsx scripts/capture-fixture.ts <url>
  npx tsx scripts/capture-fixture.ts --file page.html --url https://...
  curl ... | npx tsx scripts/capture-fixture.ts --stdin --url https://...

Options:
  <url>                  Fetch HTML from this URL (first positional arg)
  --file <path>          Read HTML from a local file
  --stdin                Read HTML from stdin
  --url <url>            Source URL (required with --file/--stdin)
  --name <scraper>       Override scraper name detection
  --fixture-name <name>  Override output filename (without .html)
  --server-fetched       Mark fixture as server-fetched (appends .server-fetched to name)
  --force                Overwrite existing fixture without warning
  --no-extract           Skip extraction preview
  --help                 Show this help
`.trim();

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

interface CliArgs {
  url?: string;
  file?: string;
  stdin: boolean;
  name?: string;
  fixtureName?: string;
  serverFetched: boolean;
  force: boolean;
  noExtract: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { stdin: false, serverFetched: false, force: false, noExtract: false, help: false };
  let i = 0;

  while (i < argv.length) {
    const arg = argv[i];
    switch (arg) {
      case '--help':
      case '-h':
        args.help = true;
        break;
      case '--file':
        args.file = argv[++i];
        break;
      case '--stdin':
        args.stdin = true;
        break;
      case '--url':
        args.url = argv[++i];
        break;
      case '--name':
        args.name = argv[++i];
        break;
      case '--fixture-name':
        args.fixtureName = argv[++i];
        break;
      case '--server-fetched':
        args.serverFetched = true;
        break;
      case '--force':
        args.force = true;
        break;
      case '--no-extract':
        args.noExtract = true;
        break;
      default:
        // Positional argument: treat as URL if it looks like one
        if (!arg.startsWith('-') && !args.url) {
          args.url = arg;
        } else {
          console.error(`Unknown argument: ${arg}`);
          process.exit(1);
        }
    }
    i++;
  }

  return args;
}

// ---------------------------------------------------------------------------
// HTML acquisition
// ---------------------------------------------------------------------------

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText} fetching ${url}`);
  }

  return response.text();
}

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on('data', (chunk) => chunks.push(chunk));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    process.stdin.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Scraper name resolution
// ---------------------------------------------------------------------------

function resolveScraperName(url: string): string | null {
  try {
    const uri = new URL(url);
    return HOSTNAME_MAP[uri.hostname] ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Mapping loading (bypass Vite — load JSON5 directly from disk)
// ---------------------------------------------------------------------------

function loadMapping(name: string): ScraperMapping {
  const filePath = resolve(MAPPINGS_DIR, `${name}.json`);
  if (!existsSync(filePath)) {
    throw new Error(`Mapping file not found: ${filePath}`);
  }
  const raw = readFileSync(filePath, 'utf-8');
  const parsed = JSON5.parse(raw);
  // Some mappings are wrapped in an array
  return Array.isArray(parsed) ? parsed[0] : parsed;
}

// ---------------------------------------------------------------------------
// Extraction pipeline replica
// ---------------------------------------------------------------------------

/**
 * Replicated from html-extractor.ts lines 60-136.
 * Kept in sync manually — see that file for the authoritative version.
 *
 * Returns extracted properties and a fieldSources map noting which pipeline
 * stage produced each field value.
 */
function runExtraction(
  html: string,
  sourceUrl: string,
  mapping: ScraperMapping
): { properties: Record<string, unknown>; fieldSources: Record<string, string> } {
  const $ = cheerio.load(html);
  const uri = new URL(sourceUrl);
  const propertyHash: Record<string, unknown> = {};
  const fieldSources: Record<string, string> = {};

  // 1. Default values
  if (mapping.defaultValues) {
    for (const [key, fieldMapping] of Object.entries(mapping.defaultValues)) {
      propertyHash[key] = fieldMapping.value;
      fieldSources[key] = 'default';
    }
  }

  // 2. Images
  if (mapping.images) {
    for (const imageMapping of mapping.images) {
      propertyHash['image_urls'] = extractImages($, html, imageMapping, uri);
      fieldSources['image_urls'] = 'images';
    }
  }

  // 3. Features
  if (mapping.features) {
    for (const featureMapping of mapping.features) {
      propertyHash['features'] = extractFeatures($, featureMapping, uri);
      fieldSources['features'] = 'features';
    }
  }

  // 4. Int fields
  if (mapping.intFields) {
    for (const [key, fieldMapping] of Object.entries(mapping.intFields)) {
      const { text } = retrieveTargetText($, html, fieldMapping, uri);
      propertyHash[key] = parseInt(text.trim(), 10) || 0;
      fieldSources[key] = 'int';
    }
  }

  // 5. Float fields
  if (mapping.floatFields) {
    for (const [key, fieldMapping] of Object.entries(mapping.floatFields)) {
      let { text } = retrieveTargetText($, html, fieldMapping, uri);
      if (fieldMapping.stripPunct) {
        text = text.replace(/\./g, '').replace(/,/g, '');
      }
      if (fieldMapping.stripFirstChar) {
        text = text.trim().slice(1) || '';
      }
      propertyHash[key] = parseFloat(text.trim()) || 0;
      fieldSources[key] = 'float';
    }
  }

  // 6. Text fields
  if (mapping.textFields) {
    for (const [key, fieldMapping] of Object.entries(mapping.textFields)) {
      const { text } = retrieveTargetText($, html, fieldMapping, uri);
      propertyHash[key] = text.trim();
      fieldSources[key] = 'text';
    }
  }

  // 7. Boolean fields
  if (mapping.booleanFields) {
    for (const [key, fieldMapping] of Object.entries(mapping.booleanFields)) {
      let { text } = retrieveTargetText($, html, fieldMapping, uri);
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
      fieldSources[key] = 'boolean';
    }
  }

  return { properties: propertyHash, fieldSources };
}

// ---------------------------------------------------------------------------
// Output formatting
// ---------------------------------------------------------------------------

function formatValue(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    if (value.length <= 3) return JSON.stringify(value);
    return `[${value.length} items]`;
  }
  return JSON.stringify(value);
}

function printExtractionPreview(
  properties: Record<string, unknown>,
  fieldSources: Record<string, string>
): void {
  console.log('\nExtraction preview:');

  const keys = Object.keys(properties).sort();
  const maxKeyLen = Math.max(...keys.map((k) => k.length));

  for (const key of keys) {
    const value = properties[key];
    const source = fieldSources[key] || 'unknown';
    const formatted = formatValue(value);
    const padding = ' '.repeat(maxKeyLen - key.length);
    console.log(`  ${key}${padding} = ${formatted.padEnd(35)} (${source})`);
  }
}

function printManifestStub(
  scraperName: string,
  fixtureName: string,
  sourceUrl: string,
  properties: Record<string, unknown>,
  serverFetched: boolean = false
): void {
  console.log('\nManifest stub (copy into test/fixtures/manifest.ts):');

  const entries: string[] = [];
  const keys = Object.keys(properties).sort();
  for (const key of keys) {
    const value = properties[key];
    // Skip empty arrays and zero-value fields that aren't meaningful
    if (Array.isArray(value)) continue;
    if (value === '' || value === 0 || value === null || value === undefined) continue;
    entries.push(`      ${key}: ${JSON.stringify(value)},`);
  }

  const sourceLine = serverFetched ? `\n    source: 'server-fetched',` : '';

  console.log(`  {
    scraper: '${scraperName}',
    fixture: '${fixtureName}',
    sourceUrl: '${sourceUrl}',${sourceLine}
    expected: {
${entries.join('\n')}
    },
  },`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  // Validate input mode
  const modes = [args.url && !args.file && !args.stdin, args.file, args.stdin].filter(Boolean);
  if (args.file && !args.url) {
    console.error('Error: --url is required with --file (needed for scraper detection and extraction)');
    process.exit(1);
  }
  if (args.stdin && !args.url) {
    console.error('Error: --url is required with --stdin (needed for scraper detection and extraction)');
    process.exit(1);
  }
  if (!args.url) {
    console.error('Error: No URL provided. Run with --help for usage.');
    process.exit(1);
  }

  // Resolve scraper name
  const scraperName = args.name ?? resolveScraperName(args.url);
  if (!scraperName) {
    console.error(`Error: Could not detect scraper for hostname in ${args.url}`);
    console.error('Use --name <scraper> to specify manually.');
    console.error(`\nKnown scrapers: ${[...new Set(Object.values(HOSTNAME_MAP))].sort().join(', ')}`);
    process.exit(1);
  }

  // Acquire HTML
  let html: string;
  if (args.stdin) {
    console.log('Reading HTML from stdin...');
    html = await readStdin();
  } else if (args.file) {
    const filePath = resolve(process.cwd(), args.file);
    if (!existsSync(filePath)) {
      console.error(`Error: File not found: ${filePath}`);
      process.exit(1);
    }
    html = readFileSync(filePath, 'utf-8');
    console.log(`Read ${html.length.toLocaleString()} bytes from ${filePath}`);
  } else {
    console.log(`Fetching ${args.url} ...`);
    html = await fetchHtml(args.url);
    console.log(`Fetched ${html.length.toLocaleString()} bytes`);
  }

  // Determine fixture name and save
  const fixtureName = args.fixtureName ?? (args.serverFetched ? `${scraperName}.server-fetched` : scraperName);
  const outputPath = resolve(FIXTURES_DIR, `${fixtureName}.html`);

  if (existsSync(outputPath) && !args.force) {
    console.error(`Error: Fixture already exists: ${outputPath}`);
    console.error('Use --force to overwrite, or --fixture-name to use a different name.');
    process.exit(1);
  }

  writeFileSync(outputPath, html, 'utf-8');

  console.log(`\nFixture captured:`);
  console.log(`  Scraper:  ${scraperName}`);
  console.log(`  URL:      ${args.url}`);
  console.log(`  Saved:    ${outputPath}  (${html.length.toLocaleString()} bytes)`);

  // Extraction preview
  if (!args.noExtract) {
    let mapping: ScraperMapping;
    try {
      mapping = loadMapping(scraperName);
    } catch (err) {
      console.error(`\nWarning: Could not load mapping for '${scraperName}': ${err instanceof Error ? err.message : err}`);
      console.log('Skipping extraction preview. Use --no-extract to suppress this warning.');
      printManifestStub(scraperName, fixtureName, args.url, {}, args.serverFetched);
      return;
    }

    const { properties, fieldSources } = runExtraction(html, args.url, mapping);
    printExtractionPreview(properties, fieldSources);
    printManifestStub(scraperName, fixtureName, args.url, properties, args.serverFetched);
  }
}

main().catch((err) => {
  console.error(`Fatal: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
