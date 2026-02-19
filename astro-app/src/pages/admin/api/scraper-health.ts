import type { APIRoute } from 'astro';
import { authenticateAdmin } from '@lib/services/admin-auth.js';
import { extractFromHtml } from '@lib/extractor/html-extractor.js';
import { allMappingNames, findByName } from '@lib/extractor/mapping-loader.js';
import { findPortalByName } from '@lib/services/portal-registry.js';
import { getPortalProfile } from '@lib/services/scrape-metadata.js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURES_DIR = resolve(__dirname, '..', '..', '..', '..', 'test', 'fixtures');

/** Map from scraper name → fixture filename (without .html) */
const FIXTURE_MAP: Record<string, string> = {
  us_realtor: 'realtor',
  uk_rightmove: 'rightmove_v2',
  uk_zoopla: 'zoopla_v2',
  es_idealista: 'idealista_v2',
  es_fotocasa: 'fotocasa',
  es_pisos: 'pisos_dot_com',
  in_realestateindia: 'realestateindia',
  us_mlslistings: 'mlslistings',
  us_wyomingmls: 'wyomingmls',
  us_forsalebyowner: 'forsalebyowner',
  uk_jitty: 'uk_jitty',
  uk_onthemarket: 'onthemarket',
  ie_daft: 'daft',
};

interface ScraperHealthResult {
  name: string;
  country: string;
  hasFixture: boolean;
  supportTier?: string;
  expectedExtractionRate?: number;
  meetsExpectation?: boolean;
  consecutiveBelowThreshold?: number;
  grade?: string;
  label?: string;
  extractionRate?: number;
  weightedRate?: number;
  populatedFields?: number;
  totalFields?: number;
  criticalFieldsMissing?: string[];
  emptyFields?: string[];
  error?: string;
}

export const GET: APIRoute = async ({ request }) => {
  const auth = authenticateAdmin(request);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: auth.errorMessage }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const results: ScraperHealthResult[] = [];
  const scraperNames = allMappingNames();

  for (const name of scraperNames) {
    const portal = findPortalByName(name);
    const portalProfile = await getPortalProfile(name);
    const fixtureName = FIXTURE_MAP[name];
    const country = portal?.country || '??';
    const consecutiveBelow = portalProfile?.consecutive_below_threshold;

    if (!fixtureName) {
      results.push({
        name,
        country,
        hasFixture: false,
        supportTier: portal?.supportTier,
        expectedExtractionRate: portal?.expectedExtractionRate,
        consecutiveBelowThreshold: consecutiveBelow,
      });
      continue;
    }

    const fixturePath = resolve(FIXTURES_DIR, `${fixtureName}.html`);
    if (!existsSync(fixturePath)) {
      results.push({
        name,
        country,
        hasFixture: false,
        supportTier: portal?.supportTier,
        expectedExtractionRate: portal?.expectedExtractionRate,
        consecutiveBelowThreshold: consecutiveBelow,
      });
      continue;
    }

    try {
      const html = readFileSync(fixturePath, 'utf-8');
      const result = extractFromHtml({
        html,
        sourceUrl: `https://fixture.test/${name}`,
        scraperMappingName: name,
      });

      const diag = result.diagnostics;
      const expected = portal?.expectedExtractionRate;
      const rate = diag?.extractionRate;
      const meets = (typeof rate === 'number' && typeof expected === 'number')
        ? rate >= expected
        : undefined;
      results.push({
        name,
        country,
        hasFixture: true,
        supportTier: portal?.supportTier,
        expectedExtractionRate: expected,
        meetsExpectation: meets,
        consecutiveBelowThreshold: consecutiveBelow,
        grade: diag?.qualityGrade,
        label: diag?.qualityLabel,
        extractionRate: diag?.extractionRate,
        weightedRate: diag?.weightedRate,
        populatedFields: diag?.populatedFields,
        totalFields: diag?.totalFields,
        criticalFieldsMissing: diag?.criticalFieldsMissing,
        emptyFields: diag?.emptyFields,
      });
    } catch (err) {
      results.push({
        name,
        country,
        hasFixture: true,
        supportTier: portal?.supportTier,
        expectedExtractionRate: portal?.expectedExtractionRate,
        consecutiveBelowThreshold: consecutiveBelow,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Sort: errors first, then by grade (F, C, B, A)
  const gradeOrder: Record<string, number> = { F: 0, C: 1, B: 2, A: 3 };
  results.sort((a, b) => {
    if (a.error && !b.error) return -1;
    if (!a.error && b.error) return 1;
    if (!a.hasFixture && b.hasFixture) return 1;
    if (a.hasFixture && !b.hasFixture) return -1;
    const aGrade = gradeOrder[a.grade || 'F'] ?? -1;
    const bGrade = gradeOrder[b.grade || 'F'] ?? -1;
    return aGrade - bGrade;
  });

  return new Response(JSON.stringify({ results, timestamp: new Date().toISOString() }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
