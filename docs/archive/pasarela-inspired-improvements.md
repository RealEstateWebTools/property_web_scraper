# Pasarela-Inspired Improvements

Implementation plans derived from the pwb-pro-be pasarela (gateway) architecture.
Each section is a self-contained proposal with file-level changes, types, and code
sketches grounded in the current codebase.

---

## 1. Portal Configuration Registry

### Problem

Portal knowledge is scattered across three locations:

- `url-validator.ts` `LOCAL_HOST_MAP` stores hostname-to-scraper-name mappings
- `config/scraper_mappings/*.json` stores per-portal extraction rules
- `mapping-loader.ts` stores the name-to-mapping lookup

There is nowhere to put portal-level metadata like default country, currency,
content source type, or URL normalization rules. The pwb-pro-be `portal_config`
hash bundles all of this into one registry entry per portal.

### Design

Create a single `PortalConfig` type and a `PORTAL_REGISTRY` that replaces
`LOCAL_HOST_MAP` and augments it with portal metadata. The registry becomes the
single source of truth for "what do we know about this portal."

### File: `astro-app/src/lib/services/portal-registry.ts` (NEW)

```ts
export interface PortalConfig {
  /** Scraper mapping name in config/scraper_mappings/ */
  scraperName: string;

  /** URL slug for routing */
  slug: string;

  /** Hostnames this portal uses (www. and bare) */
  hosts: string[];

  /** Default country ISO code for listings from this portal */
  country: string;

  /** Default currency ISO 4217 code */
  currency: string;

  /** Default locale code */
  localeCode: string;

  /** Default area unit: 'sqft' | 'sqm' */
  areaUnit: 'sqft' | 'sqm';

  /** Primary content source the scraper extracts from */
  contentSource: 'html' | 'script_json' | 'json_ld' | 'flight_data';

  /** Expected extraction rate (0-1), used for quality scoring */
  expectedExtractionRate?: number;

  /** Whether to strip trailing slash when normalizing URLs */
  stripTrailingSlash?: boolean;

  /** Whether this portal is known to need JS rendering */
  requiresJsRendering?: boolean;
}

export const PORTAL_REGISTRY: Record<string, PortalConfig> = {
  rightmove: {
    scraperName: 'rightmove_v2',
    slug: 'rightmove',
    hosts: ['www.rightmove.co.uk', 'rightmove.co.uk'],
    country: 'GB',
    currency: 'GBP',
    localeCode: 'en',
    areaUnit: 'sqft',
    contentSource: 'script_json',
    expectedExtractionRate: 0.85,
    requiresJsRendering: false,
  },
  idealista: {
    scraperName: 'idealista_v2',
    slug: 'idealista',
    hosts: ['www.idealista.com', 'idealista.com'],
    country: 'ES',
    currency: 'EUR',
    localeCode: 'es',
    areaUnit: 'sqm',
    contentSource: 'script_json',
    expectedExtractionRate: 0.90,
    requiresJsRendering: true,
  },
  zoopla: {
    scraperName: 'zoopla_v2',
    slug: 'zoopla_v2',
    hosts: ['www.zoopla.co.uk', 'zoopla.co.uk'],
    country: 'GB',
    currency: 'GBP',
    localeCode: 'en',
    areaUnit: 'sqft',
    contentSource: 'flight_data',
    expectedExtractionRate: 0.80,
    requiresJsRendering: true,
  },
  realtor: {
    scraperName: 'realtor',
    slug: 'realtor',
    hosts: ['www.realtor.com', 'realtor.com'],
    country: 'US',
    currency: 'USD',
    localeCode: 'en',
    areaUnit: 'sqft',
    contentSource: 'json_ld',
  },
  fotocasa: {
    scraperName: 'fotocasa',
    slug: 'fotocasa',
    hosts: ['www.fotocasa.es', 'fotocasa.es'],
    country: 'ES',
    currency: 'EUR',
    localeCode: 'es',
    areaUnit: 'sqm',
    contentSource: 'html',
  },
  pisos: {
    scraperName: 'pisos',
    slug: 'pisos',
    hosts: ['www.pisos.com', 'pisos.com'],
    country: 'ES',
    currency: 'EUR',
    localeCode: 'es',
    areaUnit: 'sqm',
    contentSource: 'html',
  },
  realestateindia: {
    scraperName: 'realestateindia',
    slug: 'realestateindia',
    hosts: ['www.realestateindia.com', 'realestateindia.com'],
    country: 'IN',
    currency: 'INR',
    localeCode: 'en',
    areaUnit: 'sqft',
    contentSource: 'html',
  },
  forsalebyowner: {
    scraperName: 'forsalebyowner',
    slug: 'forsalebyowner',
    hosts: ['www.forsalebyowner.com', 'forsalebyowner.com'],
    country: 'US',
    currency: 'USD',
    localeCode: 'en',
    areaUnit: 'sqft',
    contentSource: 'html',
  },
  uk_jitty: {
    scraperName: 'uk_jitty',
    slug: 'uk_jitty',
    hosts: ['jitty.com', 'www.jitty.com'],
    country: 'GB',
    currency: 'GBP',
    localeCode: 'en',
    areaUnit: 'sqft',
    contentSource: 'script_json',
  },
  onthemarket: {
    scraperName: 'onthemarket',
    slug: 'onthemarket',
    hosts: ['www.onthemarket.com', 'onthemarket.com'],
    country: 'GB',
    currency: 'GBP',
    localeCode: 'en',
    areaUnit: 'sqft',
    contentSource: 'html',
    stripTrailingSlash: false,
  },
  daft: {
    scraperName: 'daft',
    slug: 'daft',
    hosts: ['www.daft.ie', 'daft.ie'],
    country: 'IE',
    currency: 'EUR',
    localeCode: 'en',
    areaUnit: 'sqm',
    contentSource: 'script_json',
    requiresJsRendering: true,
  },
};

/** Reverse lookup: hostname -> PortalConfig */
const hostIndex = new Map<string, PortalConfig>();
for (const config of Object.values(PORTAL_REGISTRY)) {
  for (const host of config.hosts) {
    hostIndex.set(host, config);
  }
}

export function findPortalByHost(hostname: string): PortalConfig | null {
  return hostIndex.get(hostname) || null;
}

export function findPortalByName(name: string): PortalConfig | null {
  return PORTAL_REGISTRY[name] || null;
}

export function allPortalNames(): string[] {
  return Object.keys(PORTAL_REGISTRY);
}
```

