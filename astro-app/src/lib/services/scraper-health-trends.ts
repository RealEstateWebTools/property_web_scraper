/**
 * Scraper Health Trends Service
 * Records per-scraper quality snapshots over time and computes rolling trends.
 *
 * Firestore collection: {prefix}scraper_health
 */

import { getClient, getCollectionPrefix } from '../firestore/client.js';
import type { ExtractionDiagnostics } from '../extractor/html-extractor.js';
import type { QualityGrade } from '../extractor/quality-scorer.js';

export interface HealthSnapshot {
  id: string;
  timestamp: number;
  scraperName: string;
  qualityGrade: QualityGrade;
  extractionRate: number;
  weightedExtractionRate?: number;
  populatedFields: number;
  totalFields: number;
  meetsExpectation: boolean;
  criticalFieldsMissing?: string[];
  sourceUrl?: string;
  confidenceScore: number;
}

export type TrendDirection = 'improving' | 'stable' | 'declining';

export interface ScraperTrend {
  scraperName: string;
  snapshotCount: number;
  latestGrade: QualityGrade;
  averageExtractionRate: number;
  averageWeightedRate: number;
  trendDirection: TrendDirection;
  latestTimestamp: number;
  gradeDistribution: Record<string, number>;
}

const MAX_MEMORY_ENTRIES = 500;
const memoryStore: HealthSnapshot[] = [];

function generateSnapshotId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export async function recordHealthSnapshot(
  diagnostics: ExtractionDiagnostics,
  sourceUrl?: string,
): Promise<void> {
  const snapshot: HealthSnapshot = {
    id: generateSnapshotId(),
    timestamp: Date.now(),
    scraperName: diagnostics.scraperName,
    qualityGrade: diagnostics.qualityGrade,
    extractionRate: diagnostics.extractionRate,
    weightedExtractionRate: diagnostics.weightedExtractionRate,
    populatedFields: diagnostics.populatedFields,
    totalFields: diagnostics.totalFields,
    meetsExpectation: diagnostics.meetsExpectation,
    criticalFieldsMissing: diagnostics.criticalFieldsMissing,
    sourceUrl,
    confidenceScore: diagnostics.confidenceScore ?? 1.0,
  };

  // In-memory store
  memoryStore.unshift(snapshot);
  if (memoryStore.length > MAX_MEMORY_ENTRIES) {
    memoryStore.length = MAX_MEMORY_ENTRIES;
  }

  // Firestore persistence (fire-and-forget)
  try {
    const db = await getClient();
    const prefix = getCollectionPrefix();
    await db.collection(`${prefix}scraper_health`).doc(snapshot.id).set(JSON.parse(JSON.stringify(snapshot)));
  } catch {
    // Firestore unavailable — in-memory record still exists
  }
}

async function getAllSnapshots(days?: number): Promise<HealthSnapshot[]> {
  let snapshots: HealthSnapshot[];

  try {
    const db = await getClient();
    const prefix = getCollectionPrefix();
    const snapshot = await db.collection(`${prefix}scraper_health`).get();
    snapshots = snapshot.docs.map(doc => doc.data() as unknown as HealthSnapshot);
  } catch {
    snapshots = [...memoryStore];
  }

  if (days) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    snapshots = snapshots.filter(s => s.timestamp >= cutoff);
  }

  snapshots.sort((a, b) => b.timestamp - a.timestamp);
  return snapshots;
}

function computeTrendDirection(snapshots: HealthSnapshot[]): TrendDirection {
  if (snapshots.length < 3) return 'stable';

  // Compare the average rate of the most recent third vs the oldest third
  const third = Math.ceil(snapshots.length / 3);
  const recent = snapshots.slice(0, third);
  const oldest = snapshots.slice(-third);

  const recentAvg = recent.reduce((sum, s) => sum + s.extractionRate, 0) / recent.length;
  const oldestAvg = oldest.reduce((sum, s) => sum + s.extractionRate, 0) / oldest.length;

  const diff = recentAvg - oldestAvg;
  if (diff > 0.05) return 'improving';
  if (diff < -0.05) return 'declining';
  return 'stable';
}

export async function getScraperTrend(scraperName: string, days = 30): Promise<ScraperTrend | null> {
  const all = await getAllSnapshots(days);
  const snapshots = all.filter(s => s.scraperName === scraperName);

  if (snapshots.length === 0) return null;

  const gradeDistribution: Record<string, number> = {};
  let totalRate = 0;
  let totalWeighted = 0;
  let weightedCount = 0;

  for (const s of snapshots) {
    gradeDistribution[s.qualityGrade] = (gradeDistribution[s.qualityGrade] || 0) + 1;
    totalRate += s.extractionRate;
    if (s.weightedExtractionRate != null) {
      totalWeighted += s.weightedExtractionRate;
      weightedCount++;
    }
  }

  return {
    scraperName,
    snapshotCount: snapshots.length,
    latestGrade: snapshots[0].qualityGrade,
    averageExtractionRate: totalRate / snapshots.length,
    averageWeightedRate: weightedCount > 0 ? totalWeighted / weightedCount : 0,
    trendDirection: computeTrendDirection(snapshots),
    latestTimestamp: snapshots[0].timestamp,
    gradeDistribution,
  };
}

export async function getAllScraperTrends(days = 30): Promise<ScraperTrend[]> {
  const all = await getAllSnapshots(days);

  // Group by scraper name
  const grouped = new Map<string, HealthSnapshot[]>();
  for (const s of all) {
    const list = grouped.get(s.scraperName) || [];
    list.push(s);
    grouped.set(s.scraperName, list);
  }

  const trends: ScraperTrend[] = [];
  for (const [scraperName, snapshots] of grouped) {
    const gradeDistribution: Record<string, number> = {};
    let totalRate = 0;
    let totalWeighted = 0;
    let weightedCount = 0;

    for (const s of snapshots) {
      gradeDistribution[s.qualityGrade] = (gradeDistribution[s.qualityGrade] || 0) + 1;
      totalRate += s.extractionRate;
      if (s.weightedExtractionRate != null) {
        totalWeighted += s.weightedExtractionRate;
        weightedCount++;
      }
    }

    trends.push({
      scraperName,
      snapshotCount: snapshots.length,
      latestGrade: snapshots[0].qualityGrade,
      averageExtractionRate: totalRate / snapshots.length,
      averageWeightedRate: weightedCount > 0 ? totalWeighted / weightedCount : 0,
      trendDirection: computeTrendDirection(snapshots),
      latestTimestamp: snapshots[0].timestamp,
      gradeDistribution,
    });
  }

  // Sort by scraper name
  trends.sort((a, b) => a.scraperName.localeCompare(b.scraperName));
  return trends;
}
