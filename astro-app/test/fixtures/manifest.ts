/**
 * Scraper Validation Manifest
 *
 * Central registry of all scrapers and their expected extraction results.
 * Used by `scraper-validation.test.ts` to verify each scraper against
 * saved HTML fixtures in `test/fixtures/*.html`.
 *
 * ## Workflow for fixing broken scrapers
 *
 * 1. **Identify failures**: Run `npx vitest run test/lib/scraper-validation.test.ts`
 * 2. **Inspect HTML**: Open `test/fixtures/SCRAPER.html`, find the actual DOM elements
 * 3. **Fix mapping**: Edit `config/scraper_mappings/SCRAPER.json` with correct selectors
 * 4. **Update manifest**: Update expected values in `test/fixtures/manifest.ts`
 * 5. **Verify**: Re-run tests
 *
 * ## Adding a new scraper
 *
 * 1. Save a listing page as `test/fixtures/{scraper_name}.html`
 * 2. Add an entry to the `fixtures` array below
 * 3. Fill in `expected` with values you manually confirmed from the HTML
 * 4. Run `npx vitest run test/lib/scraper-validation.test.ts` to verify
 *
 * ## Common pitfalls
 *
 * - Field in multiple sections → last wins (textFields overwrites intFields)
 * - No `cssCountId` → Cheerio concatenates ALL matched elements
 * - Cheerio converts `<br>` → `\n` not `\r`
 * - `defaultValues` always produces strings (e.g. `for_sale: "true"`)
 * - Processing order: defaults → images → features → int → float → text → boolean
 *
 * ## Coverage
 *
 * Entries with `fixture: null` are scrapers that don't have HTML fixtures yet.
 * These are automatically skipped in tests. To add a fixture:
 *   `npx tsx scripts/capture-fixture.ts <listing-url>`
 */

/**
 * A single scraper validation entry.
 */
export interface FixtureEntry {
  /** Scraper mapping name, e.g. 'uk_rightmove'. Must match a file in config/scraper_mappings/ */
  scraper: string;
  /** HTML fixture filename (without .html extension), or null if no fixture exists yet */
  fixture: string | null;
  /** Source URL used for extraction context (hostname detection, URL-based fields) */
  sourceUrl: string;
  /** How the HTML was obtained. 'browser' = JS-rendered capture, 'server-fetched' = plain HTTP fetch. Defaults to 'browser'. */
  source?: 'browser' | 'server-fetched';
  /** Expected extracted property values. Only listed fields are asserted — unlisted fields are ignored */
  expected: Record<string, unknown>;
}

/**
 * Get the source of a fixture entry, defaulting to 'browser'.
 */
export function getFixtureSource(entry: FixtureEntry): 'browser' | 'server-fetched' {
  return entry.source ?? 'browser';
}

/**
 * Get only entries that have HTML fixtures available for testing.
 * Optionally filter by source type.
 */
export function getTestableFixtures(source?: 'browser' | 'server-fetched'): FixtureEntry[] {
  return fixtures.filter(f => {
    if (f.fixture === null || Object.keys(f.expected).length === 0) return false;
    if (source && getFixtureSource(f) !== source) return false;
    return true;
  });
}

/**
 * Get entries that still need HTML fixtures captured.
 */
export function getMissingFixtures(): FixtureEntry[] {
  return fixtures.filter(f => f.fixture === null);
}

/**
 * Get a summary of fixture coverage.
 */
export function getCoverageSummary() {
  const total = fixtures.length;
  const withFixture = fixtures.filter(f => f.fixture !== null).length;
  const withExpected = fixtures.filter(f => Object.keys(f.expected).length > 1).length;
  const totalExpectedFields = fixtures.reduce((sum, f) => sum + Object.keys(f.expected).length, 0);
  const serverFetchedFixtures = fixtures.filter(f => getFixtureSource(f) === 'server-fetched' && f.fixture !== null).length;
  return { total, withFixture, withExpected, totalExpectedFields, serverFetchedFixtures, coveragePercent: Math.round((withFixture / total) * 100) };
}

