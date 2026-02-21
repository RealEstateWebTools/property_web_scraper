import type { ExtractionDiagnostics } from '../extractor/html-extractor.js';
import { logActivity } from './activity-logger.js';
import { findPortalByName } from './portal-registry.js';
import { getClient, getCollectionPrefix } from '../firestore/client.js';
import {
  detectTechnologyStack,
  detectAntiScrapingSignals,
  detectRenderMode,
  buildBetterHtmlHint,
} from './html-analysis.js';

export type ScrapeSourceType =
  | 'url_fetch'
  | 'manual_html'
  | 'html_upload'
  | 'result_html_update'
  | 'api_json_html'
  | 'api_multipart_file'
  | 'api_multipart_html';

export type RenderMode = 'server' | 'client' | 'hybrid' | 'unknown';

export interface BetterHtmlHint {
  suggested: boolean;
  reasons: string[];
  recommendation: string;
  suggestedActions: string[];
}

export interface ScrapeRecord {
  id: string;
  timestamp: string;
  listing_id?: string;
  source_url: string;
  source_host: string;
  scraper_name?: string;
  portal_slug?: string;
  source_type: ScrapeSourceType;
  request_content_type?: string;
  client_user_agent?: string;
  fetch_user_agent?: string;
  fetch_duration_ms?: number;
  response_status?: number;
  response_content_type?: string;
  html_size_bytes: number;
  html_size_kb: number;
  html_hash?: string;   // 16-char SHA-256 hex of raw HTML
  extracted_fields?: number;
  extractable_fields?: number;
  extraction_rate?: number;
  expected_extraction_rate?: number;
  expected_quality_grade?: string;
  quality_grade?: string;
  success_classification?: 'excellent' | 'good' | 'partial' | 'failed';
  meets_expectation?: boolean;
  expectation_gap?: number;
  expectation_status?: 'unknown' | 'above' | 'meets' | 'below' | 'well_below';
  appears_js_only: boolean;
  appears_blocked: boolean;
  technology_stack: string[];
  anti_scraping_signals: string[];
  render_mode: RenderMode;
  better_html_hint: BetterHtmlHint;
}

export interface PortalProfileCurrent {
  portal_slug: string;
  scraper_name?: string;
  updated_at: string;
  first_seen_at: string;
  last_scrape_id: string;
  total_samples: number;
  avg_html_size_bytes: number;
  min_html_size_bytes: number;
  max_html_size_bytes: number;
  avg_fetch_duration_ms?: number;
  avg_extraction_rate?: number;
  expected_extraction_rate?: number;
  expectation_hit_rate?: number;
  consecutive_below_threshold: number;
  js_only_rate: number;
  blocked_rate: number;
  render_mode: RenderMode;
  technology_stack: string[];
  anti_scraping_signals: string[];
  likely_requires_browser_html: boolean;
  last_change_signature: string;
}

export interface PortalProfileHistoryEntry extends PortalProfileCurrent {
  archived_at: string;
  reason: string;
  replaced_by_scrape_id: string;
}

export interface RecordScrapeInput {
  listingId?: string;
  sourceUrl: string;
  html: string;
  sourceType: ScrapeSourceType;
  scraperName?: string;
  portalSlug?: string;
  requestContentType?: string;
  clientUserAgent?: string | null;
  fetchContext?: {
    userAgentUsed?: string;
    durationMs?: number;
    statusCode?: number;
    responseContentType?: string;
  };
  diagnostics?: ExtractionDiagnostics;
  html_hash?: string;
}

const MAX_SCRAPES_PER_LISTING = 50;
const MAX_PORTAL_HISTORY_ENTRIES = 100;

const inMemoryScrapes = new Map<string, ScrapeRecord>();
const inMemoryListingIndex = new Map<string, string[]>();
const inMemoryPortalCurrent = new Map<string, PortalProfileCurrent>();
const inMemoryPortalHistory = new Map<string, PortalProfileHistoryEntry[]>();

// ─── Firestore helpers ──────────────────────────────────────────

async function firestoreSaveScrape(scrape: ScrapeRecord): Promise<void> {
  const db = await getClient();
  const prefix = getCollectionPrefix();
  await db.collection(`${prefix}scrape_records`).doc(scrape.id).set(JSON.parse(JSON.stringify(scrape)));
}

