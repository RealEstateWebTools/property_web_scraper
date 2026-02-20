import type { ExtractionDiagnostics } from '../extractor/html-extractor.js';
import { logActivity } from './activity-logger.js';
import { findPortalByName } from './portal-registry.js';

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

const SCRAPE_PREFIX = 'scrape-meta:';
const LISTING_INDEX_PREFIX = 'scrape-meta:idx:listing:';
const PORTAL_CURRENT_PREFIX = 'portal-meta:current:';
const PORTAL_HISTORY_PREFIX = 'portal-meta:history:';
const PORTAL_HISTORY_INDEX_PREFIX = 'portal-meta:idx:history:';

const MAX_SCRAPES_PER_LISTING = 50;
const MAX_PORTAL_HISTORY_ENTRIES = 100;
const KV_TTL_SECONDS = 365 * 24 * 60 * 60; // 1 year

let kv: {
  put: (key: string, value: string, opts?: { expirationTtl?: number }) => Promise<void>;
  get: (key: string, type?: 'json') => Promise<unknown>;
} | null = null;

const inMemoryScrapes = new Map<string, ScrapeRecord>();
const inMemoryListingIndex = new Map<string, string[]>();
const inMemoryPortalCurrent = new Map<string, PortalProfileCurrent>();
const inMemoryPortalHistory = new Map<string, PortalProfileHistoryEntry[]>();

export function initScrapeMetadataKV(kvNamespace: unknown): void {
  const candidate = kvNamespace as {
    put?: (key: string, value: string, opts?: { expirationTtl?: number }) => Promise<void>;
    get?: (key: string, type?: 'json') => Promise<unknown>;
  } | null;
  if (candidate && typeof candidate.put === 'function' && typeof candidate.get === 'function') {
    kv = {
      put: candidate.put.bind(candidate),
      get: candidate.get.bind(candidate),
    };
    return;
  }
  kv = null;
}

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

  await persistScrape(scrape);
  if (scrape.listing_id) {
    await appendScrapeIndexForListing(scrape.listing_id, scrape.id);
  }

  await updatePortalProfile(scrape);
  return scrape;
}

export async function getLatestScrapeForListing(listingId: string): Promise<ScrapeRecord | undefined> {
  const ids = await getListingIndex(listingId);
  if (ids.length === 0) return undefined;
  return getScrape(ids[0]);
}

export async function getScrapeHistoryForListing(listingId: string, limit = 10): Promise<ScrapeRecord[]> {
  const ids = await getListingIndex(listingId);
  const out: ScrapeRecord[] = [];
  for (const id of ids.slice(0, limit)) {
    const record = await getScrape(id);
    if (record) out.push(record);
  }
  return out;
}

export async function getPortalProfile(portalSlug: string): Promise<PortalProfileCurrent | undefined> {
  if (kv) {
    const data = await kv.get(`${PORTAL_CURRENT_PREFIX}${portalSlug}`, 'json');
    return (data || undefined) as PortalProfileCurrent | undefined;
  }
  return inMemoryPortalCurrent.get(portalSlug);
}

export async function getPortalProfileHistory(portalSlug: string, limit = 20): Promise<PortalProfileHistoryEntry[]> {
  if (kv) {
    const idx = await kv.get(`${PORTAL_HISTORY_INDEX_PREFIX}${portalSlug}`, 'json');
    const ids = (idx || []) as string[];
    const out: PortalProfileHistoryEntry[] = [];
    for (const ts of ids.slice(0, limit)) {
      const entry = await kv.get(`${PORTAL_HISTORY_PREFIX}${portalSlug}:${ts}`, 'json');
      if (entry) out.push(entry as PortalProfileHistoryEntry);
    }
    return out;
  }
  return (inMemoryPortalHistory.get(portalSlug) || []).slice(0, limit);
}

export function clearScrapeMetadata(): void {
  inMemoryScrapes.clear();
  inMemoryListingIndex.clear();
  inMemoryPortalCurrent.clear();
  inMemoryPortalHistory.clear();
}

async function getScrape(id: string): Promise<ScrapeRecord | undefined> {
  if (kv) {
    const data = await kv.get(`${SCRAPE_PREFIX}${id}`, 'json');
    return (data || undefined) as ScrapeRecord | undefined;
  }
  return inMemoryScrapes.get(id);
}

async function persistScrape(scrape: ScrapeRecord): Promise<void> {
  if (kv) {
    await kv.put(`${SCRAPE_PREFIX}${scrape.id}`, JSON.stringify(scrape), { expirationTtl: KV_TTL_SECONDS });
    return;
  }
  inMemoryScrapes.set(scrape.id, scrape);
}

async function getListingIndex(listingId: string): Promise<string[]> {
  if (kv) {
    const data = await kv.get(`${LISTING_INDEX_PREFIX}${listingId}`, 'json');
    return ((data || []) as string[]).slice();
  }
  return (inMemoryListingIndex.get(listingId) || []).slice();
}

async function appendScrapeIndexForListing(listingId: string, scrapeId: string): Promise<void> {
  const ids = await getListingIndex(listingId);
  ids.unshift(scrapeId);
  if (ids.length > MAX_SCRAPES_PER_LISTING) {
    ids.length = MAX_SCRAPES_PER_LISTING;
  }
  if (kv) {
    await kv.put(`${LISTING_INDEX_PREFIX}${listingId}`, JSON.stringify(ids), { expirationTtl: KV_TTL_SECONDS });
    return;
  }
  inMemoryListingIndex.set(listingId, ids);
}

