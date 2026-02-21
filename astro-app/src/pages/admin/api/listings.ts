import type { APIRoute } from 'astro';
import { authenticateAdmin } from '@lib/services/admin-auth.js';
import { deleteListing, updateListingVisibility, updateListingFields } from '@lib/services/listing-store.js';

export const POST: APIRoute = async ({ request }) => {
  const auth = authenticateAdmin(request);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: auth.errorMessage }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const { action, listingId, visibility } = body;

    if (!listingId) {
      return new Response(JSON.stringify({ error: 'Missing listingId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (action === 'delete') {
      await deleteListing(listingId);
      return new Response(JSON.stringify({ success: true, message: 'Listing deleted' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (action === 'update_fields') {
      const { fields } = body;
      if (!fields || typeof fields !== 'object' || Object.keys(fields).length === 0) {
        return new Response(JSON.stringify({ error: 'Missing or empty fields object' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      await updateListingFields(listingId, fields);
      return new Response(JSON.stringify({ success: true, updated: Object.keys(fields) }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (action === 'set_visibility') {
      if (!visibility) {
        return new Response(JSON.stringify({ error: 'Missing visibility' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      await updateListingVisibility(listingId, visibility);
      return new Response(JSON.stringify({ success: true, message: `Visibility set to ${visibility}` }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes('not found') ? 404 : 400;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