async function firestoreGetScrape(id: string): Promise<ScrapeRecord | undefined> {
  const db = await getClient();
  const prefix = getCollectionPrefix();
  const doc = await db.collection(`${prefix}scrape_records`).doc(id).get();
  if (!doc.exists) return undefined;
  return doc.data() as ScrapeRecord;
}

async function firestoreGetPortalProfile(portalSlug: string): Promise<PortalProfileCurrent | undefined> {
  const db = await getClient();
  const prefix = getCollectionPrefix();
  const doc = await db.collection(`${prefix}portal_profiles`).doc(portalSlug).get();
  if (!doc.exists) return undefined;
  return doc.data() as PortalProfileCurrent;
}

async function firestoreSavePortalProfile(profile: PortalProfileCurrent): Promise<void> {
  const db = await getClient();
  const prefix = getCollectionPrefix();
  await db.collection(`${prefix}portal_profiles`).doc(profile.portal_slug).set(JSON.parse(JSON.stringify(profile)));
}

async function firestoreAppendPortalHistory(portalSlug: string, entry: PortalProfileHistoryEntry): Promise<void> {
  const db = await getClient();
  const prefix = getCollectionPrefix();
  const docId = `${portalSlug}_${entry.archived_at}`;
  await db.collection(`${prefix}portal_profile_history`).doc(docId).set(JSON.parse(JSON.stringify(entry)));
}

async function firestoreGetPortalHistory(portalSlug: string, limit: number): Promise<PortalProfileHistoryEntry[]> {
  const db = await getClient();
  const prefix = getCollectionPrefix();
  const snapshot = await db.collection(`${prefix}portal_profile_history`)
    .where('portal_slug', '==', portalSlug)
    .get();
  const entries = snapshot.docs.map(doc => doc.data() as PortalProfileHistoryEntry);
  entries.sort((a, b) => b.archived_at.localeCompare(a.archived_at));
  return entries.slice(0, limit);
}

// ─── Public API ─────────────────────────────────────────────────

export async function recordScrapeAndUpdatePortal(input: RecordScrapeInput): Promise<ScrapeRecord> {
  const now = new Date().toISOString();
  const url = safeUrl(input.sourceUrl);
  const sourceHost = url?.hostname || '';
  const htmlSize = input.html.length;
  const diagnostics = input.diagnostics;

  const technologyStack = detectTechnologyStack(input.html);
  const antiScrapingSignals = detectAntiScrapingSignals(input.html, input.fetchContext?.statusCode);
  const appearsJsOnly = Boolean(diagnostics?.contentAnalysis?.appearsJsOnly);
  const appearsBlocked = Boolean(diagnostics?.contentAnalysis?.appearsBlocked);
  const renderMode = detectRenderMode(technologyStack, appearsJsOnly, input.html);
  const extractionRate = diagnostics?.extractionRate;

  const betterHtmlHint = buildBetterHtmlHint({
    sourceType: input.sourceType,
    appearsJsOnly,
    appearsBlocked,
    extractionRate,
    populatedExtractableFields: diagnostics?.populatedExtractableFields,
    extractableFields: diagnostics?.extractableFields,
    antiScrapingSignals,
  });

  const scrape: ScrapeRecord = {
    id: generateScrapeId(),
    timestamp: now,
    ...(input.listingId ? { listing_id: input.listingId } : {}),
    source_url: input.sourceUrl,
    source_host: sourceHost,
    ...(input.scraperName ? { scraper_name: input.scraperName } : {}),
    ...(input.portalSlug ? { portal_slug: input.portalSlug } : {}),
    source_type: input.sourceType,
    ...(input.requestContentType ? { request_content_type: input.requestContentType } : {}),
    ...(input.clientUserAgent ? { client_user_agent: input.clientUserAgent } : {}),
    ...(input.fetchContext?.userAgentUsed ? { fetch_user_agent: input.fetchContext.userAgentUsed } : {}),
    ...(typeof input.fetchContext?.durationMs === 'number' ? { fetch_duration_ms: input.fetchContext.durationMs } : {}),
    ...(typeof input.fetchContext?.statusCode === 'number' ? { response_status: input.fetchContext.statusCode } : {}),
    ...(input.fetchContext?.responseContentType ? { response_content_type: input.fetchContext.responseContentType } : {}),
    html_size_bytes: htmlSize,
    html_size_kb: Math.round((htmlSize / 1024) * 100) / 100,
    ...(input.html_hash ? { html_hash: input.html_hash } : {}),
    ...(typeof diagnostics?.populatedExtractableFields === 'number'
      ? { extracted_fields: diagnostics.populatedExtractableFields }
      : {}),
    ...(typeof diagnostics?.extractableFields === 'number'
      ? { extractable_fields: diagnostics.extractableFields }
      : {}),
    ...(typeof extractionRate === 'number' ? { extraction_rate: extractionRate } : {}),
    ...(typeof diagnostics?.expectedExtractionRate === 'number'
      ? { expected_extraction_rate: diagnostics.expectedExtractionRate }
      : {}),
    ...(diagnostics?.expectedQualityGrade ? { expected_quality_grade: diagnostics.expectedQualityGrade } : {}),
    ...(diagnostics?.qualityGrade ? { quality_grade: diagnostics.qualityGrade } : {}),
    ...(diagnostics?.successClassification ? { success_classification: diagnostics.successClassification } : {}),
    ...(typeof diagnostics?.meetsExpectation === 'boolean' ? { meets_expectation: diagnostics.meetsExpectation } : {}),
    ...(typeof diagnostics?.expectationGap === 'number' ? { expectation_gap: diagnostics.expectationGap } : {}),
    ...(diagnostics?.expectationStatus ? { expectation_status: diagnostics.expectationStatus } : {}),
    appears_js_only: appearsJsOnly,
    appears_blocked: appearsBlocked,
    technology_stack: technologyStack,
    anti_scraping_signals: antiScrapingSignals,
    render_mode: renderMode,
    better_html_hint: betterHtmlHint,
  };

  // Persist scrape record to Firestore (fire-and-forget from caller's perspective)
  try {
    await firestoreSaveScrape(scrape);
  } catch {
    inMemoryScrapes.set(scrape.id, scrape);
  }

  // Maintain in-memory listing index as well for fast lookups
  if (scrape.listing_id) {
    const ids = (inMemoryListingIndex.get(scrape.listing_id) || []).slice();
    ids.unshift(scrape.id);
    if (ids.length > MAX_SCRAPES_PER_LISTING) ids.length = MAX_SCRAPES_PER_LISTING;
    inMemoryListingIndex.set(scrape.listing_id, ids);
  }

  await updatePortalProfile(scrape);
  return scrape;
}

