import type { APIRoute } from 'astro';
import { initKV, getListing, getDiagnostics } from '@lib/services/listing-store.js';

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

  return new Response(JSON.stringify({
    success: true,
    listing: listing.asJson(),
    ...(diagnostics ? { diagnostics } : {}),
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
