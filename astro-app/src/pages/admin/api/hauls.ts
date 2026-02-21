import type { APIRoute } from 'astro';
import { authenticateAdmin } from '@lib/services/admin-auth.js';
import { getAllHauls, deleteHaul } from '@lib/services/haul-store.js';

export const GET: APIRoute = async ({ request }) => {
  const auth = authenticateAdmin(request);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: auth.errorMessage }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const hauls = await getAllHauls();
  const items = hauls.map((h) => ({
    id: h.id,
    name: h.name || null,
    scrapeCount: h.scrapes.length,
    creatorIp: h.creatorIp,
    createdAt: h.createdAt,
    expiresAt: h.expiresAt,
  }));

  const totalScrapes = hauls.reduce((sum, h) => sum + h.scrapes.length, 0);
  const now = Date.now();
  const threeDays = 3 * 24 * 60 * 60 * 1000;
  const expiringSoon = hauls.filter((h) => new Date(h.expiresAt).getTime() - now < threeDays).length;

  return new Response(JSON.stringify({
    total: hauls.length,
    totalScrapes,
    expiringSoon,
    hauls: items,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

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
    const { action, haulId } = body;

    if (!haulId) {
      return new Response(JSON.stringify({ error: 'Missing haulId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (action === 'delete') {
      await deleteHaul(haulId);
      return new Response(JSON.stringify({ success: true, message: 'Haul deleted' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
