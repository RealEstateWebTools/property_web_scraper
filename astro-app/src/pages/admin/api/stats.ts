import type { APIRoute } from 'astro';
import { authenticateAdmin } from '@lib/services/admin-auth.js';
import { allMappingNames, findByName } from '@lib/extractor/mapping-loader.js';
import { getStoreStats } from '@lib/services/listing-store.js';
import { getRateLimiterStats } from '@lib/services/rate-limiter.js';
import { getRuntimeConfig } from '@lib/services/runtime-config.js';
import { LOCAL_HOST_MAP } from '@lib/services/url-validator.js';
import { getSystemHealth } from '@lib/services/system-health.js';

export const GET: APIRoute = async ({ request }) => {
  const auth = authenticateAdmin(request);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: auth.errorMessage }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const mappingNames = allMappingNames();
  const storeStats = getStoreStats();
  const rateLimiterStats = getRateLimiterStats();
  const config = getRuntimeConfig();
  const health = getSystemHealth();

  // Build scraper status list
  const hostMap = LOCAL_HOST_MAP;
  const scraperHosts = new Map<string, string[]>();
  for (const [host, entry] of Object.entries(hostMap)) {
    const existing = scraperHosts.get(entry.scraper_name) || [];
    existing.push(host);
    scraperHosts.set(entry.scraper_name, existing);
  }

  const scrapers = mappingNames.map((name) => ({
    name,
    loaded: findByName(name) !== null,
    hosts: scraperHosts.get(name) || [],
  }));

  return new Response(JSON.stringify({
    health: {
      status: 'ok',
      scrapersLoaded: mappingNames.length,
      storage: health.storage,
    },
    listings: storeStats,
    rateLimiter: {
      ...rateLimiterStats,
      maxRequests: config.maxRequests,
    },
    logs: health.logs,
    runtime: health.runtime,
    throughput: health.throughput,
    environment: health.environment,
    subsystems: health.subsystems,
    scrapers,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