### Changes to existing files

**`url-validator.ts`** — Replace `LOCAL_HOST_MAP` usage with `findPortalByHost()`.
The `LOCAL_HOST_MAP` export is kept for backward compatibility but derived from
the registry:

```ts
import { PORTAL_REGISTRY, findPortalByHost } from './portal-registry.js';

// Derived for backward compatibility with admin pages that read LOCAL_HOST_MAP
export const LOCAL_HOST_MAP: Record<string, { scraper_name: string; slug: string }> = {};
for (const [name, config] of Object.entries(PORTAL_REGISTRY)) {
  for (const host of config.hosts) {
    LOCAL_HOST_MAP[host] = { scraper_name: config.scraperName, slug: config.slug };
  }
}
```

**`validateUrl()`** — Use `findPortalByHost()` instead of direct map lookup.

**`extraction-stats.ts`** — Use `findPortalByHost()` to enrich extraction
summaries with country/currency from the registry.

**`admin/scrapers.astro`, `admin/scrapers/[name].astro`** — Show portal metadata
(country, currency, content source, JS rendering required) from the registry.

### Why this matters

When adding a new scraper, you currently edit three files. With the registry, you
add one entry to `PORTAL_REGISTRY` and one mapping JSON file. The registry also
enables features like "show all UK scrapers" or "flag scrapers that need JS
rendering" in the admin interface.

---

## 2. Fallback Strategy Chains

### Problem

Each field in a mapping JSON currently specifies a single extraction strategy.
If the `cssLocator` fails (element not found, site layout changed), the field
gets an empty string. There is no fallback.

The pwb-pro-be pasarelas (especially IdealistaPasarela) implement multi-level
fallbacks: try script_json first, then JSON-LD, then CSS selectors, then a
minimal HTML fallback. But these are hardcoded in Ruby per portal.

We can bring this concept into our declarative JSON mapping format.

### Design

