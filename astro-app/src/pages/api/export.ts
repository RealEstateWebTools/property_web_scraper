/**
 * Export API Endpoint
 * Astro API endpoint for exporting listings in various formats
 */

import type { APIRoute } from 'astro';
import { getExportService } from '@lib/services/export-service.js';
import { getAllExporters, getAvailableExporters } from '@lib/exporters/exporter-registry.js';
import type { ExportFormat } from '@lib/exporters/exporter-registry.js';

/**
 * GET /api/export
 * Returns available export formats and metadata
 */
export const GET: APIRoute = async ({ url }) => {
  // If querying formats list
  if (url.searchParams.has('formats')) {
    const includeUnderDev = url.searchParams.get('all') === 'true';
    const formats = includeUnderDev ? getAllExporters() : getAvailableExporters();

    return new Response(
      JSON.stringify({
        formats: formats.map(f => ({
          format: f.format,
          label: f.label,
          description: f.description,
          fileExtension: f.fileExtension,
          mimeType: f.mimeType,
          isAvailable: f.isAvailable,
          requiresGeoLocation: f.requiresGeoLocation || false,
        })),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  return new Response('Not Found', { status: 404 });
};

/**
 * POST /api/export
 * Export listings with specified format
 * 
 * Request body:
 * {
 *   "format": "json|csv|geojson",
 *   "listings": [Listing objects],
 *   "options": {
 *     "fieldSelection": "essential|all|[field1,field2]",
 *     "pretty": true,
 *     ...
 *   }
 * }
 */
export const POST: APIRoute = async ({ request }) => {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const body = await request.json();
    const { format, listings, options } = body;

    // Validate required fields
    if (!format) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!listings || !Array.isArray(listings)) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid listings array' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (listings.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Listings array cannot be empty' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Export
    const exportService = getExportService();
    const result = await exportService.export({
      format: format as ExportFormat,
      listings,
      options,
    });

    // Return export result
    // For JSON/text formats, return as text with proper MIME type
    if (format === 'json' || format === 'csv' || format === 'geojson') {
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
    }

    // For other formats, return as JSON
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    return new Response(
      JSON.stringify({
        error: message,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
