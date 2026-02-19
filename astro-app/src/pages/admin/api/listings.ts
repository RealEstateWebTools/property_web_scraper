import type { APIRoute } from 'astro';
import { authenticateAdmin } from '@lib/services/admin-auth.js';
import { initKV, deleteListing, updateListingVisibility } from '@lib/services/listing-store.js';

export const POST: APIRoute = async ({ request }) => {
  const auth = authenticateAdmin(request);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: auth.errorMessage }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Ensure KV is initialized for the request
  const env = (globalThis as any).process?.env || {}; // Fallback for local
  const kv = (request as any).locals?.runtime?.env?.RESULTS;
  // Note: Depending on middleware, initKV might already be called. 
  // But we'll do it safely here if we can access the env.

  try {
    const body = await request.json();
    const { action, listingId, visibility } = body;

    if (!listingId) {
      return new Response(JSON.stringify({ error: 'Missing listingId' }), { status: 400 });
    }

    if (action === 'delete') {
      await deleteListing(listingId);
      return new Response(JSON.stringify({ success: true, message: 'Listing deleted' }));
    } 
    
    if (action === 'set_visibility') {
      if (!visibility) return new Response(JSON.stringify({ error: 'Missing visibility' }), { status: 400 });
      await updateListingVisibility(listingId, visibility);
      return new Response(JSON.stringify({ success: true, message: `Visibility set to ${visibility}` }));
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 });
  } catch (err: unknown) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), { status: 400 });
  }
};