export async function getLatestScrapeForListing(listingId: string): Promise<ScrapeRecord | undefined> {
  // Use in-memory index for ordering (newest first), fall back to Firestore for individual records
  const ids = inMemoryListingIndex.get(listingId);
  if (ids && ids.length > 0) {
    const record = inMemoryScrapes.get(ids[0]);
    if (record) return record;
    // Try Firestore for the record if not in memory
    try { return await firestoreGetScrape(ids[0]); } catch { /* fall through */ }
  }
  // No in-memory index: query Firestore and sort by id (which embeds timestamp)
  try {
    const db = await getClient();
    const prefix = getCollectionPrefix();
    const snapshot = await db.collection(`${prefix}scrape_records`)
      .where('listing_id', '==', listingId)
      .get();
    if (snapshot.docs.length === 0) return undefined;
    const records = snapshot.docs.map(doc => doc.data() as ScrapeRecord);
    records.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return records[0];
  } catch {
    return undefined;
  }
}

export async function getScrapeHistoryForListing(listingId: string, limit = 10): Promise<ScrapeRecord[]> {
  // Use in-memory index for ordering (newest first)
  const ids = inMemoryListingIndex.get(listingId);
  if (ids && ids.length > 0) {
    const out: ScrapeRecord[] = [];
    for (const id of ids.slice(0, limit)) {
      const record = inMemoryScrapes.get(id);
      if (record) {
        out.push(record);
      } else {
        try {
          const fsRecord = await firestoreGetScrape(id);
          if (fsRecord) out.push(fsRecord);
        } catch { /* skip */ }
      }
    }
    return out;
  }
  // No in-memory index: query Firestore
  try {
    const db = await getClient();
    const prefix = getCollectionPrefix();
    const snapshot = await db.collection(`${prefix}scrape_records`)
      .where('listing_id', '==', listingId)
      .get();
    const records = snapshot.docs.map(doc => doc.data() as ScrapeRecord);
    records.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return records.slice(0, limit);
  } catch {
    return [];
  }
}

