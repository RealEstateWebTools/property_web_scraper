import type { APIRoute } from 'astro';
import { authenticateApiKey } from '@lib/services/auth.js';
import { LOCAL_HOST_MAP } from '@lib/services/url-validator.js';
import { checkRateLimit } from '@lib/services/rate-limiter.js';
import { successResponse, corsPreflightResponse } from '@lib/services/api-response.js';
import { logActivity } from '@lib/services/activity-logger.js';

export const OPTIONS: APIRoute = ({ request }) => corsPreflightResponse(request);

export const GET: APIRoute = async ({ request }) => {
  const startTime = Date.now();

  const auth = await authenticateApiKey(request);
  if (!auth.authorized) return auth.errorResponse!;

  const rateCheck = await checkRateLimit(request, auth.tier, auth.userId);
  if (!rateCheck.allowed) return rateCheck.errorResponse!;

  // Deduplicate www/non-www hosts — keep only the canonical (www) version
  const seen = new Map<string, { host: string; scraper: string }>();
  for (const [host, entry] of Object.entries(LOCAL_HOST_MAP)) {
    const canonical = host.replace(/^www\./, '');
    if (!seen.has(canonical)) {
      seen.set(canonical, { host, scraper: entry.scraper_name });
    }
  }

  const sites = Array.from(seen.values());

  logActivity({
    level: 'info',
    category: 'api_request',
    message: `GET supported_sites: ${sites.length} sites`,
    method: 'GET',
    path: '/public_api/v1/supported_sites',
    statusCode: 200,
    durationMs: Date.now() - startTime,
  });

  return successResponse({ sites }, request);
};