export const fixtures: FixtureEntry[] = [
  {
    scraper: 'us_realtor',
    fixture: 'us_realtor',
    sourceUrl: 'https://www.realtor.com/realestateandhomes-detail/2200-Pacific-Ave-B1_San-Francisco_CA_94115_M20341-51800',
    expected: {
      country: 'USA',
      currency: 'USD',
      title: '2200 Pacific Ave Unit 1B',
      price_string: '1495000',
      price_float: 1495000,
      count_bedrooms: 1,
      count_bathrooms: 1,
      latitude: 37.794001,
      longitude: -122.431811,
      reference: '2034151800',
      postal_code: '94115',
      city: 'San Francisco',
      region: 'CA',
      address_string: '2200 Pacific Ave Unit 1B',
      property_type: 'condo',
      description: '2200 Pacific Ave Unit 1B, San Francisco, CA 94115 is for sale. View detailed information about property including listing details, property photos, open house information, school and neighborhood data, and much more.',
      main_image_url: 'https://ap.rdcpix.com/d0e0a1cd96f9395db40ac03d2d623935l-m3019156007s.jpg',
      for_sale: true,
      for_rent: false,
    },
  },
  {
    scraper: 'es_fotocasa',
    fixture: 'es_fotocasa',
    sourceUrl: 'https://www.fotocasa.es/es/comprar/vivienda/benavente/trastero-ascensor/185235713/d',
    expected: {
      country: 'Spain',
      currency: 'EUR',
      title: 'Piso en venta en Avenida de la Libertad, 13, Benavente, Zamora',
      count_bedrooms: 3,
      count_bathrooms: 1,
      constructed_area: 95,
      price_string: '65.000 \u20AC',
      price_float: 65000,
      reference: '185235713',
      latitude: 41.99463,
      longitude: -5.6792,
      postal_code: '49600',
      city: 'Benavente',
      region: 'Zamora',
      description: 'Piso de 3 dormitorios en venta en Avda Libertad, Benavente.\n\nLa vivienda cuenta con 95.59 m2 distribuidos en vest\u00edbulo de entrada, sal\u00f3n comedor, cocina, tres dormitorios, un cuarto de ba\u00f1o y dos terrazas.\n\nEl sistema de calefacci\u00f3n es mediante caldera individual alimentada por propano.\n\n\u00a1Contacta con Inmobiliaria Procasa y te informaremos sin compromiso! [IW]',
      main_image_url: 'https://static.fotocasa.es/images/ads/d38801fe-dbb4-4a8e-8365-f8e354a38b8a?rule=f_640x480_jpg_70',
      for_rent: false,
      for_sale: true,
      locale_code: 'es',
    },
  },
  {
    scraper: 'es_pisos',
    fixture: 'pisos_dot_com',
    sourceUrl: 'https://www.pisos.com/comprar/piso-madrid_capital/12345/',
    expected: {
      country: 'Spain',
      currency: 'EUR',
      title: 'Piso en venta en Calle Goya, n\u00BA 54 en Goya por 990.000 \u20AC',
      price_string: '990.000 \u20AC',
      price_float: 990000,
      description: '\u00a1Inmueble en rentabilidad\u00a1 Esta vivienda acaba de ser alquilada con todo tipo de garant\u00edas, es ideal para personas que quieran invertir en el barrio de salamanca, en l...',
      main_image_url: 'https://fotos.imghs.net/xl/1001/738/1001_PX1495_-_38604738-38604738_1_2017122101080331250.jpg',
      address_string: 'Goya (Distrito Salamanca. Madrid Capital)',
      for_sale: true,
      for_rent: false,
      locale_code: 'es',
    },
  },
  {
    scraper: 'in_realestateindia',
    fixture: 'realestateindia',
    sourceUrl: 'https://www.realestateindia.com/property-detail/residential-property-for-sale-in-delhi-12345.htm',
    expected: {
      country: 'India',
      currency: 'INR',
      title: '2 BHK Flats & Apartments for Rent in Andheri West, Mumbai - 10000 Sq. Yards',
      price_float: 45000,
      price_string: '45,000',
      latitude: 0,
      longitude: 0,
      description: 'Find detail of 2 BHK Flats & Apartments for Rent in Andheri West, Mumbai, Maharashtra (REI712907) posted by Vikas Estate Agency - on RealEstateIndia.com.',
      for_rent: true,
      for_rent_long_term: true,
      for_sale: false,
      locale_code: 'en',
    },
  },
  {
    scraper: 'us_mlslistings',
    fixture: 'mlslistings',
    sourceUrl: 'https://www.mlslistings.com/property/ml81234567/some-address',
    expected: {
      country: 'USA',
      currency: 'USD',
      title: '1547 Desdemona CT, SAN JOSE, CA 95121 ( For Sale )',
      price_string: '$489,000',
      price_float: 489000,
      constructed_area: 1176,
      latitude: 37.313407,
      longitude: -121.823499,
      reference: 'ML81643266',
      count_bedrooms: '3',
      year_construction: 1972,
      property_type: 'Condominium',
      main_image_url: 'http://data.mlslistings.com/GetMedia.ashx?Q=RmlsZUlEPTM5NjkwMTI5NQ%3d%3d&Hash=5a5ff2643e30251129add44affeb7455',
      for_sale: true,
    },
  },

  {
    scraper: 'us_wyomingmls',
    fixture: 'wyomingmls',
    sourceUrl: 'https://www.wyomingmls.com/listing/12345',
    expected: {
      country: 'USA',
      currency: 'USD',
      title: 'Residential Property 20176813 - Wyoming MLS - Your Complete Source For Real Estate in Wyoming',
      year_construction: 2002,
      count_bedrooms: 3,
      count_bathrooms: 2,
      constructed_area: 1056,
      latitude: 42.852044,
      longitude: -106.28227,
      price_float: 33500,
      price_string: '$33,500',
      reference: '20176813',
      description: '350 N FOREST DR LOT #20  -  THIS HOME CAN BE MOVED  2002 16x66 3 bedroom 2 bathroom mobile home for sale. This mobile home is in immaculate condition and sits on a beautiful lot! The home includes a $2,000 shed, has a new $5,000 roof, fenced yard, fresh paint and has brand new beautiful flooring. This is a must see! Motivated Seller - bring your offer! Call Janet Reinhart 307-262-0361 for your private showing!',
      locale_code: 'en',
    },
  },


  {
    scraper: 'us_forsalebyowner',
    fixture: 'forsalebyowner',
    sourceUrl: 'https://www.forsalebyowner.com/listing/12345',
    expected: {
      country: 'USA',
      currency: 'USD',
      price_string: '$349,900',
      description: 'Charming 4 bedroom home with modern updates throughout. Open floor plan with hardwood floors.',
      locale_code: 'en',
    },
  },
  {
    scraper: 'us_zillow',
    fixture: 'us_zillow',
    sourceUrl: 'https://www.zillow.com/homedetails/4836-Sicily-Dr-Lake-Elsinore-CA-92530/456486259_zpid/',
    expected: {
      country: 'USA',
      currency: 'USD',
      locale_code: 'en',
      area_unit: 'sqft',
      title: '4836 Sicily Dr, Lake Elsinore, CA 92530',
      address_string: '4836 Sicily Dr, Lake Elsinore, CA 92530',
      street_address: '4836 Sicily Dr',
      city: 'Lake Elsinore',
      region: 'CA',
      postal_code: '92530',
      price_float: 685900,
      price_string: '$685,900',
      count_bedrooms: 5,
      count_bathrooms: 3,
      constructed_area: 2517,
      latitude: 33.69794,
      longitude: -117.37369,
      reference: '456486259',
      year_construction: 2023,
      property_type: 'SingleFamily',
      description: 'Zillow has 44 photos of this $685,900 5 beds, 3 baths, 2,517 Square Feet single family home located at 4836 Sicily Dr, Lake Elsinore, CA 92530 built in 2023. MLS #IG26033705. 3D Home Tour Available!',
      for_sale: true,
      for_rent: false,
    },
  },

  {
    scraper: 'uk_rightmove',
    fixture: 'uk_rightmove',
    sourceUrl: 'https://www.rightmove.co.uk/properties/171844895',
    expected: {
      country: 'UK',
      currency: 'GBP',
      title: '4 bedroom detached house for sale in Stephen Road, Headington, OX3',
      address_string: 'Stephen Road, Headington, OX3',
      region: 'England',
      price_string: '\u00A3695,000',
      price_float: 695000,
      count_bedrooms: 4,
      count_bathrooms: 2,
      latitude: 51.76085,
      longitude: -1.212635,
      reference: '171844895',
      postal_code: 'OX3 9AY',
      property_type: 'Detached',
      tenure: 'FREEHOLD',
      main_image_url: 'https://media.rightmove.co.uk/property-photo/1ea796601/171844895/1ea796601ef4700b5cfa10c29a148d74.jpeg',
      for_sale: true,
      for_rent: false,
      locale_code: 'en',
    },
  },
  {
    scraper: 'uk_jitty',
    fixture: 'uk_jitty',
    sourceUrl: 'https://jitty.com/properties/rtI0BPlsWvEohngvc7HB',
    expected: {
      address_string: 'Sandland Grove, Nantwich',
      constructed_area: 1611,
      count_bathrooms: 3,
      count_bedrooms: 4,
      country: 'UK',
      currency: 'GBP',
      for_rent: false,
      for_sale: true,
      latitude: 53.0651626587,
      longitude: -2.50606894493,
      price_float: 465000,
      price_string: '\u00a3465,000',
      property_type: 'Detached',
      reference: 'rtI0BPlsWvEohngvc7HB',
      title: 'Sandland Grove, Nantwich',
      description: '4 Bed Detached House For Sale In Sandland Grove, Nantwich. Cut through irrelevant listings with powerful filters and AI search.',
      main_image_url: 'https://jitty-cdn.com/cdn-cgi/image/w=1200,h=630,fit=cover/blobs/eyJfcmFpbHMiOnsibWVzc2FnZSI6IkJBaHBCSDRMMVJJPSIsImV4cCI6bnVsbCwicHVyIjoiYmxvYl9pZCJ9fQ==--96d8e238014408cf06777f75aa945bd1987552a3',
      locale_code: 'en',
    },
  },
  {
    scraper: 'uk_zoopla',
    fixture: 'uk_zoopla',
    sourceUrl: 'https://www.zoopla.co.uk/for-sale/details/71365505/',
    expected: {
      country: 'UK',
      currency: 'GBP',
      title: 'Cecil Park, Herne Bay CT6, 4 bed semi-detached house for sale, \u00A3550,000 - Zoopla',
      address_string: 'Cecil Park, Herne Bay CT6',
      price_string: '\u00A3550,000',
      price_float: 550000,
      count_bedrooms: 4,
      count_bathrooms: 2,
      latitude: 51.36907,
      longitude: 1.134746,
      postal_code: 'CT6 6DL',
      reference: '71365505',
      property_type: 'semi_detached',
      main_image_url: 'https://lid.zoocdn.com/u/480/360/611ee8a15bb93510c3c3da707c92843b4f84d521.jpg',
      for_sale: true,
      for_rent: false,
      locale_code: 'en',
    },
  },
  {
    scraper: 'uk_onthemarket',
    fixture: 'uk_onthemarket',
    sourceUrl: 'https://www.onthemarket.com/details/16979647/',
    expected: {
      country: 'UK',
      currency: 'GBP',
      address_string: 'Upper Pavenhill, Purton SN5',
      price_string: '\u00A34,000,000',
      price_float: 4000000,
      latitude: 51.586400914027536,
      longitude: -1.889361933868401,
      reference: '16979647',
      property_type: 'Residential development',
      main_image_url: 'https://media.onthemarket.com/properties/16979647/1543454825/image-0-1024x1024.jpg',
      for_sale: true,
      for_rent: false,
      locale_code: 'en',
    },
  },
  {
    scraper: 'ie_daft',
    fixture: 'ie_daft',
    sourceUrl: 'https://www.daft.ie/for-sale/detached-house-12-the-avenue-plunkett-hall-dunboyne-co-meath/6477069',
    expected: {
      country: 'Ireland',
      currency: 'EUR',
      price_string: '\u20AC795,000',
      price_float: 795000,
      count_bedrooms: 4,
      count_bathrooms: 3,
      constructed_area: 151,
      latitude: 53.425962,
      longitude: -6.48145,
      reference: '6477069',
      property_type: 'Detached',
      city: 'Dunboyne',
      region: 'Meath',
      for_sale: true,
      for_rent: false,
      locale_code: 'en',
    },
  },
  {
    scraper: 'es_idealista',
    fixture: 'es_idealista',
    sourceUrl: 'https://www.idealista.com/en/inmueble/106387165/',
    expected: {
      country: 'Spain',
      currency: 'EUR',
      title: 'Duplex for sale in Calle de Alcal\u00E1',
      address_string: 'Goya, Madrid',
      price_string: '3,600,000 \u20AC',
      price_float: 3600000,
      count_bedrooms: 4,
      count_bathrooms: 5,
      constructed_area: 273,
      reference: '106387165',
      main_image_url: 'https://img4.idealista.com/blur/WEB_DETAIL/0/id.pro.es.image.master/c0/ac/cc/1382500227.jpg',
      for_sale: true,
      for_rent: false,
      locale_code: 'es',
    },
  },
  {
    scraper: 'es_idealista',
    fixture: 'es_idealista.server-fetched',
    sourceUrl: 'https://www.idealista.com/en/inmueble/106387165/',
    source: 'server-fetched',
    expected: {
      // Only default values survive — proves server-side fetch is useless
      country: 'Spain',
      currency: 'EUR',
      locale_code: 'es',
    },
  },
  {
    scraper: 'de_immoscout',
    fixture: 'de_immoscout',
    sourceUrl: 'https://www.immobilienscout24.de/expose/160531543',
    expected: {
      country: 'DE',
      currency: 'EUR',
      locale_code: 'de-DE',
      title: '3 Zimmer Etagenwohnung zum Kauf in Berlin Mitte',
      description: 'Wunderbare 3-Zimmer-Wohnung in zentraler Lage von Berlin Mitte mit Balkon und Einbaukueche.',
      address_string: '10115 Berlin (Mitte), Friedrichstrasse',
      price_string: '349.000 \u20AC',
      price_float: 349000,
      count_bedrooms: 3,
      count_bathrooms: 1,
      constructed_area: 85,
      year_construction: 1998,
      reference: '160531543',
      postal_code: '10115',
      city: 'Berlin',
      region: 'Berlin',
      latitude: 52.52437,
      longitude: 13.38886,
      main_image_url: 'https://pictures.immobilienscout24.de/listings/abc123-0.jpg/ORIG/legacy_thumbnail/420x315/format/webp/quality/50',
      for_sale: true,
      for_rent: false,
    },
  },
  {
    scraper: 'au_domain',
    fixture: 'au_domain',
    sourceUrl: 'https://www.domain.com.au/133-bethany-road-hoppers-crossing-vic-3029-2020615556',
    expected: {
      country: 'AU',
      currency: 'AUD',
      title: '133 Bethany Road, Hoppers Crossing VIC 3029 | Domain',
      address_string: '133 Bethany Road, Hoppers Crossing VIC 3029',
      price_string: '$470,000 - $500,000',
      count_bedrooms: 3,
      count_bathrooms: 1,
      latitude: -37.8539502,
      longitude: 144.6720433,
      postal_code: '3029',
      city: 'Hoppers Crossing',
      region: 'vic',
      property_type: 'House',
      reference: '2020615556',
      description: '3 bedroom house for Sale at 133 Bethany Road, Hoppers Crossing VIC 3029. View property photos, floor plans, local school catchments & lots more on Domain.com.au. 2020615556',
      main_image_url: 'https://bucket-api.domain.com.au/v1/bucket/image/2020615556_1_1_260218_045427-w1600-h1067',
      for_sale: true,
      for_rent: false,
      locale_code: 'en-AU',
    },
  },
  {
    scraper: 'au_realestate',
    fixture: 'au_realestate',
    sourceUrl: 'https://www.realestate.com.au/property-house-vic-tarneit-143160680',
    expected: {
      country: 'AU',
      currency: 'AUD',
      locale_code: 'en-AU',
      title: '28 Chantelle Parade, Tarneit VIC 3029 - House for Sale',
      description: '4 bedroom house for Sale at 28 Chantelle Parade, Tarneit VIC 3029. View property photos, floor plans, local school catchments and lots more on realestate.com.au. 143160680',
      address_string: '28 Chantelle Parade, Tarneit, Vic 3029',
      count_bedrooms: 4,
      count_bathrooms: 2,
      count_parking: 2,
      latitude: -37.85273,
      longitude: 144.66333,
      postal_code: '3029',
      city: 'Tarneit',
      region: 'Vic',
      reference: '143160680',
      property_type: 'House',
      land_area: 336,
      main_image_url: 'https://i2.au.reastatic.net/800x600/d8d3607342abc123/image.jpg',
      for_sale: true,
      for_rent: false,
    },
  },
];
