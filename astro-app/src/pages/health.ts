import type { APIRoute } from 'astro';
import { allMappingNames } from '@lib/extractor/mapping-loader.js';

export const GET: APIRoute = async () => {
  const scraperCount = allMappingNames().length;
  const checks = {
    mappings: scraperCount > 0,
    scrapers_loaded: scraperCount,
  };
  const healthy = checks.mappings;

  return new Response(
    JSON.stringify(
      {
        status: healthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        checks,
      },
      null,
      2
    ),
    {
      status: healthy ? 200 : 503,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    }
  );
};