Add an optional `fallbacks` array to `FieldMapping`. When the primary strategy
returns empty, the extractor tries each fallback in order until one succeeds.

### Changes to `FieldMapping` type

**File: `astro-app/src/lib/extractor/mapping-loader.ts`**

Add to `FieldMapping`:

```ts
export interface FieldMapping {
  // ... existing fields ...

  /**
   * Ordered list of fallback strategies. Tried when the primary strategy
   * returns empty. Each fallback is a FieldMapping (without nested fallbacks).
   */
  fallbacks?: FieldMapping[];
}
```

### Changes to `retrieveTargetText()`

**File: `astro-app/src/lib/extractor/strategies.ts`**

Wrap the existing logic so that when the result is empty and `mapping.fallbacks`
exists, iterate through fallbacks:

```ts
export function retrieveTargetText(
  $: cheerio.CheerioAPI,
  html: string,
  mapping: FieldMapping,
  uri: URL
): string {
  let retrievedText = retrieveTargetTextSingle($, html, mapping, uri);

  // Try fallbacks if primary strategy returned empty
  if (retrievedText.trim() === '' && mapping.fallbacks) {
    for (const fallback of mapping.fallbacks) {
      retrievedText = retrieveTargetTextSingle($, html, fallback, uri);
      if (retrievedText.trim() !== '') break;
    }
  }

  return retrievedText;
}

/** Single-attempt extraction (the current logic, renamed) */
function retrieveTargetTextSingle(
  $: cheerio.CheerioAPI,
  html: string,
  mapping: FieldMapping,
  uri: URL
): string {
  // ... existing body of retrieveTargetText, unchanged ...
}
```

### Changes to `describeStrategy()` in `html-extractor.ts`

When a fallback was used, the diagnostics should reflect which strategy actually
produced the value. Update the FieldTrace to include `fallbackIndex`:

```ts
export interface FieldTrace {
  field: string;
  section: string;
  strategy: string;
  rawText: string;
  value: unknown;
  /** Which fallback produced the value (0 = primary, 1+ = fallback index) */
  fallbackUsed?: number;
}
```

In `extractFromHtml`, after calling `retrieveTargetText`, check if the primary
strategy would have been empty but the result is non-empty, to determine
which fallback was used. Alternatively, modify `retrieveTargetText` to return
metadata about which strategy succeeded:

```ts
export interface RetrievalResult {
  text: string;
  strategyIndex: number; // 0 = primary, 1+ = fallback
  strategyDescription: string;
}
```

### Mapping JSON example

```json
{
  "price_string": {
    "scriptJsonVar": "PAGE_MODEL",
    "scriptJsonPath": "propertyData.prices.primaryPrice",
    "fallbacks": [
      {
        "jsonLdPath": "offers.price",
        "jsonLdType": "Offer"
      },
      {
        "cssLocator": "#propertyHeaderPrice > strong"
      },
      {
        "cssLocator": "meta[property='og:price:amount']",
        "cssAttr": "content"
      }
    ]
  }
}
```

### Field-level impact

This is backward compatible. Existing mappings without `fallbacks` work exactly
as before. New mappings can progressively add fallbacks for fragile fields.

### Diagnostics integration

The admin extraction detail page (`/admin/extractions/[id]`) should show which
strategy (primary or fallback N) produced each field value. The Field Traces
table already has a "Strategy" column; the display would change from
`scriptJsonPath:propertyData.prices.primaryPrice` to
`scriptJsonPath:propertyData.prices.primaryPrice (fallback 2: cssLocator)` when
a fallback was used.

---

## 3. Weighted Quality Scoring

### Problem

The current quality scorer (`quality-scorer.ts`) uses a flat extraction rate:
populated extractable fields / total extractable fields. All fields are weighted
equally. Missing `title` counts the same as missing `energy_rating`.

The pwb-pro-be system has a `confidence_score` (0-100) that accounts for which
fields matter. Their pasarelas also distinguish between "extraction worked" and
"extraction produced useful data" (they check for specific critical fields).

### Design

Introduce field importance tiers. Critical fields (title, price, coordinates)
contribute more to the quality score than optional fields (energy_rating,
year_construction). This gives a more accurate signal for "is this extraction
usable."

