/**
 * POST /admin/api/ai-map-save
 *
 * Saves a generated mapping JSON to the config/scraper_mappings directory.
 * Admin-only.
 */

import type { APIRoute } from 'astro';
import { authenticateAdmin } from '@lib/services/admin-auth.js';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const POST: APIRoute = async ({ request }) => {
  const auth = authenticateAdmin(request);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: auth.errorMessage }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: { scraperName?: string; mappingJson?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { scraperName, mappingJson } = body;

  if (!scraperName || !mappingJson) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields: scraperName, mappingJson' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Validate scraper name format
  if (!/^[a-z]{2}_[a-z0-9_]+$/.test(scraperName)) {
    return new Response(
      JSON.stringify({ error: 'Invalid scraper name format. Use: xx_portalname (e.g., de_immoscout)' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Validate JSON
  try {
    JSON.parse(mappingJson);
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON in mappingJson' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const mappingPath = resolve(__dirname, '..', '..', '..', '..', '..', 'config', 'scraper_mappings', `${scraperName}.json`);

  try {
    writeFileSync(mappingPath, mappingJson + '\n', 'utf-8');
    return new Response(
      JSON.stringify({ success: true, path: `config/scraper_mappings/${scraperName}.json` }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: `Failed to write file: ${err.message}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};
