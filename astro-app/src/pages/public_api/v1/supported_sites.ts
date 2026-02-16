import type { APIRoute } from 'astro';
import { authenticateApiKey } from '@lib/services/auth.js';
import { LOCAL_HOST_MAP } from '@lib/services/url-validator.js';
import { checkRateLimit } from '@lib/services/rate-limiter.js';
import { successResponse, corsPreflightResponse } from '@lib/services/api-response.js';

export const OPTIONS: APIRoute = () => corsPreflightResponse();

export const GET: APIRoute = async ({ request }) => {
  const auth = authenticateApiKey(request);
  if (!auth.authorized) return auth.errorResponse!;

  const rateCheck = checkRateLimit(request);
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
  return successResponse({ sites });
};