### File: `astro-app/src/lib/extractor/quality-scorer.ts` (MODIFY)

```ts
export type QualityGrade = 'A' | 'B' | 'C' | 'F';
export type FieldImportance = 'critical' | 'important' | 'optional';

export interface GradeResult {
  grade: QualityGrade;
  label: string;
}

export interface QualityAssessment extends GradeResult {
  rate: number;
  weightedRate: number;
  expectedRate?: number;
  meetsExpectation: boolean;
  criticalFieldsMissing: string[];
}

/**
 * Field importance tiers with weights.
 * Critical fields are worth 3x, important 2x, optional 1x.
 */
const FIELD_WEIGHTS: Record<FieldImportance, number> = {
  critical: 3,
  important: 2,
  optional: 1,
};

/**
 * Classification of fields by importance.
 * Fields not listed here default to 'optional'.
 */
const FIELD_IMPORTANCE: Record<string, FieldImportance> = {
  // Critical: extraction is near-useless without these
  title: 'critical',
  price_string: 'critical',
  price_float: 'critical',

  // Important: key property attributes
  latitude: 'important',
  longitude: 'important',
  address_string: 'important',
  count_bedrooms: 'important',
  count_bathrooms: 'important',
  description: 'important',
  main_image_url: 'important',
  image_urls: 'important',
  reference: 'important',

  // Everything else: 'optional' by default
  // country, currency, area_unit, locale_code, for_sale, for_rent, etc.
};

export function getFieldImportance(fieldName: string): FieldImportance {
  return FIELD_IMPORTANCE[fieldName] || 'optional';
}

export function getFieldWeight(fieldName: string): number {
  return FIELD_WEIGHTS[getFieldImportance(fieldName)];
}

const gradeThresholds: { min: number; grade: QualityGrade; label: string }[] = [
  { min: 0.80, grade: 'A', label: 'Excellent' },
  { min: 0.50, grade: 'B', label: 'Good' },
  { min: 0.20, grade: 'C', label: 'Partial' },
  { min: 0, grade: 'F', label: 'Failed' },
];

export function computeQualityGrade(rate: number): GradeResult {
  for (const t of gradeThresholds) {
    if (rate >= t.min) {
      return { grade: t.grade, label: t.label };
    }
  }
  return { grade: 'F', label: 'Failed' };
}

export interface FieldResult {
  field: string;
  populated: boolean;
}

/**
 * Compute a weighted quality score from field results.
 * Returns both the flat rate (backward compatible) and the weighted rate.
 */
export function assessQualityWeighted(
  fieldResults: FieldResult[],
  expectedRate?: number
): QualityAssessment {
  let totalWeight = 0;
  let populatedWeight = 0;
  let populatedCount = 0;
  const criticalMissing: string[] = [];

  for (const { field, populated } of fieldResults) {
    const weight = getFieldWeight(field);
    totalWeight += weight;
    if (populated) {
      populatedWeight += weight;
      populatedCount++;
    } else if (getFieldImportance(field) === 'critical') {
      criticalMissing.push(field);
    }
  }

  const flatRate = fieldResults.length > 0
    ? populatedCount / fieldResults.length
    : 0;
  const weightedRate = totalWeight > 0 ? populatedWeight / totalWeight : 0;

  // Use weighted rate for grading
  const { grade, label } = computeQualityGrade(weightedRate);

  // If critical fields are missing, cap grade at C regardless of rate
  const finalGrade = criticalMissing.length > 0 && (grade === 'A' || grade === 'B')
    ? 'C' as QualityGrade
    : grade;
  const finalLabel = finalGrade !== grade
    ? 'Partial (missing critical fields)'
    : label;

  const meetsExpectation = expectedRate != null ? weightedRate >= expectedRate : true;

  return {
    grade: finalGrade,
    label: finalLabel,
    rate: flatRate,
    weightedRate,
    expectedRate,
    meetsExpectation,
    criticalFieldsMissing: criticalMissing,
  };
}

// Keep existing function for backward compatibility
export function assessQuality(rate: number, expectedRate?: number): QualityAssessment {
  const { grade, label } = computeQualityGrade(rate);
  const meetsExpectation = expectedRate != null ? rate >= expectedRate : true;
  return {
    grade, label, rate,
    weightedRate: rate,
    expectedRate, meetsExpectation,
    criticalFieldsMissing: [],
  };
}
```

