import type { APIRoute } from 'astro';
import { authenticateAdmin } from '@lib/services/admin-auth.js';
import { extractFromHtml } from '@lib/extractor/html-extractor.js';
import { allMappingNames, findByName } from '@lib/extractor/mapping-loader.js';
import { findPortalByName } from '@lib/services/portal-registry.js';
import { getPortalProfile } from '@lib/services/scrape-metadata.js';

/**
 * Legacy fixture name overrides for scrapers where the fixture file name
 * differs from the scraper name. New scrapers use <scraper_name>.html directly.
 */
const LEGACY_FIXTURE_MAP: Record<string, string> = {
  es_pisos: 'pisos_dot_com',
  in_realestateindia: 'realestateindia',
  us_mlslistings: 'mlslistings',
  us_wyomingmls: 'wyomingmls',
  us_forsalebyowner: 'forsalebyowner',
};

interface FixtureResolver {
  available: boolean;
  reason?: string;
  resolveFixtureName: (scraperName: string) => string | null;
  readFixture: (fixtureName: string) => string;
}

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

async function buildFixtureResolver(): Promise<FixtureResolver> {
  try {
    const { readFileSync, existsSync } = await import('node:fs');
    const { resolve, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const candidateDirs = [
      resolve(__dirname, '..', '..', '..', '..', 'test', 'fixtures'),
      resolve(process.cwd(), 'test', 'fixtures'),
    ];
    const fixturesDir = candidateDirs.find((dir) => existsSync(dir));

    if (!fixturesDir) {
      return {
        available: false,
        reason: 'Fixture directory is unavailable in this runtime environment',
        resolveFixtureName: () => null,
        readFixture: () => { throw new Error('Fixtures unavailable'); },
      };
    }

    return {
      available: true,
      resolveFixtureName: (scraperName: string): string | null => {
        // Try standard <scraper_name>.html first
        if (existsSync(resolve(fixturesDir, `${scraperName}.html`))) {
          return scraperName;
        }
        // Fall back to legacy overrides
        const legacy = LEGACY_FIXTURE_MAP[scraperName];
        if (legacy && existsSync(resolve(fixturesDir, `${legacy}.html`))) {
          return legacy;
        }
        return null;
      },
      readFixture: (fixtureName: string): string => readFileSync(resolve(fixturesDir, `${fixtureName}.html`), 'utf-8'),
    };
  } catch (err) {
    return {
      available: false,
      reason: `Filesystem access unavailable: ${err instanceof Error ? err.message : String(err)}`,
      resolveFixtureName: () => null,
      readFixture: () => { throw new Error('Filesystem unavailable'); },
    };
  }
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
  const fixtures = await buildFixtureResolver();

  for (const name of scraperNames) {
    const portal = findPortalByName(name);
    const portalProfile = await getPortalProfile(name);
    const fixtureName = fixtures.resolveFixtureName(name);
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

    try {
      const html = fixtures.readFixture(fixtureName);
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
        weightedRate: diag?.weightedExtractionRate,
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

  return new Response(JSON.stringify({
    results,
    timestamp: new Date().toISOString(),
    fixtureRuntime: fixtures.available ? 'available' : 'unavailable',
    fixtureRuntimeWarning: fixtures.reason,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
