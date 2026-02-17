import type { APIRoute } from 'astro';
import { allMappingNames } from '@lib/extractor/mapping-loader.js';
import { successResponse } from '@lib/services/api-response.js';
import { logActivity } from '@lib/services/activity-logger.js';

export const GET: APIRoute = async ({ request }) => {
  const startTime = Date.now();

  const response = successResponse({
    status: 'ok',
    scrapers_loaded: allMappingNames().length,
    storage: 'in_memory',
  }, request);

  logActivity({
    level: 'info',
    category: 'api_request',
    message: 'GET health: OK',
    method: 'GET',
    path: '/public_api/v1/health',
    statusCode: 200,
    durationMs: Date.now() - startTime,
  });

  return response;
};