### Changes to `html-extractor.ts`

After computing field traces, build `FieldResult[]` from the traces and call
`assessQualityWeighted` instead of `assessQuality`:

```ts
import { assessQualityWeighted, type FieldResult } from './quality-scorer.js';

// ... inside extractFromHtml, after traces are built:

const fieldResults: FieldResult[] = extractableTraces.map(t => ({
  field: t.field,
  populated: t.rawText !== '' && t.value !== 0 && t.value !== false && t.value !== '',
}));

const quality = assessQualityWeighted(fieldResults, mapping.expectedExtractionRate);
```

### Changes to `ExtractionDiagnostics`

Add new fields:

```ts
export interface ExtractionDiagnostics {
  // ... existing fields ...
  weightedExtractionRate: number;
  criticalFieldsMissing: string[];
}
```

### Admin UI changes

**Extraction detail page (`/admin/extractions/[id].astro`):**
- Show `weightedRate` alongside flat rate: "Rate: 67% (weighted: 52%)"
- Show critical missing fields with red warning: "Missing critical: title, price_string"
- The grade now reflects weighted importance, making it more actionable

**Dashboard (`/admin/index.astro`):**
- The "Average Quality" stat card should use weighted rate
- Extractions missing critical fields get a warning icon in the table

### Why weighted scoring matters

Consider an extraction that populates 12 of 16 fields (75%, grade B). But the 4
missing fields are title, price_string, latitude, and longitude. The flat rate
says "Good" but the extraction is actually useless. Weighted scoring would rate
this as grade C or F because the critical fields are missing.

---

## 4. Canonical URL Deduplication

### Problem

The in-memory listing store has no deduplication. Extracting the same URL twice
creates two separate entries. The pwb-pro-be system uses `scrape_unique_url` and
`get_canonical_url_from_url()` to normalize URLs and prevent duplicates.

### Design

Add a URL canonicalization function and a dedup check in the store.

### File: `astro-app/src/lib/services/url-canonicalizer.ts` (NEW)

```ts
/**
 * Normalize a property listing URL for deduplication.
 *
 * Rules applied:
 * 1. Lowercase the hostname
 * 2. Remove tracking query parameters (utm_*, fbclid, etc.)
 * 3. Remove trailing slashes (configurable per portal)
 * 4. Remove fragment/hash
 * 5. Normalize protocol to https
 *
 * Inspired by pwb-pro-be SharedScraperHelpers.get_canonical_url_from_url
 */

const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'ref', 'source', 'channel',
]);

export function canonicalizeUrl(url: string, stripTrailingSlash = true): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url; // Return as-is if unparseable
  }

  // Normalize protocol
  parsed.protocol = 'https:';

  // Lowercase hostname
  parsed.hostname = parsed.hostname.toLowerCase();

  // Remove tracking params
  const params = new URLSearchParams(parsed.search);
  for (const key of [...params.keys()]) {
    if (TRACKING_PARAMS.has(key.toLowerCase())) {
      params.delete(key);
    }
  }
  parsed.search = params.toString() ? `?${params.toString()}` : '';

  // Remove fragment
  parsed.hash = '';

  // Handle trailing slash
  if (stripTrailingSlash && parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
    parsed.pathname = parsed.pathname.slice(0, -1);
  }

  return parsed.toString();
}

/**
 * Generate a deduplication key from a URL.
 * More aggressive normalization for matching purposes.
 */
export function deduplicationKey(url: string): string {
  const canonical = canonicalizeUrl(url);
  try {
    const parsed = new URL(canonical);
    // Key is hostname + pathname (ignore all query params for dedup)
    return `${parsed.hostname}${parsed.pathname}`;
  } catch {
    return canonical;
  }
}
```

### Changes to `listing-store.ts`

Add a reverse index from canonical URL to listing ID. When storing a new listing,
check if the same canonical URL already exists and update instead of creating
a duplicate:

