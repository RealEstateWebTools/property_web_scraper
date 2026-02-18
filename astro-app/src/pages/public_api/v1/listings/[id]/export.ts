import type { APIRoute } from 'astro';
import { authenticateApiKey } from '@lib/services/auth.js';
import { initKV, getListing } from '@lib/services/listing-store.js';
import { checkRateLimit } from '@lib/services/rate-limiter.js';
import { errorResponse, corsPreflightResponse, ApiErrorCode } from '@lib/services/api-response.js';
import { logActivity } from '@lib/services/activity-logger.js';
import { getExportService } from '@lib/services/export-service.js';
import { getAvailableExporters, type ExportFormat } from '@lib/exporters/exporter-registry.js';

export const OPTIONS: APIRoute = ({ request }) => corsPreflightResponse(request);

export const GET: APIRoute = async ({ params, request, locals }) => {
  const startTime = Date.now();
  const path = `/public_api/v1/listings/${params.id}/export`;

  initKV((locals as any).runtime?.env?.RESULTS);

  const auth = await authenticateApiKey(request);
  if (!auth.authorized) return auth.errorResponse!;

  const rateCheck = checkRateLimit(request, auth.tier, auth.userId);
  if (!rateCheck.allowed) return rateCheck.errorResponse!;

  const url = new URL(request.url);
  const format = url.searchParams.get('format') as ExportFormat | null;

  if (!format) {
    return errorResponse(ApiErrorCode.INVALID_REQUEST, 'Missing required query parameter: format (json, csv, or geojson)', request);
  }

  const availableFormats = getAvailableExporters().map(e => e.format);
  if (!availableFormats.includes(format)) {
    return errorResponse(
      ApiErrorCode.INVALID_REQUEST,
      `Invalid format '${format}'. Available: ${availableFormats.join(', ')}`,
      request,
    );
  }

  const listing = params.id ? await getListing(params.id) : undefined;

  if (!listing) {
    logActivity({
      level: 'warn',
      category: 'api_request',
      message: `Export listing: not found (${params.id})`,
      method: 'GET',
      path,
      statusCode: 404,
      durationMs: Date.now() - startTime,
      errorCode: ApiErrorCode.LISTING_NOT_FOUND,
    });
    return errorResponse(ApiErrorCode.LISTING_NOT_FOUND, 'Listing not found', request);
  }

  try {
    const exportService = getExportService();
    const result = await exportService.exportSingle(listing, format);

    logActivity({
      level: 'info',
      category: 'api_request',
      message: `Export listing: OK (${params.id}, ${format})`,
      method: 'GET',
      path,
      statusCode: 200,
      durationMs: Date.now() - startTime,
    });

    return new Response(result.data, {
      status: 200,
      headers: {
        'Content-Type': result.mimeType,
        'Content-Disposition': `attachment; filename="${result.filename}"`,
        'X-Export-Format': result.format,
        'X-Listing-Count': String(result.listingCount),
        'X-Export-Timestamp': result.timestamp,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Export failed';
    logActivity({
      level: 'error',
      category: 'api_request',
      message: `Export listing: error (${params.id}, ${format}) — ${message}`,
      method: 'GET',
      path,
      statusCode: 400,
      durationMs: Date.now() - startTime,
    });
    return errorResponse(ApiErrorCode.INVALID_REQUEST, message, request);
  }
};
