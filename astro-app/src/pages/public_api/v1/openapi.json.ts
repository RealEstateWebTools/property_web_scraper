import type { APIRoute } from 'astro';

const spec = {
  openapi: '3.1.0',
  info: {
    title: 'PropertyWebScraper API',
    version: '1.0.0',
    description:
      'Extract structured real estate listing data from any property portal URL. ' +
      'Returns 70+ fields including price, location, images, area, bedrooms, and more.',
    contact: { url: 'https://github.com/RealEstateWebTools/property_web_scraper' },
  },
  servers: [{ url: '/public_api/v1', description: 'Current server' }],
  security: [{ apiKey: [] }, {}],
  components: {
    securitySchemes: {
      apiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API key. Can also be passed as `?api_key=` query parameter.',
      },
    },
    schemas: {
      ImageInfo: {
        type: 'object',
        properties: {
          url: { type: 'string', format: 'uri' },
          caption: { type: 'string' },
          width: { type: 'integer' },
          height: { type: 'integer' },
        },
        required: ['url'],
      },
      Listing: {
        type: 'object',
        description: 'A scraped real estate listing with all extracted fields.',
        properties: {
          id: { type: 'string', description: 'Internal listing ID' },
          import_url: { type: 'string', format: 'uri', description: 'Original source URL' },
          import_host_slug: { type: 'string', description: 'Portal slug (e.g. rightmove_co_uk)' },
          title: { type: 'string', description: 'Listing title' },
          description: { type: 'string', description: 'Plain-text description' },
          description_html: { type: 'string', description: 'HTML description' },
          reference: { type: 'string', description: 'Portal reference number' },

          // Pricing
          price_string: { type: 'string', example: '€350,000', description: 'Formatted price string' },
          price_float: { type: 'number', description: 'Numeric price value' },
          price_cents: { type: 'integer', description: 'Price in smallest currency unit' },
          currency: { type: 'string', example: 'EUR' },
          price_currency: { type: 'string', example: 'EUR' },
          price_qualifier: { type: 'string', example: 'Guide Price' },

          // Property details
          count_bedrooms: { type: 'integer', default: 0 },
          count_bathrooms: { type: 'number', default: 0 },
          count_toilets: { type: 'integer', default: 0 },
          count_garages: { type: 'integer', default: 0 },
          constructed_area: { type: 'number', description: 'Built area', default: 0 },
          plot_area: { type: 'number', description: 'Land/plot area', default: 0 },
          area_unit: { type: 'string', default: 'sqmt', example: 'sqft' },
          year_construction: { type: 'integer', default: 0 },
          property_type: { type: 'string', example: 'Apartment' },
          property_subtype: { type: 'string', example: 'Studio' },
          tenure: { type: 'string', example: 'Freehold' },
          furnished: { type: 'boolean', default: false },

          // Listing status
          for_sale: { type: 'boolean', default: false },
          for_rent: { type: 'boolean', default: false },
          for_rent_long_term: { type: 'boolean', default: false },
          for_rent_short_term: { type: 'boolean', default: false },
          sold: { type: 'boolean', default: false },
          reserved: { type: 'boolean', default: false },
          listing_status: { type: 'string' },

          // Location
          address_string: { type: 'string' },
          street_number: { type: 'string' },
          street_name: { type: 'string' },
          street_address: { type: 'string' },
          postal_code: { type: 'string' },
          city: { type: 'string' },
          region: { type: 'string' },
          province: { type: 'string' },
          country: { type: 'string' },
          latitude: { type: 'number', format: 'double', example: 51.5074 },
          longitude: { type: 'number', format: 'double', example: -0.1278 },

          // Media
          main_image_url: { type: 'string', format: 'uri' },
          image_urls: {
            type: 'array',
            items: { $ref: '#/components/schemas/ImageInfo' },
          },
          floor_plan_urls: { type: 'array', items: { type: 'string', format: 'uri' } },
          features: { type: 'array', items: { type: 'string' }, description: 'Feature bullet points' },

          // Agent
          agent_name: { type: 'string' },
          agent_phone: { type: 'string' },
          agent_email: { type: 'string', format: 'email' },
          agent_logo_url: { type: 'string', format: 'uri' },

          // Energy
          energy_rating: { type: 'integer' },
          energy_performance: { type: 'number' },
          energy_certificate_grade: { type: 'string' },

          // Dates
          created_at: { type: 'string', format: 'date-time' },
          last_retrieved_at: { type: 'string', format: 'date-time' },
          active_from: { type: 'string', format: 'date-time' },
          available_to_rent_from: { type: 'string', format: 'date-time' },
          available_to_rent_till: { type: 'string', format: 'date-time' },

          // Quality metrics
          confidence_score: { type: 'number', minimum: 0, maximum: 1 },
          quality_grade: { type: 'string', enum: ['A', 'B', 'C', 'F'] },
          quality_label: { type: 'string' },
          extraction_rate: { type: 'number', minimum: 0, maximum: 100 },
          locale_code: { type: 'string', example: 'en-GB' },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'INVALID_REQUEST' },
              message: { type: 'string' },
            },
            required: ['code', 'message'],
          },
        },
        required: ['error'],
      },
    },
  },
  paths: {
    '/listings/{id}': {
      get: {
        operationId: 'getListing',
        summary: 'Get a listing by ID',
        tags: ['Listings'],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Listing ID' },
        ],
        responses: {
          '200': {
            description: 'The listing',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Listing' } } },
          },
          '404': { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/listings/{id}/export': {
      get: {
        operationId: 'exportListing',
        summary: 'Export a listing in a specific format',
        description:
          'Returns the listing serialised as JSON, CSV, GeoJSON, XML (RETS), ' +
          'Schema.org JSON-LD, BLM (Rightmove), Kyero XML, or RESO JSON.\n\n' +
          'By default the response triggers a file download (`Content-Disposition: attachment`). ' +
          'Add `?inline=1` to view the raw content directly in the browser.',
        tags: ['Listings', 'Export'],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Listing ID' },
          {
            name: 'format',
            in: 'query',
            required: true,
            schema: {
              type: 'string',
              enum: ['json', 'csv', 'geojson', 'xml', 'schema-org', 'blm', 'kyero', 'reso-json'],
            },
            description: 'Export format',
          },
          {
            name: 'inline',
            in: 'query',
            required: false,
            schema: { type: 'string', enum: ['1'] },
            description: 'Set to `1` to view in browser instead of downloading',
          },
        ],
        responses: {
          '200': {
            description: 'Exported file content',
            headers: {
              'X-Export-Format': { schema: { type: 'string' } },
              'X-Listing-Count': { schema: { type: 'string', example: '1' } },
              'X-Export-Timestamp': { schema: { type: 'string', format: 'date-time' } },
              'Content-Disposition': { schema: { type: 'string', example: 'attachment; filename="properties_1_listing_2026-02-01.json"' } },
            },
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Listing' } },
              'text/csv': { schema: { type: 'string' } },
              'application/geo+json': { schema: { type: 'object' } },
              'application/xml': { schema: { type: 'string' } },
              'application/ld+json': { schema: { type: 'object' } },
              'text/calendar': { schema: { type: 'string' } },
              'text/plain': { schema: { type: 'string' } },
            },
          },
          '400': { description: 'Invalid format or missing parameter', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'Listing not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/listings': {
      post: {
        operationId: 'extractListing',
        summary: 'Extract a listing from a URL or HTML',
        description:
          'Scrapes a property portal URL (or pre-rendered HTML) and returns structured listing data.',
        tags: ['Listings'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  url: { type: 'string', format: 'uri', description: 'Property listing URL to scrape' },
                  html: { type: 'string', description: 'Pre-rendered HTML to extract from (requires url for hostname detection)' },
                },
                required: ['url'],
              },
              examples: {
                byUrl: {
                  summary: 'Extract from URL',
                  value: { url: 'https://www.rightmove.co.uk/properties/168908774' },
                },
                byHtml: {
                  summary: 'Extract from pre-rendered HTML',
                  value: { url: 'https://www.rightmove.co.uk/properties/168908774', html: '<html>...</html>' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Extracted listing',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Listing' } } },
          },
          '400': { description: 'Unsupported site or invalid input', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      get: {
        operationId: 'getListingByUrl',
        summary: 'Look up a cached listing by source URL',
        tags: ['Listings'],
        parameters: [
          { name: 'url', in: 'query', required: true, schema: { type: 'string', format: 'uri' }, description: 'Original property listing URL' },
        ],
        responses: {
          '200': { description: 'Cached listing', content: { 'application/json': { schema: { $ref: '#/components/schemas/Listing' } } } },
          '404': { description: 'Not cached', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '401': { description: 'Unauthorized when the endpoint is locked down', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/export': {
      post: {
        operationId: 'batchExport',
        summary: 'Batch export multiple listings',
        description: 'Export up to 100 listings in any supported format.',
        tags: ['Export'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  format: {
                    type: 'string',
                    enum: ['json', 'csv', 'geojson', 'xml', 'schema-org', 'blm', 'kyero', 'reso-json'],
                  },
                  listingIds: { type: 'array', items: { type: 'string' }, maxItems: 100 },
                },
                required: ['format', 'listingIds'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'Exported file', content: { 'application/json': {}, 'text/csv': {}, 'application/geo+json': {} } },
          '400': { description: 'Invalid request', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      get: {
        operationId: 'listExportFormats',
        summary: 'List available export formats',
        tags: ['Export'],
        responses: {
          '200': {
            description: 'Available formats',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    formats: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          format: { type: 'string' },
                          label: { type: 'string' },
                          description: { type: 'string' },
                          mimeType: { type: 'string' },
                          fileExtension: { type: 'string' },
                        },
                      },
                    },
                  },
                  required: ['success', 'formats'],
                },
              },
            },
          },
          '401': { description: 'Unauthorized when the endpoint is locked down', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/supported_sites': {
      get: {
        operationId: 'getSupportedSites',
        summary: 'List all supported property portals',
        tags: ['Meta'],
        responses: {
          '200': {
            description: 'Supported sites',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    sites: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          host: { type: 'string' },
                          scraper: { type: 'string' },
                          slug: { type: 'string' },
                          country: { type: 'string', description: 'ISO 3166-1 alpha-2 country code' },
                          support_tier: { type: 'string', enum: ['core', 'experimental', 'manual-only'] },
                          expected_extraction_rate: { type: 'number' },
                          requires_browser_html: { type: 'boolean' },
                          url: { type: 'string', format: 'uri' },
                        },
                        required: ['host', 'scraper', 'slug', 'country', 'support_tier', 'requires_browser_html', 'url'],
                      },
                    },
                  },
                  required: ['success', 'sites'],
                },
              },
            },
          },
          '401': { description: 'Unauthorized when the endpoint is locked down', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/scraper_health': {
      get: {
        operationId: 'getScraperHealth',
        summary: 'Return a fixture-based scraper health snapshot',
        tags: ['Meta'],
        responses: {
          '200': {
            description: 'Scraper health report',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    generated_at: { type: 'string', format: 'date-time' },
                    fixture_runtime: { type: 'string', enum: ['available', 'unavailable'] },
                    fixture_runtime_warning: { type: ['string', 'null'] },
                    summary: {
                      type: 'object',
                      properties: {
                        total_scrapers: { type: 'integer' },
                        with_fixtures: { type: 'integer' },
                        without_fixtures: { type: 'integer' },
                        fixture_coverage_rate: { type: 'number' },
                        grade_counts: {
                          type: 'object',
                          properties: {
                            A: { type: 'integer' },
                            B: { type: 'integer' },
                            C: { type: 'integer' },
                            F: { type: 'integer' },
                            errors: { type: 'integer' },
                          },
                        },
                        tier_counts: {
                          type: 'object',
                          properties: {
                            core: { type: 'integer' },
                            experimental: { type: 'integer' },
                            manual_only: { type: 'integer' },
                          },
                        },
                        meets_expectation_count: { type: 'integer' },
                        below_expectation_count: { type: 'integer' },
                      },
                      required: ['total_scrapers', 'with_fixtures', 'without_fixtures', 'fixture_coverage_rate', 'grade_counts', 'tier_counts', 'meets_expectation_count', 'below_expectation_count'],
                    },
                    results: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          scraper: { type: 'string' },
                          country: { type: 'string' },
                          has_fixture: { type: 'boolean' },
                          support_tier: { type: ['string', 'null'] },
                          expected_extraction_rate: { type: ['number', 'null'] },
                          meets_expectation: { type: ['boolean', 'null'] },
                          consecutive_below_threshold: { type: ['integer', 'null'] },
                          quality_grade: { type: ['string', 'null'] },
                          quality_label: { type: ['string', 'null'] },
                          extraction_rate: { type: ['number', 'null'] },
                          weighted_rate: { type: ['number', 'null'] },
                          populated_fields: { type: ['integer', 'null'] },
                          total_fields: { type: ['integer', 'null'] },
                          critical_fields_missing: { type: ['array', 'null'], items: { type: 'string' } },
                          empty_fields: { type: ['array', 'null'], items: { type: 'string' } },
                          error: { type: ['string', 'null'] },
                        },
                        required: ['scraper', 'country', 'has_fixture'],
                      },
                    },
                  },
                  required: ['success', 'generated_at', 'fixture_runtime', 'summary', 'results'],
                },
              },
            },
          },
          '401': { description: 'Unauthorized when the endpoint is locked down', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/health': {
      get: {
        operationId: 'getHealth',
        summary: 'Health check',
        tags: ['Meta'],
        security: [],
        responses: {
          '200': {
            description: 'Service health status',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    status: { type: 'string', enum: ['ok', 'degraded'] },
                    scrapers_loaded: { type: 'integer' },
                    checks: {
                      type: 'object',
                      properties: {
                        kv: {
                          type: 'object',
                          properties: {
                            ok: { type: 'boolean' },
                            backend: { type: 'string' },
                          },
                        },
                        firestore: {
                          type: 'object',
                          properties: {
                            backend: { type: 'string' },
                            connected: { type: 'boolean' },
                            project_id: { type: ['string', 'null'] },
                          },
                        },
                        dead_letters: {
                          type: 'object',
                          properties: {
                            count: { type: 'integer' },
                          },
                        },
                      },
                    },
                  },
                  required: ['success', 'status', 'scrapers_loaded', 'checks'],
                },
              },
            },
          },
        },
      },
    },
    '/usage': {
      get: {
        operationId: 'getUsage',
        summary: 'Get API usage statistics',
        tags: ['Account'],
        security: [{ apiKey: [] }],
        responses: {
          '200': {
            description: 'Usage stats for the authenticated key',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    usage: { type: 'object' },
                  },
                  required: ['success', 'usage'],
                },
              },
            },
          },
          '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
  },
  tags: [
    { name: 'Listings', description: 'Extract and retrieve property listings' },
    { name: 'Export', description: 'Download listings in various formats' },
    { name: 'Account', description: 'API key management and usage' },
    { name: 'Meta', description: 'Health checks and supported sites' },
  ],
};

export const GET: APIRoute = ({ request }) => {
  const origin = new URL(request.url).origin;
  // Patch the server URL to the actual origin at request time
  const patchedSpec = {
    ...spec,
    servers: [{ url: `${origin}/public_api/v1`, description: 'This server' }],
  };
  return new Response(JSON.stringify(patchedSpec, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
};