```ts
import { deduplicationKey } from './url-canonicalizer.js';

const urlIndex = new Map<string, string>(); // canonical URL -> listing ID

export async function storeListing(id: string, listing: Listing): Promise<void> {
  store.set(id, listing);

  // Index by canonical URL for dedup
  const importUrl = listing.import_url;
  if (importUrl) {
    const key = deduplicationKey(importUrl);
    urlIndex.set(key, id);
  }

  if (kv) {
    await kv.put(`listing:${id}`, JSON.stringify(listing), { expirationTtl: 3600 });
  }
}

/** Find existing listing by canonical URL match */
export function findListingByUrl(url: string): string | undefined {
  const key = deduplicationKey(url);
  return urlIndex.get(key);
}
```

### Changes to extraction API endpoint

Before creating a new listing, check `findListingByUrl()`. If found, update the
existing listing instead of creating a new ID. Return the existing ID in the
redirect so the user sees the updated version.

### Admin UI enhancement

Show canonical URL and dedup key in the extraction detail page, so operators can
see which URLs resolve to the same listing.

---

## 5. Pasarela-Style Output Schema Split

### Problem

Our extractor produces a single flat `propertyHash` with all fields mixed
together. The pwb-pro-be pasarelas produce two separate hashes:
`extracted_asset_data` (physical property) and `extracted_listing_data`
(sale-specific details). This separation matters for downstream systems that
need to update listing data (price changes) without touching asset data
(coordinates, rooms).

### Design

Add a post-extraction step that splits the flat property hash into asset and
listing sub-objects. This is additive — the flat hash remains available for
backward compatibility.

### File: `astro-app/src/lib/extractor/schema-splitter.ts` (NEW)

```ts
/**
 * Split a flat property hash into asset and listing schemas,
 * matching the pwb-pro-be pasarela output format.
 *
 * Asset = physical property attributes (stable over time)
 * Listing = sale/listing attributes (change with each listing)
 */

/** Fields that belong to the physical property (asset) */
const ASSET_FIELDS = new Set([
  'reference', 'title', 'description',
  'address_string', 'street_address', 'street_name', 'street_number',
  'postal_code', 'city', 'province', 'region', 'country',
  'latitude', 'longitude',
  'constructed_area', 'plot_area', 'area_unit',
  'count_bedrooms', 'count_bathrooms', 'count_toilets', 'count_garages',
  'year_construction', 'energy_rating', 'energy_performance',
  'image_urls', 'main_image_url',
  'features',
]);

/** Fields that belong to the listing (sale-specific) */
const LISTING_FIELDS = new Set([
  'price_string', 'price_float', 'currency',
  'for_sale', 'for_rent', 'for_rent_short_term', 'for_rent_long_term',
  'furnished', 'sold', 'reserved',
  'locale_code',
]);

export interface SplitSchema {
  assetData: Record<string, unknown>;
  listingData: Record<string, unknown>;
  unmapped: Record<string, unknown>;
}

export function splitPropertyHash(
  propertyHash: Record<string, unknown>
): SplitSchema {
  const assetData: Record<string, unknown> = {};
  const listingData: Record<string, unknown> = {};
  const unmapped: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(propertyHash)) {
    if (ASSET_FIELDS.has(key)) {
      assetData[key] = value;
    } else if (LISTING_FIELDS.has(key)) {
      listingData[key] = value;
    } else {
      unmapped[key] = value;
    }
  }

  return { assetData, listingData, unmapped };
}
```

### Changes to `ExtractionResult`

Add the split schema to the extraction result and diagnostics:

```ts
export interface ExtractionResult {
  success: boolean;
  properties: Record<string, unknown>[];
  errorMessage?: string;
  diagnostics?: ExtractionDiagnostics;
  /** Property data split into asset/listing schemas (pwb-pro-be compatible) */
  splitSchema?: SplitSchema;
}
```

### Changes to `extractFromHtml()`

After building the property hash, compute the split:

```ts
import { splitPropertyHash } from './schema-splitter.js';

// ... at end of extractFromHtml:
const splitSchema = splitPropertyHash(propertyHash);
return { success: true, properties: [propertyHash], diagnostics, splitSchema };
```

### API endpoint changes

The JSON listing endpoint (`/listings/[id].json`) gains an optional
`?format=split` query parameter that returns:

