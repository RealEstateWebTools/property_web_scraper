import type { APIRoute } from 'astro';
import { getAllListings, getDiagnostics } from '@lib/services/listing-store.js';
import { successResponse, corsPreflightResponse } from '@lib/services/api-response.js';

export const OPTIONS: APIRoute = ({ request }) => corsPreflightResponse(request);

/**
 * GET /ext/v1/listings — Search and browse listings
 * Query params:
 *   - limit: max results (default: 10)
 *   - offset: pagination offset (default: 0)
 *   - sortBy: 'completeness' (default) or 'newest'
 *
 * Returns listings with price and description, sorted by data completeness
 */
export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 100);
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const sortBy = url.searchParams.get('sortBy') || 'completeness';

  try {
    const allListings = await getAllListings();

    // Filter: only listings with price and description
    const filtered = await Promise.all(
      allListings
        .filter(({ listing }) => {
          const hasPrice = !!listing.price_string || !!listing.price_float;
          const hasDescription = !!listing.description;
          return hasPrice && hasDescription;
        })
        .map(async ({ id, listing }) => {
          const diagnostics = await getDiagnostics(id);
          return { id, listing, diagnostics };
        })
    );

    // Sort by completeness (count of non-empty fields)
    const scored = filtered.map(({ id, listing, diagnostics }) => {
      const fields = [
        listing.title,
        listing.price_string,
        listing.price_float,
        listing.description,
        listing.main_image_url,
        listing.count_bedrooms,
        listing.count_bathrooms,
        listing.constructed_area,
        listing.city,
        listing.country,
        listing.latitude,
        listing.longitude,
      ];
      const completeness = fields.filter(Boolean).length / fields.length;
      const grade = diagnostics?.qualityGrade || 'F';
      const gradeScore = ({ A: 4, B: 3, C: 2, F: 0 } as Record<string, number>)[grade] || 0;

      return {
        id,
        listing,
        diagnostics,
        score: completeness * 0.7 + (gradeScore / 4) * 0.3,
      };
    });

    // Sort
    if (sortBy === 'newest') {
      scored.sort((a, b) => {
        const aTime = new Date(a.listing.last_retrieved_at || 0).getTime();
        const bTime = new Date(b.listing.last_retrieved_at || 0).getTime();
        return bTime - aTime;
      });
    } else {
      scored.sort((a, b) => b.score - a.score);
    }

    // Paginate
    const total = scored.length;
    const paginated = scored.slice(offset, offset + limit);

    const items = paginated.map(({ id, listing, diagnostics }) => ({
      id,
      title: listing.title || '(Untitled)',
      price: listing.price_string || `$${listing.price_float || 0}`,
      price_float: listing.price_float,
      description: listing.description?.substring(0, 150),
      image: listing.main_image_url,
      bedrooms: listing.count_bedrooms,
      bathrooms: listing.count_bathrooms,
      city: listing.city,
      country: listing.country,
      grade: diagnostics?.qualityGrade || 'F',
      extraction_rate: (diagnostics?.extractionRate || 0) * 100,
      created_at: listing.last_retrieved_at,
      url: listing.import_url,
      supplementary_data_links: listing.supplementary_data_links || [],
    }));

    return successResponse(
      {
        total,
        count: items.length,
        offset,
        limit,
        items,
      },
      request
    );
  } catch (err) {
    console.error('Listings API error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch listings' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
