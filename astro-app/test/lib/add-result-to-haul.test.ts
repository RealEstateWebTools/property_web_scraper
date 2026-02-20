import { describe, it, expect } from 'vitest';
import { buildHaulScrapeFromListing } from '../../src/pages/ext/v1/hauls/[id]/add-result.js';

function makeListing(overrides: Record<string, unknown> = {}) {
  return {
    import_url: 'https://www.rightmove.co.uk/properties/123',
    title: '3-bed Detached House',
    price_string: '£450,000',
    price_float: 450000,
    currency: '£',
    count_bedrooms: 3,
    count_bathrooms: 2,
    constructed_area: 150,
    area_unit: 'sqft',
    latitude: 51.5,
    longitude: -0.1,
    city: 'London',
    country: 'UK',
    address_string: '10 Downing St',
    main_image_url: 'https://example.com/img.jpg',
    import_host_slug: 'rightmove',
    for_sale: true,
    for_rent: false,
    features: ['Garden', 'Garage'],
    description: 'A lovely home',
    property_type: 'house',
    property_subtype: 'detached',
    tenure: 'freehold',
    listing_status: 'active',
    agent_name: 'Top Agents',
    agent_phone: '020 1234 5678',
    agent_email: 'hello@top.co.uk',
    agent_logo_url: 'https://example.com/agent-logo.png',
    price_qualifier: 'offers_over',
    floor_plan_urls: ['https://example.com/floor.png'],
    energy_certificate_grade: 'B',
    ...overrides,
  };
}

function makeDiagnostics(overrides: Record<string, unknown> = {}) {
  return {
    qualityGrade: 'A',
    extractionRate: 0.85,
    ...overrides,
  };
}

describe('buildHaulScrapeFromListing', () => {
  it('builds a complete HaulScrape from a fully populated listing', () => {
    const listing = makeListing();
    const diag = makeDiagnostics();
    const scrape = buildHaulScrapeFromListing('res-1', listing, diag);

    expect(scrape.resultId).toBe('res-1');
    expect(scrape.title).toBe('3-bed Detached House');
    expect(scrape.grade).toBe('A');
    expect(scrape.price).toBe('£450,000');
    expect(scrape.extractionRate).toBe(0.85);
    expect(scrape.url).toBe('https://www.rightmove.co.uk/properties/123');
    expect(scrape.price_float).toBe(450000);
    expect(scrape.currency).toBe('£');
    expect(scrape.count_bedrooms).toBe(3);
    expect(scrape.count_bathrooms).toBe(2);
    expect(scrape.city).toBe('London');
    // Interoperability fields
    expect(scrape.property_type).toBe('house');
    expect(scrape.property_subtype).toBe('detached');
    expect(scrape.tenure).toBe('freehold');
    expect(scrape.listing_status).toBe('active');
    expect(scrape.agent_name).toBe('Top Agents');
    expect(scrape.agent_phone).toBe('020 1234 5678');
    expect(scrape.agent_email).toBe('hello@top.co.uk');
    expect(scrape.agent_logo_url).toBe('https://example.com/agent-logo.png');
    expect(scrape.price_qualifier).toBe('offers_over');
    expect(scrape.floor_plan_urls).toEqual(['https://example.com/floor.png']);
    expect(scrape.energy_certificate_grade).toBe('B');
  });

  it('omits empty/zero interoperability fields as undefined', () => {
    const listing = makeListing({
      property_type: '',
      agent_name: '',
      floor_plan_urls: [],
      energy_certificate_grade: '',
    });
    const scrape = buildHaulScrapeFromListing('res-2', listing, null);

    expect(scrape.property_type).toBeUndefined();
    expect(scrape.agent_name).toBeUndefined();
    expect(scrape.floor_plan_urls).toBeUndefined();
    expect(scrape.energy_certificate_grade).toBeUndefined();
    expect(scrape.grade).toBe('F'); // no diagnostics
    expect(scrape.extractionRate).toBe(0);
  });

  it('handles a minimal listing with no enriched fields', () => {
    const listing = {
      import_url: 'https://example.com/listing/1',
      title: 'Basic Listing',
      price_string: '100,000',
    };
    const scrape = buildHaulScrapeFromListing('res-3', listing, null);

    expect(scrape.resultId).toBe('res-3');
    expect(scrape.title).toBe('Basic Listing');
    expect(scrape.url).toBe('https://example.com/listing/1');
    expect(scrape.property_type).toBeUndefined();
    expect(scrape.agent_name).toBeUndefined();
    expect(scrape.tenure).toBeUndefined();
  });

  it('truncates long descriptions to 500 characters', () => {
    const longDesc = 'A'.repeat(600);
    const listing = makeListing({ description: longDesc });
    const scrape = buildHaulScrapeFromListing('res-4', listing, makeDiagnostics());

    expect(scrape.description).toHaveLength(500);
  });

  it('includes description_html when present and within 1000 chars', () => {
    const html = '<p>Spacious <b>3-bed</b> home.</p>';
    const listing = makeListing({ description_html: html });
    const scrape = buildHaulScrapeFromListing('res-5', listing, makeDiagnostics());

    expect(scrape.description_html).toBe(html);
  });

  it('omits description_html when it exceeds 1000 characters', () => {
    const longHtml = '<p>' + 'A'.repeat(1001) + '</p>';
    const listing = makeListing({ description_html: longHtml });
    const scrape = buildHaulScrapeFromListing('res-6', listing, makeDiagnostics());

    expect(scrape.description_html).toBeUndefined();
  });

  it('omits description_html when not present on listing', () => {
    const listing = makeListing({ description_html: '' });
    const scrape = buildHaulScrapeFromListing('res-7', listing, makeDiagnostics());

    expect(scrape.description_html).toBeUndefined();
  });
});
