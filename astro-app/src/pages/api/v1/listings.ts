import type { APIRoute } from 'astro';
import { authenticateApiKey, extractHtmlInput } from '@lib/services/auth.js';
import { validateUrl } from '@lib/services/url-validator.js';
import { extractFromHtml } from '@lib/extractor/html-extractor.js';
import { findByName } from '@lib/extractor/mapping-loader.js';
import { Listing } from '@lib/models/listing.js';
import { WhereChain } from '@lib/firestore/base-model.js';

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * GET /api/v1/listings?url=...
 * POST /api/v1/listings (with url + html body or html_file upload)
 *
 * Port of Ruby Api::V1::ListingsController#retrieve.
 */
export const GET: APIRoute = async ({ request }) => {
  const auth = authenticateApiKey(request);
  if (!auth.authorized) return auth.errorResponse!;

  const url = new URL(request.url).searchParams.get('url');
  const validation = await validateUrl(url);
  if (!validation.valid) {
    return jsonResponse({ success: false, error_message: validation.errorMessage });
  }

  const importHost = validation.importHost!;
  const scraperMapping = findByName(importHost.scraper_name);
  if (!scraperMapping) {
    return jsonResponse({ success: false, error_message: 'No scraper mapping found' });
  }

  // For GET, we don't have HTML, just return metadata
  let listing: Listing;
  try {
    const chain = new WhereChain(Listing as any, { import_url: url! });
    listing = await chain.firstOrCreate();
  } catch {
    listing = new Listing();
    listing.assignAttributes({ import_url: url! });
  }

  return jsonResponse({
    success: true,
    retry_duration: 0,
    urls_remaining: 0,
    listings: [listing.asJson()],
  });
};

export const POST: APIRoute = async ({ request }) => {
  const auth = authenticateApiKey(request);
  if (!auth.authorized) return auth.errorResponse!;

  let url: string | null = null;
  let html: string | null = null;

  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    url = formData.get('url') as string || null;
    const htmlFile = formData.get('html_file');
    if (htmlFile && htmlFile instanceof File) {
      html = await htmlFile.text();
    } else {
      html = formData.get('html') as string || null;
    }
  } else if (contentType.includes('application/json')) {
    const body = await request.json();
    url = body.url || null;
    html = body.html || null;
  }

  if (!url) {
    return jsonResponse({ success: false, error_message: 'Please provide a url' });
  }

  const validation = await validateUrl(url);
  if (!validation.valid) {
    return jsonResponse({ success: false, error_message: validation.errorMessage });
  }

  const importHost = validation.importHost!;
  const scraperMapping = findByName(importHost.scraper_name);
  if (!scraperMapping) {
    return jsonResponse({ success: false, error_message: 'No scraper mapping found' });
  }

  let listing: Listing;
  try {
    const chain = new WhereChain(Listing as any, { import_url: url });
    listing = await chain.firstOrCreate();
  } catch {
    listing = new Listing();
    listing.assignAttributes({ import_url: url });
  }

  if (html) {
    const result = extractFromHtml({
      html,
      sourceUrl: url,
      scraperMapping,
    });

    if (result.success && result.properties.length > 0) {
      listing.import_host_slug = importHost.slug;
      listing.last_retrieved_at = new Date();
      Listing.updateFromHash(listing, result.properties[0]);
      try { await listing.save(); } catch { /* Firestore unavailable */ }
    }
  }

  return jsonResponse({
    success: true,
    retry_duration: 0,
    urls_remaining: 0,
    listings: [listing.asJson()],
  });
};
