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
    fixture: 'realtor',
    sourceUrl: 'http://www.realtor.com/realestateandhomes-detail/5804-Cedar-Glen-Ln_Bakersfield_CA_93313_M12147-18296',
    expected: {
      country: 'USA',
      currency: 'USD',
      title: '5804 Cedar Glen Ln',
      price_string: '$144,950',
      price_float: 144950,
      constructed_area: 1133,
      count_bedrooms: 3,
      count_bathrooms: 2,
      latitude: 35.302092,
      longitude: -119.051509,
      reference: '602458820',
      postal_code: '93313',
      city: 'Bakersfield',
      region: 'CA',
      address_string: '5804 Cedar Glen Ln',
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
      for_rent: false,
      for_sale: true,
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
      for_rent: true,
      for_rent_long_term: true,
      for_sale: false,
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
    },
  },

  {
    scraper: 'uk_rightmove',
    fixture: 'uk_rightmove',
    sourceUrl: 'https://www.rightmove.co.uk/properties/171844895',
    expected: {
      country: 'UK',
      currency: 'GBP',
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
      for_sale: true,
      for_rent: false,
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
      for_sale: true,
      for_rent: false,
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
      for_sale: true,
      for_rent: false,
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
      for_sale: true,
      for_rent: false,
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
    },
  },
  {
    scraper: 'de_immoscout',
    fixture: null, // TODO: capture fixture with: npx tsx scripts/capture-fixture.ts <url>
    sourceUrl: 'https://www.immobilienscout24.de/TODO-listing-url',
    expected: {
      title: 'TODO',
    },
  },
  {
    scraper: 'fr_seloger',
    fixture: null, // TODO: capture fixture with: npx tsx scripts/capture-fixture.ts <url>
    sourceUrl: 'https://www.seloger.com/TODO-listing-url',
    expected: {
      title: 'TODO',
    },
  },
  {
    scraper: 'fr_leboncoin',
    fixture: null, // TODO: capture fixture with: npx tsx scripts/capture-fixture.ts <url>
    sourceUrl: 'https://www.leboncoin.fr/TODO-listing-url',
    expected: {
      title: 'TODO',
    },
  },
  {
    scraper: 'au_domain',
    fixture: null, // TODO: capture fixture with: npx tsx scripts/capture-fixture.ts <url>
    sourceUrl: 'https://www.domain.com.au/TODO-listing-url',
    expected: {
      title: 'TODO',
    },
  },
  {
    scraper: 'au_realestate',
    fixture: null, // TODO: capture fixture with: npx tsx scripts/capture-fixture.ts <url>
    sourceUrl: 'https://www.realestate.com.au/TODO-listing-url',
    expected: {
      title: 'TODO',
    },
  },
];
