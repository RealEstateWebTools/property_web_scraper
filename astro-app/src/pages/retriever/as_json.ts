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
 * GET/POST /retriever/as_json
 * Port of Ruby ScraperController#retrieve_as_json.
 */
async function handleRequest(request: Request): Promise<Response> {
  const auth = authenticateApiKey(request);
  if (!auth.authorized) return auth.errorResponse!;

  const params = new URL(request.url).searchParams;
  let url = params.get('url');
  let html: string | null = null;

  if (request.method === 'POST') {
    html = await extractHtmlInput(request);
    if (!url) {
      const contentType = request.headers.get('content-type') || '';
      if (contentType.includes('multipart/form-data')) {
        const formData = await request.formData();
        url = formData.get('url') as string || url;
      } else if (contentType.includes('application/json')) {
        const body = await request.json();
        url = body.url || url;
        html = body.html || html;
      }
    }
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

  const chain = new WhereChain(Listing as any, { import_url: url! });
  const listing = await chain.firstOrCreate();

  if (html) {
    const result = extractFromHtml({ html, sourceUrl: url!, scraperMapping });
    if (result.success && result.properties.length > 0) {
      listing.import_host_slug = importHost.slug;
      listing.last_retrieved_at = new Date();
      Listing.updateFromHash(listing, result.properties[0]);
      await listing.save();
    }
  }

  const clientId = params.get('client_id') || `pwb${Math.random().toString(36).slice(2, 10)}`;

  return jsonResponse({
    success: true,
    client_id: clientId,
    listing: listing.asJson(),
  });
}

export const GET: APIRoute = async ({ request }) => handleRequest(request);
export const POST: APIRoute = async ({ request }) => handleRequest(request);