export async function getPortalProfile(portalSlug: string): Promise<PortalProfileCurrent | undefined> {
  try {
    return await firestoreGetPortalProfile(portalSlug);
  } catch {
    return inMemoryPortalCurrent.get(portalSlug);
  }
}

export async function getPortalProfileHistory(portalSlug: string, limit = 20): Promise<PortalProfileHistoryEntry[]> {
  try {
    return await firestoreGetPortalHistory(portalSlug, limit);
  } catch {
    return (inMemoryPortalHistory.get(portalSlug) || []).slice(0, limit);
  }
}

export async function clearScrapeMetadata(): Promise<void> {
  inMemoryScrapes.clear();
  inMemoryListingIndex.clear();
  inMemoryPortalCurrent.clear();
  inMemoryPortalHistory.clear();
  // Clear Firestore state (for test environments)
  try {
    const db = await getClient();
    const prefix = getCollectionPrefix();
    const clearCol = async (name: string) => {
      const snap = await db.collection(`${prefix}${name}`).get();
      for (const doc of snap.docs) {
        await doc.ref.delete();
      }
    };
    await Promise.all([
      clearCol('scrape_records'),
      clearCol('portal_profiles'),
      clearCol('portal_profile_history'),
    ]);
  } catch {
    // Firestore unavailable — in-memory already cleared above
  }
}

// ─── Private helpers ─────────────────────────────────────────────

async function updatePortalProfile(scrape: ScrapeRecord): Promise<void> {
  const portalSlug = scrape.portal_slug || scrape.scraper_name;
  if (!portalSlug) return;

  let current: PortalProfileCurrent | undefined;
  try {
    current = await firestoreGetPortalProfile(portalSlug);
  } catch {
    current = inMemoryPortalCurrent.get(portalSlug);
  }

  const now = new Date().toISOString();
  const signature = computeSignature(scrape);

  if (!current) {
    const belowThreshold = scrape.meets_expectation === false ? 1 : 0;
    const created: PortalProfileCurrent = {
      portal_slug: portalSlug,
      ...(scrape.scraper_name ? { scraper_name: scrape.scraper_name } : {}),
      updated_at: now,
      first_seen_at: now,
      last_scrape_id: scrape.id,
      total_samples: 1,
      avg_html_size_bytes: scrape.html_size_bytes,
      min_html_size_bytes: scrape.html_size_bytes,
      max_html_size_bytes: scrape.html_size_bytes,
      ...(typeof scrape.fetch_duration_ms === 'number' ? { avg_fetch_duration_ms: scrape.fetch_duration_ms } : {}),
      ...(typeof scrape.extraction_rate === 'number' ? { avg_extraction_rate: scrape.extraction_rate } : {}),
      ...(typeof scrape.expected_extraction_rate === 'number' ? { expected_extraction_rate: scrape.expected_extraction_rate } : {}),
      ...(typeof scrape.meets_expectation === 'boolean' ? { expectation_hit_rate: scrape.meets_expectation ? 1 : 0 } : {}),
      consecutive_below_threshold: belowThreshold,
      js_only_rate: scrape.appears_js_only ? 1 : 0,
      blocked_rate: scrape.appears_blocked ? 1 : 0,
      render_mode: scrape.render_mode,
      technology_stack: scrape.technology_stack,
      anti_scraping_signals: scrape.anti_scraping_signals,
      likely_requires_browser_html: scrape.better_html_hint.suggested,
      last_change_signature: signature,
    };
    await persistPortalCurrent(portalSlug, created);
    return;
  }

  if (current.last_change_signature !== signature) {
    const archive: PortalProfileHistoryEntry = {
      ...current,
      archived_at: now,
      reason: 'detected_profile_change',
      replaced_by_scrape_id: scrape.id,
    };
    await appendPortalHistory(portalSlug, archive);
  }

  const total = current.total_samples + 1;
  const nextAvgSize = rollingAverage(current.avg_html_size_bytes, current.total_samples, scrape.html_size_bytes);
  const nextAvgFetch = mergeOptionalAverage(current.avg_fetch_duration_ms, current.total_samples, scrape.fetch_duration_ms, total);
  const nextAvgExtraction = mergeOptionalAverage(current.avg_extraction_rate, current.total_samples, scrape.extraction_rate, total);
  const nextExpectationHitRate = mergeOptionalAverage(
    current.expectation_hit_rate,
    current.total_samples,
    typeof scrape.meets_expectation === 'boolean' ? (scrape.meets_expectation ? 1 : 0) : undefined,
    total
  );

  // Track consecutive below-threshold scrapes
  let consecutiveBelow = current.consecutive_below_threshold ?? 0;
  if (scrape.meets_expectation === false) {
    consecutiveBelow++;
  } else if (scrape.meets_expectation === true) {
    consecutiveBelow = 0;
  }

  // Emit warning when threshold is exceeded
  if (consecutiveBelow >= 5 && scrape.meets_expectation === false) {
    const portal = findPortalByName(portalSlug);
    const currentTier = portal?.supportTier || 'unknown';
    logActivity({
      level: 'warn',
      category: 'quality',
      message: `Portal ${portalSlug} has failed quality threshold ${consecutiveBelow} consecutive times — consider downgrading from ${currentTier} to experimental`,
    });
  }

  const updated: PortalProfileCurrent = {
    ...current,
    updated_at: now,
    last_scrape_id: scrape.id,
    total_samples: total,
    avg_html_size_bytes: nextAvgSize,
    min_html_size_bytes: Math.min(current.min_html_size_bytes, scrape.html_size_bytes),
    max_html_size_bytes: Math.max(current.max_html_size_bytes, scrape.html_size_bytes),
    ...(nextAvgFetch != null ? { avg_fetch_duration_ms: nextAvgFetch } : {}),
    ...(nextAvgExtraction != null ? { avg_extraction_rate: nextAvgExtraction } : {}),
    ...(typeof scrape.expected_extraction_rate === 'number'
      ? { expected_extraction_rate: scrape.expected_extraction_rate }
      : (typeof current.expected_extraction_rate === 'number' ? { expected_extraction_rate: current.expected_extraction_rate } : {})),
    ...(nextExpectationHitRate != null ? { expectation_hit_rate: nextExpectationHitRate } : {}),
    consecutive_below_threshold: consecutiveBelow,
    js_only_rate: rollingAverage(current.js_only_rate, current.total_samples, scrape.appears_js_only ? 1 : 0),
    blocked_rate: rollingAverage(current.blocked_rate, current.total_samples, scrape.appears_blocked ? 1 : 0),
    render_mode: scrape.render_mode,
    technology_stack: scrape.technology_stack,
    anti_scraping_signals: scrape.anti_scraping_signals,
    likely_requires_browser_html: current.likely_requires_browser_html || scrape.better_html_hint.suggested,
    last_change_signature: signature,
  };

  await persistPortalCurrent(portalSlug, updated);
}

