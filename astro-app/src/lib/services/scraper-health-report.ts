import { extractFromHtml } from '@lib/extractor/html-extractor.js';
import { allMappingNames } from '@lib/extractor/mapping-loader.js';
import { findPortalByName, type SupportTier } from '@lib/services/portal-registry.js';
import { getPortalProfile } from '@lib/services/scrape-metadata.js';

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

export interface ScraperHealthResult {
  name: string;
  country: string;
  hasFixture: boolean;
  supportTier?: SupportTier;
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

export interface ScraperHealthSummary {
  totalScrapers: number;
  withFixtures: number;
  withoutFixtures: number;
  fixtureCoverageRate: number;
  gradeCounts: { A: number; B: number; C: number; F: number; errors: number };
  tierCounts: { core: number; experimental: number; manualOnly: number };
  meetsExpectationCount: number;
  belowExpectationCount: number;
}

export interface ScraperHealthReport {
  results: ScraperHealthResult[];
  summary: ScraperHealthSummary;
  timestamp: string;
  fixtureRuntime: 'available' | 'unavailable';
  fixtureRuntimeWarning?: string;
}

async function buildFixtureResolver(): Promise<FixtureResolver> {
  try {
    const { readFileSync, existsSync } = await import('node:fs');
    const { resolve, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const candidateDirs = [
      resolve(__dirname, '..', '..', '..', 'test', 'fixtures'),
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
        if (existsSync(resolve(fixturesDir, `${scraperName}.html`))) return scraperName;
        const legacy = LEGACY_FIXTURE_MAP[scraperName];
        if (legacy && existsSync(resolve(fixturesDir, `${legacy}.html`))) return legacy;
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

function buildSummary(results: ScraperHealthResult[]): ScraperHealthSummary {
  const withFixtures = results.filter((result) => result.hasFixture).length;
  const gradeCounts = {
    A: results.filter((result) => result.grade === 'A').length,
    B: results.filter((result) => result.grade === 'B').length,
    C: results.filter((result) => result.grade === 'C').length,
    F: results.filter((result) => result.grade === 'F').length,
    errors: results.filter((result) => Boolean(result.error)).length,
  };

  return {
    totalScrapers: results.length,
    withFixtures,
    withoutFixtures: results.length - withFixtures,
    fixtureCoverageRate: results.length > 0 ? withFixtures / results.length : 0,
    gradeCounts,
    tierCounts: {
      core: results.filter((result) => result.supportTier === 'core').length,
      experimental: results.filter((result) => result.supportTier === 'experimental').length,
      manualOnly: results.filter((result) => result.supportTier === 'manual-only').length,
    },
    meetsExpectationCount: results.filter((result) => result.meetsExpectation === true).length,
    belowExpectationCount: results.filter((result) => result.meetsExpectation === false).length,
  };
}

export async function buildScraperHealthReport(): Promise<ScraperHealthReport> {
  const results: ScraperHealthResult[] = [];
  const fixtures = await buildFixtureResolver();

  for (const name of allMappingNames()) {
    const portal = findPortalByName(name);
    const portalProfile = await getPortalProfile(name);
    const fixtureName = fixtures.resolveFixtureName(name);
    const country = portal?.country || '??';
    const consecutiveBelowThreshold = portalProfile?.consecutive_below_threshold;

    if (!fixtureName) {
      results.push({
        name,
        country,
        hasFixture: false,
        supportTier: portal?.supportTier,
        expectedExtractionRate: portal?.expectedExtractionRate,
        consecutiveBelowThreshold,
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
      const diagnostics = result.diagnostics;
      const expectedExtractionRate = portal?.expectedExtractionRate;
      const extractionRate = diagnostics?.extractionRate;

      results.push({
        name,
        country,
        hasFixture: true,
        supportTier: portal?.supportTier,
        expectedExtractionRate,
        meetsExpectation:
          typeof extractionRate === 'number' && typeof expectedExtractionRate === 'number'
            ? extractionRate >= expectedExtractionRate
            : undefined,
        consecutiveBelowThreshold,
        grade: diagnostics?.qualityGrade,
        label: diagnostics?.qualityLabel,
        extractionRate,
        weightedRate: diagnostics?.weightedExtractionRate,
        populatedFields: diagnostics?.populatedFields,
        totalFields: diagnostics?.totalFields,
        criticalFieldsMissing: diagnostics?.criticalFieldsMissing,
        emptyFields: diagnostics?.emptyFields,
      });
    } catch (err) {
      results.push({
        name,
        country,
        hasFixture: true,
        supportTier: portal?.supportTier,
        expectedExtractionRate: portal?.expectedExtractionRate,
        consecutiveBelowThreshold,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const gradeOrder: Record<string, number> = { F: 0, C: 1, B: 2, A: 3 };
  results.sort((a, b) => {
    if (a.error && !b.error) return -1;
    if (!a.error && b.error) return 1;
    if (!a.hasFixture && b.hasFixture) return 1;
    if (a.hasFixture && !b.hasFixture) return -1;
    return (gradeOrder[a.grade || 'F'] ?? -1) - (gradeOrder[b.grade || 'F'] ?? -1);
  });

  return {
    results,
    summary: buildSummary(results),
    timestamp: new Date().toISOString(),
    fixtureRuntime: fixtures.available ? 'available' : 'unavailable',
    fixtureRuntimeWarning: fixtures.reason,
  };
}