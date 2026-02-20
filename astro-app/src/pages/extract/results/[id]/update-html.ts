import type { APIRoute } from 'astro';
import { retrieveListing } from '@lib/services/listing-retriever.js';
import { getListing, storeListing, storeDiagnostics } from '@lib/services/listing-store.js';
import { recordScrapeAndUpdatePortal } from '@lib/services/scrape-metadata.js';

function redirectTo(path: string): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: path },
  });
}

export const POST: APIRoute = async ({ params, request }) => {
  const id = params.id;
  if (!id) {
    return redirectTo('/extract/error?reason=error&message=Missing%20result%20id');
  }

  const existing = await getListing(id);
  if (!existing) {
    return redirectTo('/extract/error?reason=error&message=Extraction%20result%20not%20found');
  }

  const form = await request.formData();
  const submittedUrl = (form.get('import_url') as string | null)?.trim() || '';
  const html = (form.get('html') as string | null)?.trim() || '';
  const importUrl = submittedUrl || ((existing as any).import_url as string) || '';

  if (!importUrl) {
    return redirectTo('/extract/error?reason=missing_url');
  }
  if (!html) {
    return redirectTo(`/extract/results/${id}?update_error=missing_html`);
  }

  const result = await retrieveListing(importUrl, html);
  if (!result.success || !result.retrievedListing) {
    const reason = result.errorMessage === 'Unsupported Url' ? 'unsupported' : 'error';
    return redirectTo(`/extract/error?reason=${reason}&url=${encodeURIComponent(importUrl)}&message=${encodeURIComponent(result.errorMessage || 'Unknown error')}`);
  }

  await storeListing(id, result.retrievedListing);
  if (result.diagnostics) {
    await storeDiagnostics(id, result.diagnostics);
  }

  await recordScrapeAndUpdatePortal({
    listingId: id,
    sourceUrl: importUrl,
    html,
    sourceType: 'result_html_update',
    scraperName: result.diagnostics?.scraperName,
    portalSlug: result.diagnostics?.scraperName,
    requestContentType: request.headers.get('content-type') || undefined,
    clientUserAgent: request.headers.get('user-agent'),
    diagnostics: result.diagnostics,
  });

  return redirectTo(`/extract/results/${id}?updated=1`);
};
