import { validateUrl, UNSUPPORTED } from './url-validator.js';
import { extractFromHtml } from '../extractor/html-extractor.js';
import type { ExtractionDiagnostics } from '../extractor/html-extractor.js';
import { findByName } from '../extractor/mapping-loader.js';
import { Listing } from '../models/listing.js';
import { WhereChain } from '../firestore/base-model.js';
import { logActivity } from './activity-logger.js';

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
    // Find or create listing (Firestore or in-memory fallback)
    let listing: Listing;
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
        listing.import_host_slug = importHost.slug;
        listing.last_retrieved_at = new Date();
        Listing.updateFromHash(listing, result.properties[0]);

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
