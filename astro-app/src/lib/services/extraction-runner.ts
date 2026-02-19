/**
 * Shared extraction pipeline used by both the public API and haul endpoints.
 * Extracted from listings.ts to avoid duplication.
 */

import { extractFromHtml } from '@lib/extractor/html-extractor.js';
import { Listing } from '@lib/models/listing.js';
import type { MergeDiff } from '@lib/models/listing.js';
import { findPortalByHost } from '@lib/services/portal-registry.js';
import { normalizePrice } from '@lib/extractor/price-normalizer.js';
import { generateStableId, getListingByUrl, storeListing, storeDiagnostics, initKV } from '@lib/services/listing-store.js';
import { recordSnapshot } from '@lib/services/price-history.js';
import { recordScrapeAndUpdatePortal } from '@lib/services/scrape-metadata.js';
import type { ScrapeSourceType } from '@lib/services/scrape-metadata.js';
import type { ScraperMapping } from '@lib/extractor/mapping-loader.js';
import type { ExtractionDiagnostics } from '@lib/extractor/html-extractor.js';
import type { ImportHost } from '@lib/models/import-host.js';

export function countAvailableFields(mapping: ScraperMapping): number {
  let count = 0;
  if (mapping.textFields) count += Object.keys(mapping.textFields).length;
  if (mapping.intFields) count += Object.keys(mapping.intFields).length;
  if (mapping.floatFields) count += Object.keys(mapping.floatFields).length;
  if (mapping.booleanFields) count += Object.keys(mapping.booleanFields).length;
  if (mapping.images) count += mapping.images.length;
  if (mapping.features) count += mapping.features.length;
  return count;
}

export function countExtractedFields(props: Record<string, unknown>): number {
  let count = 0;
  for (const [, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === '' || value === 0 || value === false) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    count++;
  }
  return count;
}

export interface ExtractionResult {
  listing: Listing;
  resultId: string;
  resultsUrl: string;
  fieldsExtracted: number;
  fieldsAvailable: number;
  diagnostics: ExtractionDiagnostics | undefined;
  rawProps: Record<string, unknown>;
  splitSchema?: unknown;
  mergeDiff?: MergeDiff;
  wasExistingListing: boolean;
}

export async function runExtraction(opts: {
  html: string;
  url: string;
  scraperMapping: ScraperMapping;
  importHost: ImportHost;
  sourceType?: ScrapeSourceType;
}): Promise<ExtractionResult | null> {
  const { html, url, scraperMapping, importHost, sourceType } = opts;

  const result = extractFromHtml({
    html,
    sourceUrl: url,
    scraperMapping,
  });

  if (!result.success || result.properties.length === 0) {
    return null;
  }

  // Build incoming listing from extraction
  const incoming = new Listing();
  incoming.assignAttributes({ import_url: url });
  incoming.import_host_slug = importHost.slug;
  incoming.last_retrieved_at = new Date();
  Listing.updateFromHash(incoming, result.properties[0]);

  // Price normalization using portal's default currency
  try {
    const parsedUrl = new URL(url);
    const portal = findPortalByHost(parsedUrl.hostname);
    const normalized = normalizePrice(
      incoming.price_string || '',
      incoming.price_float || 0,
      portal?.currency,
    );
    incoming.price_cents = normalized.priceCents;
    incoming.price_currency = normalized.currency;
  } catch { /* URL parse failed, skip price normalization */ }

  const fieldsExtracted = countExtractedFields(result.properties[0]);
  const fieldsAvailable = countAvailableFields(scraperMapping);

  // Dedup: look up existing listing by URL
  let listing: Listing;
  let resultId: string;
  let wasExistingListing = false;
  let mergeDiff: MergeDiff | undefined;

  try {
    initKV(undefined);
    const existing = await getListingByUrl(url);
    if (existing) {
      // Merge incoming into existing
      mergeDiff = Listing.mergeIntoListing(existing.listing, incoming);
      listing = existing.listing;
      resultId = existing.id;
      wasExistingListing = true;
    } else {
      listing = incoming;
      resultId = generateStableId(url);
    }

    if (result.diagnostics) {
      Listing.applyDiagnostics(listing, result.diagnostics);
    }
    listing.id = resultId;
    await storeListing(resultId, listing);
    if (result.diagnostics) {
      await storeDiagnostics(resultId, result.diagnostics);
    }
    try { await listing.save(); } catch { /* Firestore unavailable */ }
  } catch {
    // Fallback: use incoming as-is with stable ID
    listing = incoming;
    resultId = generateStableId(url);
    if (result.diagnostics) {
      Listing.applyDiagnostics(listing, result.diagnostics);
    }
    listing.id = resultId;
    try {
      await storeListing(resultId, listing);
      if (result.diagnostics) {
        await storeDiagnostics(resultId, result.diagnostics);
      }
      try { await listing.save(); } catch { /* Firestore unavailable */ }
    } catch { /* listing-store failure shouldn't affect API response */ }
  }

  // Record price snapshot (fire-and-forget)
  const rawProps = result.properties[0];
  recordSnapshot({
    url,
    scraper: importHost.scraper_name,
    price_float: rawProps.price_float,
    price_string: rawProps.price_string,
    price_currency: rawProps.price_currency || rawProps.currency,
    quality_grade: result.diagnostics?.qualityGrade,
    title: rawProps.title,
  }).catch(() => { /* price history failure shouldn't affect response */ });

  // Record scrape metadata (fire-and-forget)
  if (sourceType) {
    recordScrapeAndUpdatePortal({
      listingId: resultId,
      sourceUrl: url,
      html,
      sourceType,
      scraperName: importHost.scraper_name,
      portalSlug: importHost.slug,
      diagnostics: result.diagnostics,
    }).catch(() => { /* scrape metadata failure shouldn't affect response */ });
  }

  return {
    listing,
    resultId,
    resultsUrl: `/extract/results/${resultId}`,
    fieldsExtracted,
    fieldsAvailable,
    diagnostics: result.diagnostics,
    rawProps,
    splitSchema: result.splitSchema,
    mergeDiff,
    wasExistingListing,
  };
}
