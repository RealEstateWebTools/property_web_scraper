import type { APIRoute } from 'astro';
import { authenticateAdmin } from '@lib/services/admin-auth.js';
import { extractFromHtml } from '@lib/extractor/html-extractor.js';
import { allMappingNames } from '@lib/extractor/mapping-loader.js';

export const POST: APIRoute = async ({ request }) => {
  const auth = authenticateAdmin(request);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: auth.errorMessage }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: { scraper: string; html: string; sourceUrl: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { scraper, html, sourceUrl } = body;

  if (!scraper || !html || !sourceUrl) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields: scraper, html, sourceUrl' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!allMappingNames().includes(scraper)) {
    return new Response(
      JSON.stringify({ error: `Unknown scraper: ${scraper}` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const result = extractFromHtml({
    html,
    sourceUrl,
    scraperMappingName: scraper,
  });

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
