import { describe, it, expect } from 'vitest';
import { splitPropertyHash } from '../../src/lib/extractor/schema-splitter.js';
import { normalizePropertyType } from '../../src/lib/extractor/property-type-normalizer.js';
import { detectListingType } from '../../src/lib/extractor/listing-type-detector.js';

/**
 * Tests for the PWB format response transformation.
 *
 * Since the actual POST endpoint requires auth, Firestore, and mapping infrastructure,
 * we test the core transformation logic directly: splitPropertyHash + normalizePropertyType
 * + detectListingType + image flattening — the same building blocks used by buildPwbResponse.
 */
describe('PWB format transformation', () => {
  // Simulates what buildPwbResponse does in listings.ts
  function transformToPwbFormat(
    props: Record<string, unknown>,
    sourceUrl: string,
    portalDefaults?: { country?: string; currency?: string; slug?: string },
  ) {
    const split = splitPropertyHash(props);
    const { assetData, listingData } = split;

    const assetResult: Record<string, unknown> = {
      reference: assetData.reference,
      street_address: assetData.street_address,
      city: assetData.city,
      region: assetData.region || assetData.province,
      postal_code: assetData.postal_code,
      country: assetData.country || portalDefaults?.country,
      latitude: assetData.latitude,
      longitude: assetData.longitude,
      prop_type_key: normalizePropertyType(
        (props.property_type as string) || (props.title as string),
      ),
      count_bedrooms: assetData.count_bedrooms,
      count_bathrooms: assetData.count_bathrooms,
      count_garages: assetData.count_garages,
      constructed_area: assetData.constructed_area,
      plot_area: assetData.plot_area,
      year_construction: assetData.year_construction,
      energy_rating: assetData.energy_rating,
      energy_performance: assetData.energy_performance,
    };

    const listingType = detectListingType(props, sourceUrl);

    const listingResult: Record<string, unknown> = {
      title: listingData.title,
      description: listingData.description,
      price_sale_current: props.for_sale ? listingData.price_float : 0,
      price_rental_monthly: (props.for_rent_long_term || props.for_rent_short_term) ? listingData.price_float : 0,
      currency: listingData.currency || portalDefaults?.currency,
      listing_type: listingType,
      furnished: listingData.furnished,
      for_sale: listingData.for_sale,
      for_rent_long_term: listingData.for_rent_long_term,
      for_rent_short_term: listingData.for_rent_short_term,
      features: assetData.features,
    };

    const rawImages = assetData.image_urls;
    let images: string[] = [];
    if (Array.isArray(rawImages)) {
      images = rawImages.map((img: unknown) => {
        if (typeof img === 'string') return img;
        if (img && typeof img === 'object' && 'url' in img) return (img as { url: string }).url;
        return '';
      }).filter(Boolean);
    }

    return {
      portal: portalDefaults?.slug,
      data: {
        asset_data: assetResult,
        listing_data: listingResult,
        images,
      },
    };
  }

  it('transforms a typical sale listing', () => {
    const props = {
      title: '3 bedroom house in Madrid',
      description: 'Beautiful property near the center',
      reference: 'REF-001',
      street_address: 'Calle Mayor 10',
      city: 'Madrid',
      province: 'Madrid',
      country: 'ES',
      postal_code: '28001',
      latitude: 40.4168,
      longitude: -3.7038,
      count_bedrooms: 3,
      count_bathrooms: 2,
      constructed_area: 120,
      price_float: 350000,
      price_string: '350.000 €',
      currency: 'EUR',
      for_sale: true,
      for_rent_long_term: false,
      image_urls: [{ url: 'https://img.example.com/1.jpg' }, { url: 'https://img.example.com/2.jpg' }],
      features: ['garage', 'garden', 'pool'],
      property_type: 'Casa adosada',
    };

    const result = transformToPwbFormat(
      props,
      'https://www.idealista.com/inmueble/12345/',
      { country: 'ES', currency: 'EUR', slug: 'es_idealista' },
    );

    expect(result.portal).toBe('es_idealista');
    expect(result.data.asset_data.city).toBe('Madrid');
    expect(result.data.asset_data.region).toBe('Madrid');
    expect(result.data.asset_data.country).toBe('ES');
    expect(result.data.asset_data.count_bedrooms).toBe(3);
    expect(result.data.asset_data.prop_type_key).toBe('house');
    expect(result.data.asset_data.latitude).toBe(40.4168);

    expect(result.data.listing_data.title).toBe('3 bedroom house in Madrid');
    expect(result.data.listing_data.description).toBe('Beautiful property near the center');
    expect(result.data.listing_data.price_sale_current).toBe(350000);
    expect(result.data.listing_data.price_rental_monthly).toBe(0);
    expect(result.data.listing_data.currency).toBe('EUR');
    expect(result.data.listing_data.listing_type).toBe('sale');
    expect(result.data.listing_data.for_sale).toBe(true);
    expect(result.data.listing_data.features).toEqual(['garage', 'garden', 'pool']);

    expect(result.data.images).toEqual([
      'https://img.example.com/1.jpg',
      'https://img.example.com/2.jpg',
    ]);
  });

  it('transforms a rental listing', () => {
    const props = {
      title: 'Bright flat for rent',
      description: 'Furnished apartment',
      city: 'London',
      country: 'GB',
      count_bedrooms: 1,
      price_float: 1500,
      currency: 'GBP',
      for_sale: false,
      for_rent_long_term: true,
      furnished: true,
      image_urls: ['https://img.example.com/a.jpg'],
      property_type: 'Flat',
    };

    const result = transformToPwbFormat(
      props,
      'https://www.rightmove.co.uk/to-rent/property/456',
      { country: 'GB', currency: 'GBP', slug: 'uk_rightmove' },
    );

    expect(result.data.listing_data.listing_type).toBe('rental');
    expect(result.data.listing_data.price_sale_current).toBe(0);
    expect(result.data.listing_data.price_rental_monthly).toBe(1500);
    expect(result.data.listing_data.furnished).toBe(true);
    expect(result.data.asset_data.prop_type_key).toBe('apartment');
    expect(result.data.images).toEqual(['https://img.example.com/a.jpg']);
  });

  it('falls back to portal defaults for country and currency', () => {
    const props = {
      title: 'Property',
      price_float: 200000,
      for_sale: true,
    };

    const result = transformToPwbFormat(
      props,
      'https://www.rightmove.co.uk/property/789',
      { country: 'GB', currency: 'GBP', slug: 'uk_rightmove' },
    );

    expect(result.data.asset_data.country).toBe('GB');
    expect(result.data.listing_data.currency).toBe('GBP');
  });

  it('maps province to region when region is not set', () => {
    const props = {
      province: 'Andalucía',
      city: 'Málaga',
    };

    const result = transformToPwbFormat(props, 'https://example.com/sale/1');
    expect(result.data.asset_data.region).toBe('Andalucía');
  });

  it('prefers region over province when both are set', () => {
    const props = {
      province: 'Madrid (province)',
      region: 'Comunidad de Madrid',
    };

    const result = transformToPwbFormat(props, 'https://example.com/sale/1');
    expect(result.data.asset_data.region).toBe('Comunidad de Madrid');
  });

  it('flattens image_urls from object format', () => {
    const props = {
      image_urls: [
        { url: 'https://img.example.com/1.jpg' },
        { url: 'https://img.example.com/2.jpg' },
      ],
    };

    const result = transformToPwbFormat(props, 'https://example.com/1');
    expect(result.data.images).toEqual([
      'https://img.example.com/1.jpg',
      'https://img.example.com/2.jpg',
    ]);
  });

  it('flattens image_urls from string format', () => {
    const props = {
      image_urls: ['https://img.example.com/1.jpg', 'https://img.example.com/2.jpg'],
    };

    const result = transformToPwbFormat(props, 'https://example.com/1');
    expect(result.data.images).toEqual([
      'https://img.example.com/1.jpg',
      'https://img.example.com/2.jpg',
    ]);
  });

  it('handles missing image_urls', () => {
    const result = transformToPwbFormat({}, 'https://example.com/1');
    expect(result.data.images).toEqual([]);
  });

  it('infers prop_type_key from title when property_type is absent', () => {
    const props = {
      title: 'Beautiful villa with sea views',
    };

    const result = transformToPwbFormat(props, 'https://example.com/1');
    expect(result.data.asset_data.prop_type_key).toBe('villa');
  });

  it('uses property_type over title for prop_type_key', () => {
    const props = {
      title: 'Amazing house for sale',  // would match "house"
      property_type: 'Apartamento',     // should match "apartment"
    };

    const result = transformToPwbFormat(props, 'https://example.com/1');
    expect(result.data.asset_data.prop_type_key).toBe('apartment');
  });

  it('detects listing type from URL when booleans are absent', () => {
    const result = transformToPwbFormat(
      { title: 'Flat' },
      'https://example.com/property/to-rent/123',
    );
    expect(result.data.listing_data.listing_type).toBe('rental');
  });

  it('title and description go to listing_data, not asset_data', () => {
    const props = {
      title: 'My Listing',
      description: 'Description here',
      city: 'London',
    };

    const result = transformToPwbFormat(props, 'https://example.com/1');
    expect(result.data.listing_data.title).toBe('My Listing');
    expect(result.data.listing_data.description).toBe('Description here');
    expect(result.data.asset_data).not.toHaveProperty('title');
    expect(result.data.asset_data).not.toHaveProperty('description');
  });
});
