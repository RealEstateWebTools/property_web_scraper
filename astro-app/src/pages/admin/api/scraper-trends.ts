import type { APIRoute } from 'astro';
import { authenticateAdmin } from '@lib/services/admin-auth.js';
import { getScraperTrend, getAllScraperTrends } from '@lib/services/scraper-health-trends.js';

export const GET: APIRoute = async ({ request }) => {
  const auth = authenticateAdmin(request);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: auth.errorMessage }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const scraperName = url.searchParams.get('scraper') || undefined;
  const days = parseInt(url.searchParams.get('days') || '30', 10);

  if (scraperName) {
    const trend = await getScraperTrend(scraperName, days);
    if (!trend) {
      return new Response(JSON.stringify({ error: 'No data for scraper: ' + scraperName }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ trend }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const trends = await getAllScraperTrends(days);

  return new Response(JSON.stringify({ trends, days }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
