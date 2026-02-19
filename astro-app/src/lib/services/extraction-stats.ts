import type { ExtractionDiagnostics } from '../extractor/html-extractor.js';
import type { QualityGrade } from '../extractor/quality-scorer.js';
import { getAllListings, getAllDiagnostics, getDiagnostics } from './listing-store.js';
import { allMappingNames, findByName } from '../extractor/mapping-loader.js';
import { LOCAL_HOST_MAP } from './url-validator.js';

export interface ExtractionSummary {
  id: string;
  timestamp: number;
  scraperName: string;
  sourceUrl: string;
  qualityGrade: QualityGrade;
  qualityLabel: string;
  extractionRate: number;
  weightedExtractionRate?: number;
  populatedExtractableFields: number;
  extractableFields: number;
  meetsExpectation: boolean;
  criticalFieldsMissing?: string[];
  title: string;
  priceString: string;
  visibility: string;
  confidenceScore: number;
  manualOverride: boolean;
}

export interface ScraperStats {
  name: string;
  loaded: boolean;
  hosts: string[];
  fieldCount: number;
  hasImages: boolean;
  hasFeatures: boolean;
  expectedExtractionRate: number | undefined;
  extractionCount: number;
  avgExtractionRate: number;
  lastExtractionTime: number | null;
  lastQualityGrade: QualityGrade | null;
  gradeDistribution: Record<QualityGrade, number>;
  fieldSuccessRates: Record<string, number>;
}

export interface SystemOverview {
  totalExtractions: number;
  gradeDistribution: Record<QualityGrade, number>;
  avgExtractionRate: number;
  recentExtractions: ExtractionSummary[];
  scraperUsage: Record<string, number>;
}

function emptyGradeDistribution(): Record<QualityGrade, number> {
  return { A: 0, B: 0, C: 0, F: 0 };
}

export async function getRecentExtractions(limit = 100): Promise<ExtractionSummary[]> {
  const listings = await getAllListings();
  const allDiags = await getAllDiagnostics();
  const diagMap = new Map(allDiags.map(d => [d.id, d.diagnostics]));

  const summaries: ExtractionSummary[] = [];

  for (const { id, listing } of listings) {
    const diag = diagMap.get(id);
    if (!diag) continue;

    summaries.push({
      id,
      timestamp: (listing as any).last_retrieved_at?.getTime?.() || parseInt(id.split('-')[0], 36),
      scraperName: diag.scraperName,
      sourceUrl: (listing as any).import_url || '',
      qualityGrade: diag.qualityGrade,
      qualityLabel: diag.qualityLabel,
      extractionRate: diag.extractionRate,
      weightedExtractionRate: diag.weightedExtractionRate,
      populatedExtractableFields: diag.populatedExtractableFields,
      extractableFields: diag.extractableFields,
      meetsExpectation: diag.meetsExpectation,
      criticalFieldsMissing: diag.criticalFieldsMissing,
      title: (listing as any).title || '',
      priceString: (listing as any).price_string || '',
      visibility: (listing as any).visibility || diag.visibility || 'published',
      confidenceScore: (listing as any).confidence_score ?? diag.confidenceScore ?? 1.0,
      manualOverride: (listing as any).manual_override || false,
    });
  }

  summaries.sort((a, b) => b.timestamp - a.timestamp);
  return summaries.slice(0, limit);
}

export async function getScraperStats(name: string): Promise<ScraperStats> {
  const mapping = findByName(name);
  const loaded = mapping !== null;

  // Get hosts
  const hosts: string[] = [];
  for (const [host, entry] of Object.entries(LOCAL_HOST_MAP)) {
    if (!host.startsWith('www.')) continue;
    if (entry.scraper_name === name) hosts.push(host);
  }

  // Count fields
  const textFields = Object.keys(mapping?.textFields ?? {});
  const intFields = Object.keys(mapping?.intFields ?? {});
  const floatFields = Object.keys(mapping?.floatFields ?? {});
  const booleanFields = Object.keys(mapping?.booleanFields ?? {});
  const allFields = [...textFields, ...intFields, ...floatFields, ...booleanFields];
  const fieldCount = allFields.length;
  const hasImages = (mapping?.images ?? []).length > 0;
  const hasFeatures = (mapping?.features ?? []).length > 0;
  const expectedExtractionRate = mapping?.expectedExtractionRate;

  // Scan diagnostics for this scraper
  const allDiags = await getAllDiagnostics();
  const scraperDiags = allDiags.filter(d => d.diagnostics.scraperName === name);

  const gradeDistribution = emptyGradeDistribution();
  let rateSum = 0;
  let lastTime: number | null = null;
  let lastGrade: QualityGrade | null = null;

  // Field success tracking
  const fieldPopulated: Record<string, number> = {};
  const fieldTotal: Record<string, number> = {};

  for (const { id, diagnostics } of scraperDiags) {
    gradeDistribution[diagnostics.qualityGrade]++;
    rateSum += diagnostics.extractionRate;

    const ts = parseInt(id.split('-')[0], 36);
    if (lastTime === null || ts > lastTime) {
      lastTime = ts;
      lastGrade = diagnostics.qualityGrade;
    }

    // Track per-field success from field traces
    for (const trace of diagnostics.fieldTraces) {
      const fieldName = trace.field;
      fieldTotal[fieldName] = (fieldTotal[fieldName] || 0) + 1;
      const isEmpty = trace.rawText === '' || trace.value === 0 || trace.value === false || trace.value === '';
      if (!isEmpty) {
        fieldPopulated[fieldName] = (fieldPopulated[fieldName] || 0) + 1;
      }
    }
  }

  const extractionCount = scraperDiags.length;
  const avgExtractionRate = extractionCount > 0 ? rateSum / extractionCount : 0;

  const fieldSuccessRates: Record<string, number> = {};
  for (const field of Object.keys(fieldTotal)) {
    fieldSuccessRates[field] = (fieldPopulated[field] || 0) / fieldTotal[field];
  }

  return {
    name,
    loaded,
    hosts,
    fieldCount,
    hasImages,
    hasFeatures,
    expectedExtractionRate,
    extractionCount,
    avgExtractionRate,
    lastExtractionTime: lastTime,
    lastQualityGrade: lastGrade,
    gradeDistribution,
    fieldSuccessRates,
  };
}

export async function getAllScraperStats(): Promise<ScraperStats[]> {
  const names = allMappingNames();
  const results: ScraperStats[] = [];
  for (const name of names) {
    results.push(await getScraperStats(name));
  }
  return results;
}

export async function getSystemOverview(): Promise<SystemOverview> {
  const extractions = await getRecentExtractions(200);
  const gradeDistribution = emptyGradeDistribution();
  let rateSum = 0;
  const scraperUsage: Record<string, number> = {};

  for (const ext of extractions) {
    gradeDistribution[ext.qualityGrade]++;
    rateSum += ext.extractionRate;
    scraperUsage[ext.scraperName] = (scraperUsage[ext.scraperName] || 0) + 1;
  }

  return {
    totalExtractions: extractions.length,
    gradeDistribution,
    avgExtractionRate: extractions.length > 0 ? rateSum / extractions.length : 0,
    recentExtractions: extractions.slice(0, 10),
    scraperUsage,
  };
}
