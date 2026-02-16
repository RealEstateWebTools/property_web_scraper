import type { APIRoute } from 'astro';
import { authenticateAdmin } from '@lib/services/admin-auth.js';
import { getRecentExtractions } from '@lib/services/extraction-stats.js';

export const GET: APIRoute = async ({ request }) => {
  const auth = authenticateAdmin(request);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: auth.errorMessage }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const scraper = url.searchParams.get('scraper') || '';
  const grade = url.searchParams.get('grade') || '';
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);

  let extractions = await getRecentExtractions(Math.min(limit, 200));

  if (scraper) {
    extractions = extractions.filter(e => e.scraperName === scraper);
  }
  if (grade) {
    extractions = extractions.filter(e => e.qualityGrade === grade);
  }

  return new Response(JSON.stringify({
    extractions,
    total: extractions.length,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
