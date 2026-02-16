import type { APIRoute } from 'astro';
import { allMappingNames } from '@lib/extractor/mapping-loader.js';
import { successResponse } from '@lib/services/api-response.js';

export const GET: APIRoute = async () => {
  return successResponse({
    status: 'ok',
    scrapers_loaded: allMappingNames().length,
    storage: 'in_memory',
  });
};
