import { validateUrl, UNSUPPORTED } from './url-validator.js';
import { extractFromHtml } from '../extractor/html-extractor.js';
import type { ExtractionDiagnostics } from '../extractor/html-extractor.js';
import { findByName } from '../extractor/mapping-loader.js';
import { Listing } from '../models/listing.js';
import { WhereChain } from '../firestore/base-model.js';
import { logActivity } from './activity-logger.js';
import { findPortalByHost } from './portal-registry.js';
import { normalizePrice } from '../extractor/price-normalizer.js';
import { findListingByUrl, getListing } from './listing-store.js';

export interface RetrievalResult {
  success: boolean;
  errorMessage?: string;
  retrievedListing?: Listing;
  diagnostics?: ExtractionDiagnostics;
}

/**
 * High-level service for retrieving a property listing by URL.
 * Port of Ruby ListingRetriever.
 * Falls back to in-memory Listing when Firestore is unavailable.
 */
export async function retrieveListing(
  importUrl: string,
  html?: string
): Promise<RetrievalResult> {
  logActivity({
    level: 'info',
    category: 'extraction',
    message: `Starting retrieval for URL: "${importUrl}", html: ${html ? `${html.length} chars` : 'none'}`,
    sourceUrl: importUrl,
  });

  const validation = await validateUrl(importUrl);
  if (!validation.valid || !validation.importHost) {
    // Fall back to generic_real_estate scraper for unsupported URLs with HTML
    if (validation.errorCode === UNSUPPORTED && html) {
      logActivity({
        level: 'info',
        category: 'extraction',
        message: `No portal found — falling back to generic_real_estate`,
        sourceUrl: importUrl,
      });
      const genericMapping = findByName('generic_real_estate');
      if (genericMapping) {
        // Build a synthetic importHost for the generic fallback
        const syntheticHost = { slug: 'generic', scraper_name: 'generic_real_estate' };
        const result = extractFromHtml({
          html,
          sourceUrl: importUrl,
          scraperMappingName: 'generic_real_estate',
        });
        const diagnostics = result.diagnostics;
        if (result.success && result.properties.length > 0) {
          const listing = new Listing();
          listing.assignAttributes({ import_url: importUrl });
          listing.import_host_slug = syntheticHost.slug;
          listing.last_retrieved_at = new Date();
          Listing.updateFromHash(listing, result.properties[0]);
          if (diagnostics && !(listing as any).manual_override) {
            listing.confidence_score = diagnostics.confidenceScore;
            listing.visibility = diagnostics.visibility;
          }
          if (diagnostics) {
            Listing.applyDiagnostics(listing, diagnostics);
          }
          return { success: true, retrievedListing: listing, diagnostics };
        }
        return { success: true, retrievedListing: new Listing(), diagnostics };
      }
    }
    const errorMessage = validation.errorCode === UNSUPPORTED
      ? 'Unsupported Url'
      : 'Invalid Url';
    logActivity({
      level: 'warn',
      category: 'extraction',
      message: `URL validation failed: ${errorMessage}`,
      sourceUrl: importUrl,
    });
    return { success: false, errorMessage };
  }

  const importHost = validation.importHost;
  logActivity({
    level: 'info',
    category: 'extraction',
    message: `Matched import host: slug="${importHost.slug}", scraper="${importHost.scraper_name}"`,
    sourceUrl: importUrl,
    scraperName: importHost.scraper_name,
  });

  const scraperMapping = findByName(importHost.scraper_name);
  if (!scraperMapping) {
    logActivity({
      level: 'warn',
      category: 'extraction',
      message: `No scraper mapping found for: ${importHost.scraper_name}`,
      sourceUrl: importUrl,
      scraperName: importHost.scraper_name,
    });
    return { success: false, errorMessage: `No mapping found for scraper: ${importHost.scraper_name}` };
  }

  try {
    // Check URL deduplication — reuse existing listing if already extracted
    const existingId = findListingByUrl(importUrl);
    let existingListing: Listing | undefined;
    if (existingId) {
      existingListing = await getListing(existingId);
    }

    // Find or create listing (Firestore or in-memory fallback)
    let listing: Listing;
    if (existingListing) {
      listing = existingListing;
      logActivity({
        level: 'info',
        category: 'extraction',
        message: `Reusing existing listing (dedup match)`,
        sourceUrl: importUrl,
      });
    } else {
      try {
        const chain = new WhereChain(Listing as any, { import_url: importUrl });
        listing = await chain.firstOrCreate();
      } catch (e: any) {
        // Firestore unavailable — use in-memory listing
        logActivity({
          level: 'warn',
          category: 'extraction',
          message: `Firestore unavailable (${e.message}), using in-memory listing`,
          sourceUrl: importUrl,
        });
        listing = new Listing();
        listing.assignAttributes({ import_url: importUrl });
      }
    }

    // Extract from HTML
    let diagnostics: ExtractionDiagnostics | undefined;

    if (html) {
      const result = extractFromHtml({
        html,
        sourceUrl: importUrl,
        scraperMapping,
      });

      diagnostics = result.diagnostics;

      if (result.success && result.properties.length > 0) {
        if (existingListing) {
          // Merge: build incoming listing and merge into existing
          const incomingListing = new Listing();
          incomingListing.assignAttributes({ import_url: importUrl });
          incomingListing.import_host_slug = importHost.slug;
          incomingListing.last_retrieved_at = new Date();
          Listing.updateFromHash(incomingListing, result.properties[0]);
          Listing.mergeIntoListing(listing, incomingListing);
        } else {
          listing.import_host_slug = importHost.slug;
          listing.last_retrieved_at = new Date();
          Listing.updateFromHash(listing, result.properties[0]);
        }
 
        // Sync quality metadata from diagnostics (if not manually overridden)
        if (diagnostics && !(listing as any).manual_override) {
          listing.confidence_score = diagnostics.confidenceScore;
          listing.visibility = diagnostics.visibility;
        }

        // Price normalization using portal's default currency
        const portal = findPortalByHost(validation.uri!.hostname);
        const fallbackCurrency = portal?.currency;
        const normalized = normalizePrice(
          listing.price_string || '',
          listing.price_float || 0,
          fallbackCurrency,
        );
        listing.price_cents = normalized.priceCents;
        listing.price_currency = normalized.currency;

        const fieldsFound = diagnostics?.populatedFields ?? Object.entries(result.properties[0]).filter(([, v]) => {
          if (v === null || v === undefined || v === '' || v === 0 || v === false) return false;
          if (Array.isArray(v) && v.length === 0) return false;
          return true;
        }).length;

        logActivity({
          level: fieldsFound > 0 ? 'info' : 'warn',
          category: 'extraction',
          message: `Extraction complete: ${fieldsFound} fields found`,
          sourceUrl: importUrl,
          scraperName: importHost.scraper_name,
          fieldsFound,
          diagnostics,
        });

        // Persist diagnostic summary fields onto listing for admin queries
        if (diagnostics) {
          Listing.applyDiagnostics(listing, diagnostics);
        }

        try {
          await listing.save();
        } catch (e: any) {
          logActivity({
            level: 'warn',
            category: 'extraction',
            message: `Firestore save failed (${e.message}), skipping persistence`,
            sourceUrl: importUrl,
          });
        }
      }
    } else {
      logActivity({
        level: 'info',
        category: 'extraction',
        message: 'No HTML provided — URL-only mode',
        sourceUrl: importUrl,
      });
    }

    return { success: true, retrievedListing: listing, diagnostics };
  } catch (err: unknown) {
    logActivity({
      level: 'error',
      category: 'extraction',
      message: `Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
      sourceUrl: importUrl,
    });
    return {
      success: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }
}
