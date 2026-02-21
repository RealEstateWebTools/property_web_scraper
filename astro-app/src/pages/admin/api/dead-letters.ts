import type { APIRoute } from 'astro';
import { authenticateAdmin } from '@lib/services/admin-auth.js';
import { getDeadLetters, getDeadLetterCount, clearDeadLetter, clearAllDeadLetters } from '@lib/services/dead-letter.js';

export const GET: APIRoute = async ({ request }) => {
  const auth = authenticateAdmin(request);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: auth.errorMessage }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 500);

  const entries = await getDeadLetters(limit);
  const total = await getDeadLetterCount();

  // Source breakdown
  const bySource: Record<string, number> = {};
  for (const entry of entries) {
    bySource[entry.source] = (bySource[entry.source] || 0) + 1;
  }

  return new Response(JSON.stringify({
    total,
    bySource,
    entries,
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
    const { action, entryId } = body;

    if (action === 'dismiss') {
      if (!entryId) {
        return new Response(JSON.stringify({ error: 'Missing entryId' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const removed = await clearDeadLetter(entryId);
      return new Response(JSON.stringify({ success: true, removed }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (action === 'clear_all') {
      await clearAllDeadLetters();
      return new Response(JSON.stringify({ success: true, message: 'All entries cleared' }), {
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
