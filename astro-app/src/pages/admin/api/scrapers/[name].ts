import type { APIRoute } from 'astro';
import { authenticateAdmin } from '@lib/services/admin-auth.js';
import { findByName } from '@lib/extractor/mapping-loader.js';
import { getScraperStats } from '@lib/services/extraction-stats.js';

export const GET: APIRoute = async ({ request, params }) => {
  const auth = authenticateAdmin(request);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: auth.errorMessage }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { name } = params;
  if (!name) {
    return new Response(JSON.stringify({ error: 'Missing scraper name' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const mapping = findByName(name);
  if (!mapping) {
    return new Response(JSON.stringify({ error: 'Scraper not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const stats = await getScraperStats(name);

  return new Response(JSON.stringify({
    stats,
    mapping,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
