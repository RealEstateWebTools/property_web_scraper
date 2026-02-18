/**
 * Shared extraction pipeline used by both the public API and haul endpoints.
 * Extracted from listings.ts to avoid duplication.
 */

import { extractFromHtml } from '@lib/extractor/html-extractor.js';
import { Listing } from '@lib/models/listing.js';
import { findPortalByHost } from '@lib/services/portal-registry.js';
import { normalizePrice } from '@lib/extractor/price-normalizer.js';
import { generateId, storeListing, storeDiagnostics, initKV } from '@lib/services/listing-store.js';
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
}

export async function runExtraction(opts: {
  html: string;
  url: string;
  scraperMapping: ScraperMapping;
  importHost: ImportHost;
}): Promise<ExtractionResult | null> {
  const { html, url, scraperMapping, importHost } = opts;

  const result = extractFromHtml({
    html,
    sourceUrl: url,
    scraperMapping,
  });

  if (!result.success || result.properties.length === 0) {
    return null;
  }

  const listing = new Listing();
  listing.assignAttributes({ import_url: url });
  listing.import_host_slug = importHost.slug;
  listing.last_retrieved_at = new Date();
  Listing.updateFromHash(listing, result.properties[0]);

  // Price normalization using portal's default currency
  try {
    const parsedUrl = new URL(url);
    const portal = findPortalByHost(parsedUrl.hostname);
    const normalized = normalizePrice(
      listing.price_string || '',
      listing.price_float || 0,
      portal?.currency,
    );
    listing.price_cents = normalized.priceCents;
    listing.price_currency = normalized.currency;
  } catch { /* URL parse failed, skip price normalization */ }

  const fieldsExtracted = countExtractedFields(result.properties[0]);
  const fieldsAvailable = countAvailableFields(scraperMapping);

  // Store result in KV for the /extract/results page
  const resultId = generateId();
  try {
    initKV(undefined); // use in-memory store; KV binding not available in API routes
    await storeListing(resultId, listing);
    if (result.diagnostics) {
      await storeDiagnostics(resultId, result.diagnostics);
    }
  } catch { /* listing-store failure shouldn't affect API response */ }

  return {
    listing,
    resultId,
    resultsUrl: `/extract/results/${resultId}`,
    fieldsExtracted,
    fieldsAvailable,
    diagnostics: result.diagnostics,
    rawProps: result.properties[0],
    splitSchema: result.splitSchema,
  };
}
