import type { APIRoute } from 'astro';
import { authenticateAdmin } from '@lib/services/admin-auth.js';
import { buildScraperHealthReport } from '@lib/services/scraper-health-report.js';

export const GET: APIRoute = async ({ request }) => {
  const auth = authenticateAdmin(request);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: auth.errorMessage }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const report = await buildScraperHealthReport();

  return new Response(JSON.stringify({
    ...report,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
