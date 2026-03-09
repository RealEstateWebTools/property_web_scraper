import type { APIRoute } from 'astro';
import { apiGuard } from '@lib/services/api-guard.js';
import { listSupportedSites } from '@lib/services/portal-registry.js';
import { successResponse, corsPreflightResponse } from '@lib/services/api-response.js';
import { logActivity } from '@lib/services/activity-logger.js';

export const OPTIONS: APIRoute = ({ request }) => corsPreflightResponse(request);

export const GET: APIRoute = async ({ request }) => {
  const startTime = Date.now();

  const guard = await apiGuard(request);
  if (!guard.ok) return guard.response;

  const sites = listSupportedSites().map((site) => ({
    host: site.host,
    scraper: site.scraper,
    slug: site.slug,
    country: site.country,
    support_tier: site.supportTier,
    expected_extraction_rate: site.expectedExtractionRate,
    requires_browser_html: site.requiresJsRendering,
    url: site.url,
  }));

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
