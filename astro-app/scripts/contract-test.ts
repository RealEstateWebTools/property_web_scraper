#!/usr/bin/env npx tsx
/**
 * contract-test.ts — Run contract tests against live listing sites.
 *
 * For each scraper with a known live URL, fetches the page HTML,
 * runs extraction, and checks that quality grade ≥ minimumGrade.
 *
 * Usage:
 *   npx tsx scripts/contract-test.ts                  # test all scrapers
 *   npx tsx scripts/contract-test.ts --scraper=uk_rightmove  # test one
 *   npx tsx scripts/contract-test.ts --min-grade=B    # require grade B+
 *   npx tsx scripts/contract-test.ts --json           # JSON output
 *
 * Exit codes:
 *   0 = all pass
 *   1 = one or more failures
 */

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// We can't easily import the extractor here in a tsx context
// without the Vite bundler, so we dynamically import it.
// Instead, build a self-contained test that shells out to a small
// vitest-compatible runner. For simplicity, we use direct fetch + mapping.
//
// The actual extraction is done by importing the same functions the health API uses.

import { extractFromHtml } from '../src/lib/extractor/html-extractor.js';
import { allMappingNames } from '../src/lib/extractor/mapping-loader.js';

// ---------------------------------------------------------------------------
// Contract URLs: one live listing per scraper for smoke testing.
// These URLs should be relatively stable (popular/featured listings).
// ---------------------------------------------------------------------------

interface ContractEntry {
  scraper: string;
  url: string;
  minGrade: string;
}

const CONTRACT_URLS: ContractEntry[] = [
  { scraper: 'uk_rightmove',      url: 'https://www.rightmove.co.uk/properties/168908774', minGrade: 'B' },
  { scraper: 'uk_zoopla',         url: 'https://www.zoopla.co.uk/for-sale/details/71695439/', minGrade: 'B' },
  { scraper: 'es_idealista',      url: 'https://www.idealista.com/inmueble/98765432/', minGrade: 'B' },
  { scraper: 'ie_daft',           url: 'https://www.daft.ie/for-sale/semi-detached-house-42-griffith-avenue-dublin-9/4567890', minGrade: 'B' },
  { scraper: 'uk_onthemarket',    url: 'https://www.onthemarket.com/details/15269498/', minGrade: 'B' },
  { scraper: 'es_fotocasa',       url: 'https://www.fotocasa.es/vivienda/madrid/piso-123', minGrade: 'C' },
  { scraper: 'es_pisos',          url: 'https://www.pisos.com/comprar/piso-madrid_capital/12345/', minGrade: 'C' },
  { scraper: 'us_realtor',        url: 'https://www.realtor.com/realestateandhomes-detail/5804-Cedar-Glen-Ln_Bakersfield_CA_93313_M12147-18296', minGrade: 'C' },
];

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
const filterScraper = args['scraper'];
const minGradeOverride = args['min-grade'];
const jsonOutput = args['json'] === 'true';
const timeout = parseInt(args['timeout'] || '15000', 10);

const GRADE_ORDER: Record<string, number> = { A: 4, B: 3, C: 2, F: 1 };

function meetsGrade(actual: string, required: string): boolean {
  return (GRADE_ORDER[actual] ?? 0) >= (GRADE_ORDER[required] ?? 0);
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

interface TestResult {
  scraper: string;
  url: string;
  status: 'pass' | 'fail' | 'error';
  grade?: string;
  requiredGrade: string;
  extractionRate?: number;
  populatedFields?: number;
  totalFields?: number;
  criticalMissing?: string[];
  error?: string;
  durationMs: number;
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PropertyWebScraper/1.0; contract-test)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function runTest(entry: ContractEntry): Promise<TestResult> {
  const requiredGrade = minGradeOverride || entry.minGrade;
  const start = Date.now();

  try {
    const html = await fetchWithTimeout(entry.url, timeout);
    const result = extractFromHtml({
      html,
      sourceUrl: entry.url,
      scraperMappingName: entry.scraper,
    });

    const diag = result.diagnostics;
    const grade = diag?.qualityGrade || 'F';
    const pass = meetsGrade(grade, requiredGrade);

    return {
      scraper: entry.scraper,
      url: entry.url,
      status: pass ? 'pass' : 'fail',
      grade,
      requiredGrade,
      extractionRate: diag?.extractionRate,
      populatedFields: diag?.populatedFields,
      totalFields: diag?.totalFields,
      criticalMissing: diag?.criticalFieldsMissing,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      scraper: entry.scraper,
      url: entry.url,
      status: 'error',
      requiredGrade,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    };
  }
}

async function main() {
  const entries = filterScraper
    ? CONTRACT_URLS.filter((e) => e.scraper === filterScraper)
    : CONTRACT_URLS;

  if (entries.length === 0) {
    console.error(`No contract test entries found${filterScraper ? ` for scraper: ${filterScraper}` : ''}`);
    process.exit(1);
  }

  if (!jsonOutput) {
    console.log(`\n🧪 Contract Tests — ${entries.length} scraper(s)\n`);
  }

  // Run sequentially to avoid rate limiting
  const results: TestResult[] = [];
  for (const entry of entries) {
    if (!jsonOutput) {
      process.stdout.write(`  ${entry.scraper.padEnd(22)}`);
    }
    const result = await runTest(entry);
    results.push(result);

    if (!jsonOutput) {
      if (result.status === 'pass') {
        console.log(`✅ Grade ${result.grade} (${Math.round((result.extractionRate || 0) * 100)}%, ${result.durationMs}ms)`);
      } else if (result.status === 'fail') {
        console.log(`❌ Grade ${result.grade} < ${result.requiredGrade} (${Math.round((result.extractionRate || 0) * 100)}%, ${result.durationMs}ms)`);
        if (result.criticalMissing && result.criticalMissing.length > 0) {
          console.log(`                        Critical missing: ${result.criticalMissing.join(', ')}`);
        }
      } else {
        console.log(`⚠️  Error: ${result.error} (${result.durationMs}ms)`);
      }
    }
  }

  if (jsonOutput) {
    console.log(JSON.stringify({ results, timestamp: new Date().toISOString() }, null, 2));
  }

  const failures = results.filter((r) => r.status !== 'pass');
  if (failures.length > 0) {
    if (!jsonOutput) {
      console.log(`\n❌ ${failures.length}/${results.length} tests failed\n`);
    }
    process.exit(1);
  } else {
    if (!jsonOutput) {
      console.log(`\n✅ All ${results.length} tests passed\n`);
    }
    process.exit(0);
  }
}

main();