async function persistPortalCurrent(portalSlug: string, profile: PortalProfileCurrent): Promise<void> {
  inMemoryPortalCurrent.set(portalSlug, profile);
  try {
    await firestoreSavePortalProfile(profile);
  } catch {
    // In-memory fallback already set above
  }
}

async function appendPortalHistory(portalSlug: string, entry: PortalProfileHistoryEntry): Promise<void> {
  const current = inMemoryPortalHistory.get(portalSlug) || [];
  current.unshift(entry);
  if (current.length > MAX_PORTAL_HISTORY_ENTRIES) {
    current.length = MAX_PORTAL_HISTORY_ENTRIES;
  }
  inMemoryPortalHistory.set(portalSlug, current);

  try {
    await firestoreAppendPortalHistory(portalSlug, entry);
  } catch {
    // In-memory fallback already set above
  }
}

function computeSignature(scrape: ScrapeRecord): string {
  return JSON.stringify({
    render_mode: scrape.render_mode,
    technology_stack: uniqueSorted(scrape.technology_stack),
    anti_scraping_signals: uniqueSorted(scrape.anti_scraping_signals),
    likely_requires_browser_html: scrape.better_html_hint.suggested,
  });
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort();
}

function generateScrapeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function safeUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function rollingAverage(currentAvg: number, currentCount: number, nextValue: number): number {
  return ((currentAvg * currentCount) + nextValue) / (currentCount + 1);
}

function mergeOptionalAverage(
  currentAvg: number | undefined,
  currentCount: number,
  nextValue: number | undefined,
  nextCount: number
): number | undefined {
  if (typeof nextValue !== 'number') return currentAvg;
  if (typeof currentAvg !== 'number') return nextValue;
  return ((currentAvg * currentCount) + nextValue) / nextCount;
}
