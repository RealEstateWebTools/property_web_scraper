import type { APIRoute } from 'astro';
import { authenticateAdmin } from '@lib/services/admin-auth.js';
import { allMappingNames, findByName } from '@lib/extractor/mapping-loader.js';
import { LOCAL_HOST_MAP } from '@lib/services/url-validator.js';

export const GET: APIRoute = async ({ request }) => {
  const auth = authenticateAdmin(request);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: auth.errorMessage }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const mappingNames = allMappingNames();

  const scraperHosts = new Map<string, string[]>();
  for (const [host, entry] of Object.entries(LOCAL_HOST_MAP)) {
    if (!host.startsWith('www.')) continue;
    const existing = scraperHosts.get(entry.scraper_name) || [];
    existing.push(host);
    scraperHosts.set(entry.scraper_name, existing);
  }

  const scrapers = mappingNames.map((name) => {
    const mapping = findByName(name);
    const fieldCount =
      Object.keys(mapping?.textFields ?? {}).length +
      Object.keys(mapping?.intFields ?? {}).length +
      Object.keys(mapping?.floatFields ?? {}).length +
      Object.keys(mapping?.booleanFields ?? {}).length;

    return {
      name,
      loaded: mapping !== null,
      hosts: scraperHosts.get(name) || [],
      fieldCount,
      hasDefaultValues: Object.keys(mapping?.defaultValues ?? {}).length > 0,
      hasImages: (mapping?.images ?? []).length > 0,
      hasFeatures: (mapping?.features ?? []).length > 0,
    };
  });

  return new Response(JSON.stringify({ scrapers }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
