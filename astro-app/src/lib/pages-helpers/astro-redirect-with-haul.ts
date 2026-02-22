/**
 * Shared helper for website extract pages.
 * After a successful extraction, adds the result to an auto-resolved haul
 * and returns a redirect Response with the haul cookie set.
 */

import type { ExtractionDiagnostics } from '@lib/extractor/html-extractor.js';
import type { Listing } from '@lib/models/listing.js';
import { buildHaulScrapeFromListing } from './build-haul-scrape.js';
import { addScrapeToHaul } from '@lib/services/haul-store.js';
import { resolveWebHaul, setHaulCookie } from '@lib/services/web-haul-resolver.js';

export async function addToHaulAndRedirect(
  request: Request,
  listingId: string,
  listing: Listing,
  diagnostics: ExtractionDiagnostics | undefined,
): Promise<Response> {
  const haulId = await resolveWebHaul(request);
  const scrape = buildHaulScrapeFromListing(listingId, listing, diagnostics);

  try {
    await addScrapeToHaul(haulId, scrape);
  } catch {
    // Haul persistence failure should not block the extraction result
  }

  const redirectUrl = `/extract/results/${listingId}?haul_id=${encodeURIComponent(haulId)}`;
  return new Response(null, {
    status: 302,
    headers: {
      Location: redirectUrl,
      'Set-Cookie': setHaulCookie(haulId),
    },
  });
}
