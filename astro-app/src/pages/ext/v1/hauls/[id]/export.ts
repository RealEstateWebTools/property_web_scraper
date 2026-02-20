import type { APIRoute } from 'astro';
import { isValidHaulId } from '@lib/services/haul-id.js';
import { getHaul } from '@lib/services/haul-store.js';
import { haulScrapesToListings } from '@lib/services/haul-export-adapter.js';
import { getExportService } from '@lib/services/export-service.js';
import { getAvailableExporters, type ExportFormat } from '@lib/exporters/exporter-registry.js';
import {
  errorResponse, corsPreflightResponse, ApiErrorCode,
} from '@lib/services/api-response.js';

export const OPTIONS: APIRoute = ({ request }) => corsPreflightResponse(request);

/**
 * GET /ext/v1/hauls/{id}/export?format=csv|json|geojson[&inline=1]
 */
export const GET: APIRoute = async ({ params, request }) => {
  const { id } = params;
  if (!id || !isValidHaulId(id)) {
    return errorResponse(ApiErrorCode.INVALID_REQUEST, 'Invalid haul ID format', request);
  }

  const url = new URL(request.url);
  const format = url.searchParams.get('format') as ExportFormat | null;
  const inline = url.searchParams.get('inline') === '1';

  if (!format) {
    return errorResponse(
      ApiErrorCode.INVALID_REQUEST,
      'Missing required query parameter: format (json, csv, or geojson)',
      request,
    );
  }

  const availableFormats = getAvailableExporters().map((e) => e.format);
  if (!availableFormats.includes(format)) {
    return errorResponse(
      ApiErrorCode.INVALID_REQUEST,
      `Invalid format '${format}'. Available: ${availableFormats.join(', ')}`,
      request,
    );
  }

  const haul = await getHaul(id);
  if (!haul) {
    return errorResponse(ApiErrorCode.NOT_FOUND, 'Haul not found or expired', request);
  }

  if (haul.scrapes.length === 0) {
    return errorResponse(ApiErrorCode.INVALID_REQUEST, 'Haul has no scrapes to export', request);
  }

  const listings = haulScrapesToListings(haul.scrapes);

  try {
    const exportService = getExportService();
    const result = await exportService.export({ format, listings });

    const count = result.listingCount;
    const filename = `haul_${id}_${count}_${count === 1 ? 'listing' : 'listings'}${result.filename.slice(result.filename.lastIndexOf('.'))}`;

    const headers: Record<string, string> = {
      'Content-Type': inline ? 'application/json' : result.mimeType,
      'X-Export-Format': result.format,
      'X-Listing-Count': String(count),
      'X-Export-Timestamp': result.timestamp,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (!inline) {
      headers['Content-Disposition'] = `attachment; filename="${filename}"`;
    }

    return new Response(result.data, { status: 200, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Export failed';
    return errorResponse(ApiErrorCode.INVALID_REQUEST, message, request);
  }
};
