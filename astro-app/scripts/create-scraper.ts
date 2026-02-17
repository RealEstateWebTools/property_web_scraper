#!/usr/bin/env npx tsx
/**
 * create-scraper.ts — Scaffold a new scraper with all required files.
 *
 * Usage:
 *   npx tsx scripts/create-scraper.ts --country=pt --portal=idealista --hosts=www.idealista.pt,idealista.pt
 *   npx tsx scripts/create-scraper.ts --country=de --portal=immoscout --hosts=www.immobilienscout24.de --source=script-json --currency=EUR
 *
 * Options:
 *   --country     Two-letter country code (required)
 *   --portal      Portal name, lowercase (required)
 *   --hosts       Comma-separated hostnames (required)
 *   --source      Content source: html, script-json, json-ld, flight-data (default: html)
 *   --currency    Currency code (default: EUR)
 *   --locale      Locale code (default: {country}-{COUNTRY})
 *   --area-unit   Area unit: sqft, sqmt (default: sqmt)
 *   --dry-run     Preview generated files without writing
 */

import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT = resolve(__dirname, '..');
const MAPPINGS_DIR = resolve(ROOT, '..', 'config', 'scraper_mappings');
const FIXTURES_DIR = resolve(ROOT, 'test', 'fixtures');
const PORTAL_REGISTRY = resolve(ROOT, 'src', 'lib', 'services', 'portal-registry.ts');
const CAPTURE_FIXTURE = resolve(ROOT, 'scripts', 'capture-fixture.ts');

// ---------------------------------------------------------------------------
// Parse args
// ---------------------------------------------------------------------------

function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--')) {
      const [key, ...rest] = arg.slice(2).split('=');
      args[key] = rest.join('=') || 'true';
    }
  }
  return args;
}

const args = parseArgs();

if (args['help']) {
  console.log(`
create-scraper — Scaffold a new scraper

Options:
  --country=CC       Two-letter country code (required)
  --portal=NAME      Portal name, lowercase (required)
  --hosts=H1,H2      Comma-separated hostnames (required)
  --source=TYPE      html | script-json | json-ld | flight-data (default: html)
  --currency=CUR     Currency code (default: EUR)
  --locale=CODE      Locale code (default: auto from country)
  --area-unit=UNIT   sqft | sqmt (default: sqmt)
  --dry-run          Preview without writing files
`);
  process.exit(0);
}

const country = args['country'];
const portal = args['portal'];
const hostsStr = args['hosts'];

if (!country || !portal || !hostsStr) {
  console.error('Error: --country, --portal, and --hosts are required.');
  console.error('Run with --help for usage.');
  process.exit(1);
}

const source = args['source'] || 'html';
const currency = args['currency'] || 'EUR';
const locale = args['locale'] || `${country.toLowerCase()}-${country.toUpperCase()}`;
const areaUnit = args['area-unit'] || 'sqmt';
const dryRun = args['dry-run'] === 'true';

const name = `${country.toLowerCase()}_${portal.toLowerCase()}`;
const hosts = hostsStr.split(',').map((h) => h.trim());

// ---------------------------------------------------------------------------
// Generate mapping JSON
// ---------------------------------------------------------------------------

const mapping = [
  {
    name,
    expectedExtractionRate: 0.8,
    defaultValues: {
      country: { value: country.toUpperCase() },
      area_unit: { value: areaUnit },
      currency: { value: currency },
      for_rent_short_term: { value: 'false' },
      locale_code: { value: locale },
    },
    intFields: {
      count_bedrooms: source === 'html'
        ? { cssLocator: 'TODO' }
        : { scriptJsonVar: 'TODO_VAR', scriptJsonPath: 'TODO_PATH' },
      count_bathrooms: source === 'html'
        ? { cssLocator: 'TODO' }
        : { scriptJsonVar: 'TODO_VAR', scriptJsonPath: 'TODO_PATH' },
    },
    floatFields: {
      price_float: source === 'html'
        ? { cssLocator: 'TODO' }
        : { scriptJsonVar: 'TODO_VAR', scriptJsonPath: 'TODO_PATH' },
      latitude: source === 'html'
        ? { cssLocator: 'TODO' }
        : { scriptJsonVar: 'TODO_VAR', scriptJsonPath: 'TODO_PATH' },
      longitude: source === 'html'
        ? { cssLocator: 'TODO' }
        : { scriptJsonVar: 'TODO_VAR', scriptJsonPath: 'TODO_PATH' },
    },
    textFields: {
      title: {
        cssLocator: 'title',
        fallbacks: [
          { cssLocator: "meta[property='og:title']", cssAttr: 'content' },
          { cssLocator: 'h1' },
        ],
      },
      description: {
        cssLocator: "meta[property='og:description']",
        cssAttr: 'content',
        fallbacks: [
          { cssLocator: "meta[name='description']", cssAttr: 'content' },
        ],
      },
      address_string: source === 'html'
        ? { cssLocator: 'TODO' }
        : { scriptJsonVar: 'TODO_VAR', scriptJsonPath: 'TODO_PATH' },
      main_image_url: {
        cssLocator: "meta[property='og:image']",
        cssAttr: 'content',
      },
    },
    images: [],
    booleanFields: {
      for_sale: source === 'html'
        ? { cssLocator: 'TODO', evaluator: 'include?', evaluatorParam: 'sale' }
        : { scriptJsonVar: 'TODO_VAR', scriptJsonPath: 'TODO_PATH', evaluator: 'include?', evaluatorParam: 'sale' },
    },
  },
];

