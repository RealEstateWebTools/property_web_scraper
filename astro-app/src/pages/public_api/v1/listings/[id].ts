import type { APIRoute } from 'astro';
import { authenticateApiKey } from '@lib/services/auth.js';
import { getListing } from '@lib/services/listing-store.js';

export const GET: APIRoute = async ({ params, request }) => {
  const auth = authenticateApiKey(request);
  if (!auth.authorized) return auth.errorResponse!;

  const listing = params.id ? getListing(params.id) : undefined;

  if (!listing) {
    return new Response(JSON.stringify({ success: false, error_message: 'Listing not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({
    success: true,
    listing: listing.asJson(),
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