```json
{
  "assetData": { "title": "...", "latitude": 51.5, ... },
  "listingData": { "price_string": "350,000", "for_sale": true, ... },
  "unmapped": { ... }
}
```

### Why this matters for pwb-pro-be integration

When property_web_scraper is used as an extraction service for pwb-pro-be, the
split schema can be directly passed to `FullListingAndAssetCreator
.create_from_standardised_hash()`. The hash format matches what pasarelas
produce: `{ asset_data: {...}, listing_data: {...}, listing_image_urls: [...] }`.

---

## 6. Price Normalization

### Problem

Our system stores prices as `price_string` (display text like "350,000") and
`price_float` (parsed number). The pwb-pro-be system stores
`price_sale_current_cents` (integer) + `price_sale_current_currency` (string).

Floating-point prices cause rounding errors. Price strings vary by locale
(1.250.000 vs 1,250,000). There is no structured way to know the currency
beyond the `defaultValues` in the mapping.

### Design

Add a price normalization step that produces cents + currency from the raw
extraction. This runs after the extractor and before storage.

### File: `astro-app/src/lib/extractor/price-normalizer.ts` (NEW)

```ts
export interface NormalizedPrice {
  /** Price in smallest currency unit (cents/pence). Integer. */
  priceCents: number;
  /** ISO 4217 currency code */
  currency: string;
  /** Original display string preserved for UI */
  displayString: string;
}

/**
 * Currency symbols and their ISO codes.
 */
const CURRENCY_SYMBOLS: Record<string, string> = {
  '$': 'USD', 'USD': 'USD',
  '\u00a3': 'GBP', 'GBP': 'GBP',   // pound sign
  '\u20ac': 'EUR', 'EUR': 'EUR',    // euro sign
  '\u20b9': 'INR', 'INR': 'INR',    // rupee sign
};

/**
 * Detect currency from a price string.
 */
function detectCurrency(priceString: string, fallbackCurrency?: string): string {
  for (const [symbol, code] of Object.entries(CURRENCY_SYMBOLS)) {
    if (priceString.includes(symbol)) return code;
  }
  return fallbackCurrency || 'EUR';
}

/**
 * Parse a price string into cents.
 * Handles formats: "350,000", "1.250.000", "$350,000", "350 000 EUR"
 */
function parsePriceToCents(priceString: string): number {
  // Remove currency symbols, letters, and whitespace
  let cleaned = priceString.replace(/[^\d.,]/g, '');

  if (!cleaned) return 0;

  // Determine decimal separator:
  // If last separator is a comma with 1-2 digits after: comma is decimal (EU format)
  // If last separator is a period with 1-2 digits after: period is decimal (US/UK format)
  // Otherwise: no decimal part
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  if (lastComma > lastDot && cleaned.length - lastComma <= 3) {
    // EU format: 1.250.000,50
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma && cleaned.length - lastDot <= 3) {
    // US/UK format: 1,250,000.50
    cleaned = cleaned.replace(/,/g, '');
  } else {
    // No decimal: 1,250,000 or 1.250.000 (whole number)
    cleaned = cleaned.replace(/[.,]/g, '');
  }

  const value = parseFloat(cleaned);
  if (isNaN(value)) return 0;

  return Math.round(value * 100);
}

/**
 * Normalize price data from extraction results.
 */
export function normalizePrice(
  priceString: string,
  priceFloat: number,
  fallbackCurrency?: string
): NormalizedPrice {
  const currency = detectCurrency(priceString, fallbackCurrency);

  // Prefer parsing from string (more accurate for locale-specific formats)
  let priceCents = parsePriceToCents(priceString);

  // Fallback to price_float if string parsing failed
  if (priceCents === 0 && priceFloat > 0) {
    priceCents = Math.round(priceFloat * 100);
  }

  return {
    priceCents,
    currency,
    displayString: priceString,
  };
}
```

### Integration point

After `extractFromHtml()` returns, call `normalizePrice()` on the result and
store the normalized price alongside the raw values:

```ts
const result = extractFromHtml(params);
if (result.success && result.properties[0]) {
  const props = result.properties[0];
  const portal = findPortalByHost(new URL(sourceUrl).hostname);
  const normalized = normalizePrice(
    String(props.price_string || ''),
    Number(props.price_float || 0),
    portal?.currency
  );
  props.price_cents = normalized.priceCents;
  props.price_currency = normalized.currency;
}
```