// ---------------------------------------------------------------------------
// Generate portal registry entry
// ---------------------------------------------------------------------------

const registryEntry = `  ${name}: {
    scraperName: '${name}',
    slug: '${name}',
    hosts: [${hosts.map((h) => `'${h}'`).join(', ')}],
    country: '${country.toUpperCase()}',
    currency: '${currency}',
    localeCode: '${locale}',
    areaUnit: '${areaUnit}',
    contentSource: '${source}',
    stripTrailingSlash: false,
    requiresJsRendering: false,
  },`;

// ---------------------------------------------------------------------------
// Generate capture-fixture hostname entries
// ---------------------------------------------------------------------------

const captureEntries = hosts.map((h) => `  '${h}': '${name}',`).join('\n');

// ---------------------------------------------------------------------------
// Generate test fixture manifest entry
// ---------------------------------------------------------------------------

const manifestEntry = `  {
    scraper: '${name}',
    fixture: null, // TODO: capture fixture with: npx tsx scripts/capture-fixture.ts <url>
    sourceUrl: 'https://${hosts[0]}/TODO-listing-url',
    expected: {
      title: 'TODO',
    },
  },`;

// ---------------------------------------------------------------------------
// Write or preview
// ---------------------------------------------------------------------------

const mappingPath = resolve(MAPPINGS_DIR, `${name}.json`);

console.log('\n🛠️  create-scraper\n');
console.log(`  Name:     ${name}`);
console.log(`  Hosts:    ${hosts.join(', ')}`);
console.log(`  Source:   ${source}`);
console.log(`  Currency: ${currency}`);
console.log(`  Locale:   ${locale}`);
console.log(`  Area:     ${areaUnit}`);
console.log('');

if (dryRun) {
  console.log('--- DRY RUN — files will NOT be written ---\n');
}

// 1. Mapping JSON
if (existsSync(mappingPath)) {
  console.log(`⚠️  Mapping already exists: ${mappingPath}`);
} else {
  const content = JSON.stringify(mapping, null, 2) + '\n';
  if (dryRun) {
    console.log(`📄 Would create: ${mappingPath}`);
    console.log(content);
  } else {
    writeFileSync(mappingPath, content, 'utf-8');
    console.log(`✅ Created mapping: ${mappingPath}`);
  }
}

// 2. Portal registry
const registryContent = readFileSync(PORTAL_REGISTRY, 'utf-8');
if (registryContent.includes(`${name}:`)) {
  console.log('⚠️  Portal registry already has entry for ' + name);
} else {
  // Insert before the closing `};` of PORTAL_REGISTRY
  const insertPoint = registryContent.indexOf('\n};\n');
  if (insertPoint === -1) {
    console.error('❌ Could not find insertion point in portal-registry.ts');
  } else if (dryRun) {
    console.log(`📄 Would add to portal-registry.ts:\n${registryEntry}\n`);
  } else {
    const updated =
      registryContent.slice(0, insertPoint) +
      '\n' +
      registryEntry +
      registryContent.slice(insertPoint);
    writeFileSync(PORTAL_REGISTRY, updated, 'utf-8');
    console.log(`✅ Added ${name} to portal-registry.ts`);
  }
}

// 3. Capture-fixture hostname map
const captureContent = readFileSync(CAPTURE_FIXTURE, 'utf-8');
if (captureContent.includes(hosts[0])) {
  console.log('⚠️  capture-fixture.ts already has hostname entries');
} else {
  // Insert before the closing `};` of HOSTNAME_MAP
  const mapEnd = captureContent.indexOf('\n};\n');
  if (mapEnd === -1) {
    console.error('❌ Could not find HOSTNAME_MAP end in capture-fixture.ts');
  } else if (dryRun) {
    console.log(`📄 Would add to capture-fixture.ts:\n${captureEntries}\n`);
  } else {
    const updated =
      captureContent.slice(0, mapEnd) +
      '\n' +
      captureEntries +
      captureContent.slice(mapEnd);
    writeFileSync(CAPTURE_FIXTURE, updated, 'utf-8');
    console.log(`✅ Added hostnames to capture-fixture.ts`);
  }
}

// 4. Manifest entry
const manifestPath = resolve(FIXTURES_DIR, 'manifest.ts');
const manifestContent = readFileSync(manifestPath, 'utf-8');
if (manifestContent.includes(`scraper: '${name}'`)) {
  console.log('⚠️  manifest.ts already has entry for ' + name);
} else {
  // Insert before the closing `];`
  const arrEnd = manifestContent.lastIndexOf('\n];');
  if (arrEnd === -1) {
    console.error('❌ Could not find manifest array end');
  } else if (dryRun) {
    console.log(`📄 Would add to manifest.ts:\n${manifestEntry}\n`);
  } else {
    const updated =
      manifestContent.slice(0, arrEnd) +
      '\n' +
      manifestEntry +
      manifestContent.slice(arrEnd);
    writeFileSync(manifestPath, updated, 'utf-8');
    console.log(`✅ Added ${name} to test/fixtures/manifest.ts`);
  }
}

console.log('\n📋 Next steps:');
console.log(`   1. Capture a fixture:  npx tsx scripts/capture-fixture.ts https://${hosts[0]}/LISTING_URL`);
console.log(`   2. Edit the mapping:   config/scraper_mappings/${name}.json`);
console.log(`   3. Update manifest:    test/fixtures/manifest.ts`);
console.log(`   4. Run tests:          npx vitest run`);
console.log('');
