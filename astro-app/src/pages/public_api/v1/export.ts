/**
 * Public API Export Endpoint
 * POST /public_api/v1/export — batch export listings
 * GET  /public_api/v1/export?formats — list available formats
 */

import type { APIRoute } from 'astro';
import { authenticateApiKey } from '@lib/services/auth.js';
import { initKV, getListing } from '@lib/services/listing-store.js';
import { checkRateLimit } from '@lib/services/rate-limiter.js';
import { errorResponse, successResponse, corsPreflightResponse, ApiErrorCode } from '@lib/services/api-response.js';
import { logActivity } from '@lib/services/activity-logger.js';
import { getExportService } from '@lib/services/export-service.js';
import { getAllExporters, getAvailableExporters } from '@lib/exporters/exporter-registry.js';
import type { ExportFormat } from '@lib/exporters/exporter-registry.js';
import { Listing } from '@lib/models/listing.js';

const MAX_BATCH_SIZE = 100;

export const OPTIONS: APIRoute = ({ request }) => corsPreflightResponse(request);

/**
 * GET /public_api/v1/export?formats
 * Returns available export formats and metadata
 */
export const GET: APIRoute = async ({ url, request, locals }) => {
  initKV((locals as any).runtime?.env?.RESULTS);

  const auth = await authenticateApiKey(request);
  if (!auth.authorized) return auth.errorResponse!;

  if (url.searchParams.has('formats')) {
    const includeUnderDev = url.searchParams.get('all') === 'true';
    const formats = includeUnderDev ? getAllExporters() : getAvailableExporters();

    return successResponse({
      formats: formats.map(f => ({
        format: f.format,
        label: f.label,
        description: f.description,
        fileExtension: f.fileExtension,
        mimeType: f.mimeType,
        isAvailable: f.isAvailable,
        requiresGeoLocation: f.requiresGeoLocation || false,
      })),
    }, request);
  }

  return errorResponse(ApiErrorCode.NOT_FOUND, 'Not Found', request);
};

/**
 * POST /public_api/v1/export
 * Export listings with specified format
 *
 * Body options:
 * - { format, listings: [...] }      — export provided listing objects
 * - { format, listingIds: [...] }     — fetch from store and export
 * - { format, listings/listingIds, options }
 */
export const POST: APIRoute = async ({ request, locals }) => {
  const startTime = Date.now();
  const path = '/public_api/v1/export';

  initKV((locals as any).runtime?.env?.RESULTS);

  const auth = await authenticateApiKey(request);
  if (!auth.authorized) return auth.errorResponse!;

  const rateCheck = await checkRateLimit(request, auth.tier, auth.userId);
  if (!rateCheck.allowed) return rateCheck.errorResponse!;

  try {
    const body = await request.json();
    const { format, listings: rawListings, listingIds, options } = body;

    // Validate format
    if (!format) {
      return errorResponse(ApiErrorCode.INVALID_REQUEST, 'Missing required field: format', request);
    }

    const availableFormats = getAvailableExporters().map(e => e.format);
    if (!availableFormats.includes(format)) {
      return errorResponse(
        ApiErrorCode.INVALID_REQUEST,
        `Invalid format '${format}'. Available: ${availableFormats.join(', ')}`,
        request,
      );
    }

    let listings: Listing[];

    if (listingIds && Array.isArray(listingIds)) {
      // Fetch listings by ID from store
      if (listingIds.length === 0) {
        return errorResponse(ApiErrorCode.INVALID_REQUEST, 'listingIds array cannot be empty', request);
      }
      if (listingIds.length > MAX_BATCH_SIZE) {
        return errorResponse(
          ApiErrorCode.INVALID_REQUEST,
          `Batch size exceeds limit of ${MAX_BATCH_SIZE} listings`,
          request,
        );
      }

      const fetched = await Promise.all(
        listingIds.map(async (id: string) => {
          const listing = await getListing(id);
          if (!listing) throw new Error(`Listing not found: ${id}`);
          return listing;
        })
      );
      listings = fetched;
    } else if (rawListings && Array.isArray(rawListings)) {
      // Use provided listing objects
      if (rawListings.length === 0) {
        return errorResponse(ApiErrorCode.INVALID_REQUEST, 'Listings array cannot be empty', request);
      }
      if (rawListings.length > MAX_BATCH_SIZE) {
        return errorResponse(
          ApiErrorCode.INVALID_REQUEST,
          `Batch size exceeds limit of ${MAX_BATCH_SIZE} listings`,
          request,
        );
      }

      // Rehydrate plain objects into Listing instances
      listings = rawListings.map((data: Record<string, unknown>) => {
        const listing = new Listing();
        listing.assignAttributes(data);
        return listing;
      });
    } else {
      return errorResponse(ApiErrorCode.INVALID_REQUEST, 'Request must include either listings array or listingIds array', request);
    }

    // Export
    const exportService = getExportService();
    const result = await exportService.export({
      format: format as ExportFormat,
      listings,
      options,
    });

    logActivity({
      level: 'info',
      category: 'api_request',
      message: `POST export: OK (${format}, ${listings.length} listings)`,
      method: 'POST',
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
    const message = error instanceof Error ? error.message : 'Unknown error';

    logActivity({
      level: 'error',
      category: 'api_request',
      message: `POST export: error — ${message}`,
      method: 'POST',
      path,
      statusCode: 400,
      durationMs: Date.now() - startTime,
    });

    return new Response(
      JSON.stringify({ error: message, timestamp: new Date().toISOString() }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }
};