### Changes to `Listing` model

Add `price_cents` and `price_currency` fields. These coexist with the existing
`price_string` and `price_float` for backward compatibility.

---

## 7. Extraction Provenance Tracking

### Problem

When an extraction partially fails, the operator sees empty fields but doesn't
know *why* they're empty. Was the CSS selector wrong? Did the page structure
change? Was the content not loaded (JS rendering issue)?

The pwb-pro-be pasarelas log debug information at each step and store content
metadata (`content_is_html`, `content_is_json`, `full_content_before_js_length`).

### Design

Add content analysis metadata to `ExtractionDiagnostics` so the admin interface
can show *why* extraction failed, not just *that* it failed.

### Changes to `ExtractionDiagnostics`

```ts
export interface ContentAnalysis {
  /** Total HTML length */
  htmlLength: number;
  /** Whether the HTML contains <script> tags with data */
  hasScriptTags: boolean;
  /** Number of JSON-LD blocks found */
  jsonLdCount: number;
  /** Named script variables found (e.g. ['PAGE_MODEL', '__NEXT_DATA__']) */
  scriptJsonVarsFound: string[];
  /** Whether the page appears to be a bot-block / CAPTCHA page */
  appearsBlocked: boolean;
  /** Whether the page appears to be a JS-only shell (minimal HTML content) */
  appearsJsOnly: boolean;
}
```

### New function in `html-extractor.ts`

```ts
function analyzeContent($: cheerio.CheerioAPI, html: string): ContentAnalysis {
  const scriptTags = $('script');
  const jsonLdCount = $('script[type="application/ld+json"]').length;

  // Check for known script variables
  const knownVars = ['PAGE_MODEL', '__NEXT_DATA__', '__INITIAL_STATE__', 'dataLayer'];
  const scriptText = scriptTags.text();
  const varsFound = knownVars.filter(v => scriptText.includes(v));

  // Detect bot blocks: pages with very little content or known block patterns
  const bodyText = $('body').text().trim();
  const appearsBlocked = bodyText.length < 200 && (
    bodyText.toLowerCase().includes('captcha') ||
    bodyText.toLowerCase().includes('verify') ||
    bodyText.toLowerCase().includes('access denied') ||
    bodyText.toLowerCase().includes('cloudflare')
  );

  // Detect JS-only shells: minimal body content but script tags present
  const appearsJsOnly = bodyText.length < 500 && scriptTags.length > 3
    && $('div').length < 10;

  return {
    htmlLength: html.length,
    hasScriptTags: scriptTags.length > 0,
    jsonLdCount,
    scriptJsonVarsFound: varsFound,
    appearsBlocked,
    appearsJsOnly,
  };
}
```

### Admin UI integration

The extraction detail page shows a "Content Analysis" card in the right column:

- HTML Length: 245,321 bytes
- Script variables: PAGE_MODEL, __NEXT_DATA__
- JSON-LD blocks: 2
- Status: Content looks normal / Appears blocked / Appears JS-only

When `appearsBlocked` or `appearsJsOnly` is true, show a warning banner
suggesting the user provide JS-rendered HTML.

---

## Implementation Order

These proposals are independent and can be implemented in any order. Recommended
priority based on effort-to-value ratio:

| Priority | Proposal | Effort | Value |
|----------|----------|--------|-------|
| 1 | Portal Configuration Registry | Medium | High |
| 2 | Weighted Quality Scoring | Low | High |
| 3 | Fallback Strategy Chains | Medium | High |
| 4 | Canonical URL Deduplication | Low | Medium |
| 5 | Price Normalization | Low | Medium |
| 6 | Extraction Provenance Tracking | Low | Medium |
| 7 | Output Schema Split | Medium | Medium |

Proposals 1-3 deliver the most immediate operational value: the registry
reduces maintenance friction, weighted scoring eliminates misleading grades,
and fallback chains make scrapers more resilient to site changes.

Proposals 4-6 are small, focused additions that improve data quality.

Proposal 7 is primarily valuable for pwb-pro-be integration and can wait until
that integration is actively needed.