async function updatePortalProfile(scrape: ScrapeRecord): Promise<void> {
  const portalSlug = scrape.portal_slug || scrape.scraper_name;
  if (!portalSlug) return;

  const current = await getPortalProfile(portalSlug);
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
  if (kv) {
    await kv.put(`${PORTAL_CURRENT_PREFIX}${portalSlug}`, JSON.stringify(profile), { expirationTtl: KV_TTL_SECONDS });
    return;
  }
  inMemoryPortalCurrent.set(portalSlug, profile);
}

async function appendPortalHistory(portalSlug: string, entry: PortalProfileHistoryEntry): Promise<void> {
  if (kv) {
    const idx = await kv.get(`${PORTAL_HISTORY_INDEX_PREFIX}${portalSlug}`, 'json');
    const ids = ((idx || []) as string[]).slice();
    const ts = entry.archived_at;
    ids.unshift(ts);
    if (ids.length > MAX_PORTAL_HISTORY_ENTRIES) {
      ids.length = MAX_PORTAL_HISTORY_ENTRIES;
    }
    await kv.put(`${PORTAL_HISTORY_PREFIX}${portalSlug}:${ts}`, JSON.stringify(entry), { expirationTtl: KV_TTL_SECONDS });
    await kv.put(`${PORTAL_HISTORY_INDEX_PREFIX}${portalSlug}`, JSON.stringify(ids), { expirationTtl: KV_TTL_SECONDS });
    return;
  }

  const current = inMemoryPortalHistory.get(portalSlug) || [];
  current.unshift(entry);
  if (current.length > MAX_PORTAL_HISTORY_ENTRIES) {
    current.length = MAX_PORTAL_HISTORY_ENTRIES;
  }
  inMemoryPortalHistory.set(portalSlug, current);
}

function detectTechnologyStack(html: string): string[] {
  const lower = html.toLowerCase();
  const stack: string[] = [];

  if (lower.includes('__next_data__') || lower.includes('/_next/')) stack.push('next.js');
  if (lower.includes('react') || lower.includes('data-reactroot')) stack.push('react');
  if (lower.includes('__nuxt') || lower.includes('nuxt')) stack.push('nuxt');
  if (lower.includes('vue')) stack.push('vue');
  if (lower.includes('ng-version') || lower.includes('angular')) stack.push('angular');
  if (lower.includes('/_astro/')) stack.push('astro');
  if (lower.includes('wp-content') || lower.includes('wordpress')) stack.push('wordpress');
  if (lower.includes('shopify')) stack.push('shopify');

  return uniqueSorted(stack);
}

function detectAntiScrapingSignals(html: string, statusCode?: number): string[] {
  const lower = html.toLowerCase();
  const signals: string[] = [];

  if (statusCode === 429) signals.push('http_429_rate_limit');
  if (lower.includes('captcha')) signals.push('captcha');
  if (lower.includes('cf-chl') || lower.includes('cloudflare') || lower.includes('just a moment')) signals.push('cloudflare_challenge');
  if (lower.includes('datadome')) signals.push('datadome');
  if (lower.includes('perimeterx')) signals.push('perimeterx');
  if (lower.includes('hcaptcha')) signals.push('hcaptcha');
  if (lower.includes('recaptcha')) signals.push('recaptcha');
  if (lower.includes('access denied') || lower.includes('forbidden')) signals.push('access_denied');
  if (lower.includes('bot detection') || lower.includes('automated requests')) signals.push('bot_detection_message');

  return uniqueSorted(signals);
}

function detectRenderMode(stack: string[], appearsJsOnly: boolean, html: string): RenderMode {
  if (html.trim() === '') return 'unknown';
  if (appearsJsOnly) return 'client';
  const lower = html.toLowerCase();
  const likelyHydrated = stack.includes('next.js') || stack.includes('react') || stack.includes('nuxt');
  const hasLargeInlineData = lower.includes('__next_data__') || lower.includes('__initial_state__') || lower.includes('window.page_model');
  if (likelyHydrated && hasLargeInlineData) return 'hybrid';
  if (likelyHydrated) return 'hybrid';
  return 'server';
}

function buildBetterHtmlHint(params: {
  sourceType: ScrapeSourceType;
  appearsJsOnly: boolean;
  appearsBlocked: boolean;
  extractionRate?: number;
  populatedExtractableFields?: number;
  extractableFields?: number;
  antiScrapingSignals: string[];
}): BetterHtmlHint {
  const reasons: string[] = [];

  if (params.appearsJsOnly) {
    reasons.push('The fetched page appears to be a JavaScript shell with little server-rendered content.');
  }
  if (params.appearsBlocked || params.antiScrapingSignals.length > 0) {
    reasons.push('Bot-protection or anti-scraping signals were detected in the source.');
  }
  if (
    typeof params.extractionRate === 'number' &&
    params.extractionRate < 0.5 &&
    (params.extractableFields || 0) > 5
  ) {
    reasons.push('Extraction quality is low for this scrape and could improve with richer HTML.');
  }
  if (
    typeof params.populatedExtractableFields === 'number' &&
    params.populatedExtractableFields === 0 &&
    (params.extractableFields || 0) > 0
  ) {
    reasons.push('No extractable fields were populated from this HTML source.');
  }

  const fromUrlFetch = params.sourceType === 'url_fetch';
  const shouldSuggest = fromUrlFetch && reasons.length > 0;

  return {
    suggested: shouldSuggest,
    reasons,
    recommendation: shouldSuggest
      ? 'Capture fully rendered HTML from your browser and re-run extraction.'
      : 'Current HTML source appears sufficient.',
    suggestedActions: shouldSuggest
      ? [
          'Use the browser helper in /docs/get-html to capture rendered HTML.',
          'Use “Paste HTML” or “Upload File” and rerun extraction.',
          'If blocked, try from a residential network or authenticated browser session.',
        ]
      : [],
  };
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
