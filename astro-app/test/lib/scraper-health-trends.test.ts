/**
 * Tests for scraper-health-trends.ts — in-memory health snapshots, trend
 * computation, and aggregation functions.
 *
 * Note: the module-level memoryStore accumulates across tests; each test uses
 * a unique scraperName to avoid cross-test interference.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Firestore so tests run without real infrastructure
vi.mock('../../src/lib/firestore/client.js', () => ({
  getClient: vi.fn().mockRejectedValue(new Error('Firestore unavailable in tests')),
  getCollectionPrefix: vi.fn().mockReturnValue('test_'),
}));

import {
  recordHealthSnapshot,
  getScraperTrend,
  getAllScraperTrends,
} from '../../src/lib/services/scraper-health-trends.js';
import type { ExtractionDiagnostics } from '../../src/lib/extractor/html-extractor.js';

// Unique counter to generate isolated scraper names per test
let counter = 0;
function uniqueScraper(): string {
  return `test_scraper_${Date.now()}_${++counter}`;
}

function makeDiagnostics(
  scraperName: string,
  overrides: Partial<ExtractionDiagnostics> = {},
): ExtractionDiagnostics {
  return {
    scraperName,
    qualityGrade: 'B',
    extractionRate: 0.75,
    populatedFields: 15,
    totalFields: 20,
    meetsExpectation: true,
    criticalFieldsMissing: [],
    emptyFields: [],
    populatedFieldsList: [],
    confidenceScore: 0.9,
    weightedExtractionRate: 0.8,
    fieldScores: {},
    ...overrides,
  } as ExtractionDiagnostics;
}

describe('recordHealthSnapshot', () => {
  it('records a snapshot without error', async () => {
    const name = uniqueScraper();
    await expect(recordHealthSnapshot(makeDiagnostics(name))).resolves.toBeUndefined();
  });

  it('snapshot appears in getScraperTrend after recording', async () => {
    const name = uniqueScraper();
    await recordHealthSnapshot(makeDiagnostics(name, { qualityGrade: 'A', extractionRate: 0.95 }));

    const trend = await getScraperTrend(name, 365);

    expect(trend).not.toBeNull();
    expect(trend!.scraperName).toBe(name);
    expect(trend!.snapshotCount).toBeGreaterThanOrEqual(1);
    expect(trend!.latestGrade).toBe('A');
  });

  it('accepts optional sourceUrl', async () => {
    const name = uniqueScraper();
    await expect(
      recordHealthSnapshot(makeDiagnostics(name), 'https://example.com/listing/1'),
    ).resolves.toBeUndefined();
  });

  it('defaults qualityGrade to F when not provided', async () => {
    const name = uniqueScraper();
    const diag = makeDiagnostics(name, { qualityGrade: undefined as any });
    await recordHealthSnapshot(diag);

    const trend = await getScraperTrend(name, 365);
    expect(trend!.latestGrade).toBe('F');
  });
});

describe('getScraperTrend', () => {
  it('returns null for a scraper with no snapshots', async () => {
    const trend = await getScraperTrend('completely_nonexistent_scraper_xyz', 30);
    expect(trend).toBeNull();
  });

  it('returns trend with correct averageExtractionRate', async () => {
    const name = uniqueScraper();
    await recordHealthSnapshot(makeDiagnostics(name, { extractionRate: 0.6 }));
    await recordHealthSnapshot(makeDiagnostics(name, { extractionRate: 0.8 }));

    const trend = await getScraperTrend(name, 365);

    expect(trend).not.toBeNull();
    expect(trend!.snapshotCount).toBeGreaterThanOrEqual(2);
    // Average should be between 0.6 and 0.8
    expect(trend!.averageExtractionRate).toBeGreaterThan(0.5);
    expect(trend!.averageExtractionRate).toBeLessThanOrEqual(1.0);
  });

  it('reports gradeDistribution correctly', async () => {
    const name = uniqueScraper();
    await recordHealthSnapshot(makeDiagnostics(name, { qualityGrade: 'A' }));
    await recordHealthSnapshot(makeDiagnostics(name, { qualityGrade: 'A' }));
    await recordHealthSnapshot(makeDiagnostics(name, { qualityGrade: 'C' }));

    const trend = await getScraperTrend(name, 365);

    expect(trend!.gradeDistribution['A']).toBeGreaterThanOrEqual(2);
    expect(trend!.gradeDistribution['C']).toBeGreaterThanOrEqual(1);
  });

  it('reports latestTimestamp', async () => {
    const name = uniqueScraper();
    const before = Date.now();
    await recordHealthSnapshot(makeDiagnostics(name));
    const after = Date.now();

    const trend = await getScraperTrend(name, 365);

    expect(trend!.latestTimestamp).toBeGreaterThanOrEqual(before);
    expect(trend!.latestTimestamp).toBeLessThanOrEqual(after + 100);
  });

  it('trend with fewer than 3 snapshots is stable', async () => {
    const name = uniqueScraper();
    await recordHealthSnapshot(makeDiagnostics(name, { extractionRate: 0.5 }));
    await recordHealthSnapshot(makeDiagnostics(name, { extractionRate: 0.9 }));

    const trend = await getScraperTrend(name, 365);

    expect(trend!.trendDirection).toBe('stable');
  });

  it('trend direction is improving when recent rates are higher', async () => {
    const name = uniqueScraper();
    // 6 snapshots: older ones low, newer ones high
    // recordHealthSnapshot unshifts into memoryStore so first-recorded = oldest in array
    await recordHealthSnapshot(makeDiagnostics(name, { extractionRate: 0.2 }));
    await recordHealthSnapshot(makeDiagnostics(name, { extractionRate: 0.2 }));
    await recordHealthSnapshot(makeDiagnostics(name, { extractionRate: 0.2 }));
    await recordHealthSnapshot(makeDiagnostics(name, { extractionRate: 0.9 }));
    await recordHealthSnapshot(makeDiagnostics(name, { extractionRate: 0.9 }));
    await recordHealthSnapshot(makeDiagnostics(name, { extractionRate: 0.9 }));

    const trend = await getScraperTrend(name, 365);

    // Snapshots are sorted newest-first; newest third has rate 0.9, oldest third has 0.2
    expect(trend!.trendDirection).toBe('improving');
  });

  it('trend direction is declining when recent rates are lower', async () => {
    const name = uniqueScraper();
    await recordHealthSnapshot(makeDiagnostics(name, { extractionRate: 0.9 }));
    await recordHealthSnapshot(makeDiagnostics(name, { extractionRate: 0.9 }));
    await recordHealthSnapshot(makeDiagnostics(name, { extractionRate: 0.9 }));
    await recordHealthSnapshot(makeDiagnostics(name, { extractionRate: 0.2 }));
    await recordHealthSnapshot(makeDiagnostics(name, { extractionRate: 0.2 }));
    await recordHealthSnapshot(makeDiagnostics(name, { extractionRate: 0.2 }));

    const trend = await getScraperTrend(name, 365);

    expect(trend!.trendDirection).toBe('declining');
  });

  it('includes averageWeightedRate when weightedExtractionRate is present', async () => {
    const name = uniqueScraper();
    await recordHealthSnapshot(
      makeDiagnostics(name, { extractionRate: 0.7, weightedExtractionRate: 0.85 }),
    );

    const trend = await getScraperTrend(name, 365);

    expect(trend!.averageWeightedRate).toBeGreaterThan(0);
  });
});

describe('getAllScraperTrends', () => {
  it('returns an array', async () => {
    const trends = await getAllScraperTrends(365);
    expect(Array.isArray(trends)).toBe(true);
  });

  it('includes a recently recorded scraper', async () => {
    const name = uniqueScraper();
    await recordHealthSnapshot(makeDiagnostics(name));

    const trends = await getAllScraperTrends(365);
    const names = trends.map(t => t.scraperName);

    expect(names).toContain(name);
  });

  it('returns trends sorted by scraperName', async () => {
    const trends = await getAllScraperTrends(365);
    const names = trends.map(t => t.scraperName);
    const sorted = [...names].sort();
    expect(names).toEqual(sorted);
  });

  it('each trend has required fields', async () => {
    const name = uniqueScraper();
    await recordHealthSnapshot(makeDiagnostics(name));

    const trends = await getAllScraperTrends(365);
    const trend = trends.find(t => t.scraperName === name)!;

    expect(trend).toBeDefined();
    expect(typeof trend.snapshotCount).toBe('number');
    expect(typeof trend.averageExtractionRate).toBe('number');
    expect(typeof trend.trendDirection).toBe('string');
    expect(typeof trend.latestTimestamp).toBe('number');
    expect(typeof trend.gradeDistribution).toBe('object');
  });
});
