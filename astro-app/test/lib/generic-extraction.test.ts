import { describe, it, expect } from 'vitest';
import { findByName } from '../../src/lib/extractor/mapping-loader.js';
import { extractFromHtml } from '../../src/lib/extractor/html-extractor.js';

describe('generic_real_estate mapping', () => {
  it('can be loaded via findByName', () => {
    const mapping = findByName('generic_real_estate');
    expect(mapping).not.toBeNull();
    expect(mapping!.name).toBe('generic_real_estate');
    expect(mapping!.expectedExtractionRate).toBe(0.30);
  });

  it('has expected field definitions', () => {
    const mapping = findByName('generic_real_estate');
    expect(mapping).not.toBeNull();
    expect(mapping!.textFields).toBeDefined();
    expect(mapping!.textFields!.title).toBeDefined();
    expect(mapping!.textFields!.description).toBeDefined();
    expect(mapping!.textFields!.price_string).toBeDefined();
    expect(mapping!.textFields!.address_string).toBeDefined();
    expect(mapping!.floatFields).toBeDefined();
    expect(mapping!.floatFields!.price_float).toBeDefined();
    expect(mapping!.floatFields!.latitude).toBeDefined();
    expect(mapping!.floatFields!.longitude).toBeDefined();
    expect(mapping!.intFields).toBeDefined();
    expect(mapping!.intFields!.count_bedrooms).toBeDefined();
    expect(mapping!.intFields!.count_bathrooms).toBeDefined();
  });

  it('extracts from HTML with JSON-LD RealEstateListing data', () => {
    const html = `
      <html>
      <head>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "RealEstateListing",
          "name": "Beautiful 3BR House in Portland",
          "description": "Spacious family home with garden",
          "offers": {
            "price": "450000",
            "priceCurrency": "USD"
          },
          "address": {
            "streetAddress": "123 Oak Street, Portland, OR"
          },
          "image": "https://example.com/photo1.jpg",
          "geo": {
            "latitude": "45.5152",
            "longitude": "-122.6784"
          },
          "numberOfBedrooms": "3",
          "numberOfBathroomsTotal": "2",
          "floorSize": {
            "value": "1800"
          }
        }
        </script>
      </head>
      <body><h1>Beautiful 3BR House in Portland</h1></body>
      </html>
    `;

    const result = extractFromHtml({
      html,
      sourceUrl: 'https://www.redfin.com/OR/Portland/123-Oak-St/home/12345',
      scraperMappingName: 'generic_real_estate',
    });

    expect(result.success).toBe(true);
    expect(result.properties).toHaveLength(1);

    const props = result.properties[0];
    expect(props.title).toBe('Beautiful 3BR House in Portland');
    expect(props.description).toBe('Spacious family home with garden');
    expect(props.price_string).toBe('450000');
    expect(props.price_float).toBe(450000);
    expect(props.address_string).toBe('123 Oak Street, Portland, OR');
    expect(props.latitude).toBeCloseTo(45.5152);
    expect(props.longitude).toBeCloseTo(-122.6784);
    expect(props.count_bedrooms).toBe(3);
    expect(props.count_bathrooms).toBe(2);
    expect(props.constructed_area).toBe(1800);
  });

  it('extracts from HTML with only OpenGraph tags', () => {
    const html = `
      <html>
      <head>
        <meta property="og:title" content="Modern Apartment in Amsterdam" />
        <meta property="og:description" content="2 bedroom apartment near the canal" />
        <meta property="og:image" content="https://example.com/amsterdam.jpg" />
        <meta name="description" content="Fallback description" />
      </head>
      <body><h1>Modern Apartment in Amsterdam</h1></body>
      </html>
    `;

    const result = extractFromHtml({
      html,
      sourceUrl: 'https://www.funda.nl/koop/amsterdam/huis-12345/',
      scraperMappingName: 'generic_real_estate',
    });

    expect(result.success).toBe(true);
    expect(result.properties).toHaveLength(1);

    const props = result.properties[0];
    expect(props.title).toBe('Modern Apartment in Amsterdam');
    expect(props.description).toBe('2 bedroom apartment near the canal');
    expect(props.main_image_url).toBe('https://example.com/amsterdam.jpg');
  });

  it('falls back to h1 for title when no JSON-LD or OG', () => {
    const html = `
      <html>
      <head>
        <meta name="description" content="A nice place to live" />
      </head>
      <body><h1>Charming Cottage</h1></body>
      </html>
    `;

    const result = extractFromHtml({
      html,
      sourceUrl: 'https://www.example-realestate.com/listing/42',
      scraperMappingName: 'generic_real_estate',
    });

    expect(result.success).toBe(true);
    const props = result.properties[0];
    expect(props.title).toBe('Charming Cottage');
  });
});
