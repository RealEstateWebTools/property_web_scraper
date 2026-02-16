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
 * Falls back to in-memory Listing when Firestore is unavailable.
 */
export async function retrieveListing(
  importUrl: string,
  html?: string
): Promise<RetrievalResult> {
  console.log(`[Retriever] Starting retrieval for URL: "${importUrl}", html: ${html ? `${html.length} chars` : 'none'}`);

  const validation = await validateUrl(importUrl);
  if (!validation.valid || !validation.importHost) {
    const errorMessage = validation.errorCode === UNSUPPORTED
      ? 'Unsupported Url'
      : 'Invalid Url';
    console.log(`[Retriever] URL validation failed: ${errorMessage}`);
    return { success: false, errorMessage };
  }

  const importHost = validation.importHost;
  console.log(`[Retriever] Matched import host: slug="${importHost.slug}", scraper="${importHost.scraper_name}"`);

  const scraperMapping = findByName(importHost.scraper_name);
  if (!scraperMapping) {
    console.log(`[Retriever] No scraper mapping found for: ${importHost.scraper_name}`);
    return { success: false, errorMessage: `No mapping found for scraper: ${importHost.scraper_name}` };
  }
  console.log(`[Retriever] Loaded scraper mapping: ${importHost.scraper_name}`);

  try {
    // Find or create listing (Firestore or in-memory fallback)
    let listing: Listing;
    try {
      const chain = new WhereChain(Listing as any, { import_url: importUrl });
      listing = await chain.firstOrCreate();
      console.log(`[Retriever] Firestore listing loaded/created`);
    } catch (e: any) {
      // Firestore unavailable — use in-memory listing
      console.warn(`[Retriever] Firestore unavailable (${e.message}), using in-memory listing`);
      listing = new Listing();
      listing.assignAttributes({ import_url: importUrl });
    }

    // Extract from HTML
    if (html) {
      console.log(`[Retriever] Extracting from HTML (${html.length} chars)...`);
      const result = extractFromHtml({
        html,
        sourceUrl: importUrl,
        scraperMapping,
      });
      console.log(`[Retriever] Extraction result: success=${result.success}, properties=${result.properties.length}`);

      if (result.success && result.properties.length > 0) {
        listing.import_host_slug = importHost.slug;
        listing.last_retrieved_at = new Date();
        Listing.updateFromHash(listing, result.properties[0]);
        console.log(`[Retriever] Listing updated: title="${listing.title || ''}", price="${listing.price_string || ''}"`);
        try {
          await listing.save();
          console.log(`[Retriever] Listing saved to Firestore`);
        } catch (e: any) {
          console.warn(`[Retriever] Firestore save failed (${e.message}), skipping persistence`);
        }
      }
    } else {
      console.log(`[Retriever] No HTML provided — skipping extraction. URL-only mode returns existing listing data.`);
    }

    return { success: true, retrievedListing: listing };
  } catch (err: unknown) {
    console.error(`[Retriever] Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
    return {
      success: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }
}
