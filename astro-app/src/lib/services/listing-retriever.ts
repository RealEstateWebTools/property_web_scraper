import { validateUrl, UNSUPPORTED } from './url-validator.js';
import { extractFromHtml } from '../extractor/html-extractor.js';
import { findByName } from '../extractor/mapping-loader.js';
import { Listing } from '../models/listing.js';
import { WhereChain } from '../firestore/base-model.js';

export interface RetrievalResult {
  success: boolean;
  errorMessage?: string;
  retrievedListing?: Listing;
}

/**
 * High-level service for retrieving a property listing by URL.
 * Port of Ruby ListingRetriever.
 */
export async function retrieveListing(
  importUrl: string,
  html?: string
): Promise<RetrievalResult> {
  const validation = await validateUrl(importUrl);
  if (!validation.valid || !validation.importHost) {
    const errorMessage = validation.errorCode === UNSUPPORTED
      ? 'Unsupported Url'
      : 'Invalid Url';
    return { success: false, errorMessage };
  }

  const importHost = validation.importHost;
  const scraperMapping = findByName(importHost.scraper_name);
  if (!scraperMapping) {
    return { success: false, errorMessage: `No mapping found for scraper: ${importHost.scraper_name}` };
  }

  try {
    // Find or create listing
    const chain = new WhereChain(Listing as any, { import_url: importUrl });
    const listing = await chain.firstOrCreate();

    // Extract from HTML
    if (html) {
      const result = extractFromHtml({
        html,
        sourceUrl: importUrl,
        scraperMapping,
      });

      if (result.success && result.properties.length > 0) {
        listing.import_host_slug = importHost.slug;
        listing.last_retrieved_at = new Date();
        Listing.updateFromHash(listing, result.properties[0]);
        await listing.save();
      }
    }

    return { success: true, retrievedListing: listing };
  } catch (err: unknown) {
    return {
      success: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }
}
