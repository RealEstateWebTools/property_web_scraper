import type { APIRoute } from 'astro';
import { authenticateAdmin } from '@lib/services/admin-auth.js';
import { getListing, getDiagnostics } from '@lib/services/listing-store.js';

export const GET: APIRoute = async ({ request, params }) => {
  const auth = authenticateAdmin(request);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: auth.errorMessage }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { id } = params;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing extraction ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const listing = await getListing(id);
  const diagnostics = await getDiagnostics(id);

  if (!listing) {
    return new Response(JSON.stringify({ error: 'Extraction not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({
    listing: typeof listing.asJson === 'function' ? listing.asJson() : listing,
    diagnostics: diagnostics || null,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
