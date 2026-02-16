import type { APIRoute } from 'astro';
import { initKV, getListing, getDiagnostics } from '@lib/services/listing-store.js';
import { splitPropertyHash } from '@lib/extractor/schema-splitter.js';

export const GET: APIRoute = async ({ params, locals }) => {
  initKV((locals as any).runtime?.env?.RESULTS);
  const listing = params.id ? await getListing(params.id) : undefined;

  if (!listing) {
    return new Response(JSON.stringify({ success: false, error_message: 'Listing not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const diagnostics = params.id ? await getDiagnostics(params.id) : undefined;
  const listingJson = listing.asJson();
  const splitSchema = splitPropertyHash(listingJson);

  return new Response(JSON.stringify({
    success: true,
    listing: listingJson,
    split_schema: splitSchema,
    ...(diagnostics ? { diagnostics } : {}),
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
