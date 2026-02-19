# Scraper Mapping Reference

## Mapping file structure

Location: `config/scraper_mappings/<name>.json`

The file is a JSON array with a single object (parsed with JSON5, so comments are OK):

```json5
[{
  "name": "scraper_name",
  "defaultValues": { ... },
  "intFields": { ... },
  "floatFields": { ... },
  "textFields": { ... },
  "booleanFields": { ... },
  "images": [ ... ],
  "features": [ ... ]
}]
```

## Processing order

The extraction engine processes sections in this strict order. If the same field
name appears in multiple sections, the last one wins:

1. `defaultValues` — static values (always strings)
2. `images` — image URL arrays
3. `features` — feature string arrays
4. `intFields` — `parseInt(text, 10) || 0`
5. `floatFields` — `parseFloat(text) || 0` (with optional stripPunct/stripFirstChar)
6. `textFields` — `text.trim()`
7. `booleanFields` — evaluator function result (true/false)

## FieldMapping properties

### Text retrieval (pick one strategy)

| Property | Type | Description |
|----------|------|-------------|
| `cssLocator` | string | CSS selector (Cheerio). Most common strategy. |
| `scriptJsonVar` + `scriptJsonPath` | string | Extract from a named JSON variable in a script tag. See below. |
| `flightDataPath` | string | Dot-path into parsed Next.js RSC flight data (`self.__next_f.push`). See below. |
| `jsonLdPath` | string | Dot-path into JSON-LD `<script type="application/ld+json">` data. See below. |
| `scriptRegEx` | string | Regex pattern run against concatenated `<script>` tag text |
| `urlPathPart` | string | Extract URL path segment by index (1-based). `"3"` extracts 3rd segment. |

### Script JSON extraction (`scriptJsonVar` + `scriptJsonPath`)

| Property | Type | Description |
|----------|------|-------------|
| `scriptJsonVar` | string | Variable name to find in script tags. Supports `window.VAR = {...}` and `<script id="VAR">` patterns. |
| `scriptJsonPath` | string | Dot-notation path into the parsed JSON object (e.g. `"propertyData.bedrooms"`). |

Handles two patterns automatically:
- **Named variable assignment**: `window.PAGE_MODEL = {...}` — finds `window.VAR =` or `var VAR =` and extracts the JSON by counting braces
- **Script tag by ID**: `<script id="__NEXT_DATA__" type="application/json">{...}</script>` — finds `<script id="VAR">` and parses innerHTML

Results are cached per Cheerio instance so parsing only happens once even if 20+ fields use the same variable.

### Flight data path (`flightDataPath`)

| Property | Type | Description |
|----------|------|-------------|
| `flightDataPath` | string | Dot-notation path to search for in parsed flight data (e.g. `"coordinates.latitude"`). |

For Next.js sites using React Server Components (RSC) that stream data via `self.__next_f.push([1, "..."])` script tags. The parser extracts all chunks, unescapes them, parses JSON values, resolves `$N` back-references, then searches all parsed objects for the requested path.

### JSON-LD path (`jsonLdPath`)

| Property | Type | Description |
|----------|------|-------------|
| `jsonLdPath` | string | Dot-notation path into a JSON-LD object (e.g. `"offers.price"`). |
| `jsonLdType` | string | Optional `@type` filter (e.g. `"RealEstateListing"`, `"Apartment"`). Only search objects with this type. |

Extracts data from `<script type="application/ld+json">` tags containing Schema.org structured data. Handles both single objects and arrays.

### CSS selector modifiers

| Property | Type | Description |
|----------|------|-------------|
| `cssAttr` | string | Read this attribute instead of text content. E.g. `"content"` for meta tags. |
| `xmlAttr` | string | Same as cssAttr (alias for XML-style attributes like `data-src`) |
| `cssCountId` | string | Pick element at this index (0-based). Without this, Cheerio concatenates ALL matched elements. |

### Post-processing

| Property | Type | Description |
|----------|------|-------------|
| `splitTextCharacter` | string | Split text on this character |
| `splitTextArrayId` | string | After split, pick element at this index (0-based). Default `"0"`. |
| `stripString` | string | Remove first occurrence of this exact substring (runs after split) |

### Type coercion (floatFields only)

| Property | Type | Description |
|----------|------|-------------|
| `stripPunct` | string | If set, remove all `.` and `,` before parseFloat. Used for European prices like `990.000` |
| `stripFirstChar` | string | If set, trim whitespace then remove first character. Used for currency symbols like `$` |

### Boolean evaluation

| Property | Type | Description |
|----------|------|-------------|
| `evaluator` | string | Boolean function name (see below) |
| `evaluatorParam` | string | Parameter passed to the evaluator |
| `caseInsensitive` | boolean | Lowercase both text and param before evaluating |

Available evaluators: `include?`, `start_with?`, `end_with?`, `present?`, `to_i_gt_0`, `==`

### Fallbacks

| Property | Type | Description |
|----------|------|-------------|
| `fallbacks` | FieldMapping[] | Array of alternative field mappings tried in order if the primary strategy returns empty text. Each fallback is a full FieldMapping object. |

### API-based extraction

| Property | Type | Description |
|----------|------|-------------|
| `apiEndpoint` | string | URL of the API endpoint to fetch. `{id}` placeholder is replaced with the property ID. |
| `apiJsonPath` | string | Dot-notation path to navigate the JSON API response. |

### Image-specific

| Property | Type | Description |
|----------|------|-------------|
| `imagePathPrefix` | string | Prepend this to relative image URLs |

### Default values

| Property | Type | Description |
|----------|------|-------------|
| `value` | string | Static value (always a string, even for booleans) |

## Common field names

| Field | Type | Description |
|-------|------|-------------|
| `country` | default/text | Country name |
| `currency` | default/text | Currency code (USD, EUR, GBP, INR) |
| `locale_code` | default | Locale (en, es, de, fr, it) |
| `area_unit` | default | Area unit (sqft, sqm, sqyd) |
| `title` | text | Listing title |
| `description` | text | Listing description |
| `price_string` | text | Price as displayed (e.g. "$144,950") |
| `price_float` | float | Numeric price |
| `count_bedrooms` | int | Number of bedrooms |
| `count_bathrooms` | int | Number of bathrooms |
| `constructed_area` | float/int | Floor area |
| `year_construction` | int | Year built |
| `latitude` | float | Latitude coordinate |
| `longitude` | float | Longitude coordinate |
| `address_string` | text | Full address |
| `street_address` | text | Street address |
| `city` | text | City name |
| `region` | text | State/province/region |
| `postal_code` | text | Postal/zip code |
| `reference` | text | Property/listing ID |
| `property_type` | text | Property type (House, Apartment, etc.) |
| `main_image_url` | text | Primary image URL |
| `image_urls` | images | Array of image URLs |
| `features` | features | Array of feature strings |
| `for_sale` | boolean | Is the property for sale? |
| `for_rent` | boolean | Is the property for rent? |
| `for_rent_long_term` | boolean | Long-term rental? |
| `for_rent_short_term` | default | Short-term rental? (usually default "false") |

## Example: minimal mapping

```json5
[{
  "name": "example_site",
  "defaultValues": {
    "country": { "value": "USA" },
    "currency": { "value": "USD" }
  },
  "floatFields": {
    "price_float": {
      "cssLocator": ".price-value",
      "stripPunct": "true",
      "stripFirstChar": "true"  // removes $ from "$144,950" → "144950"
    },
    "latitude": {
      "cssLocator": "meta[property='place:location:latitude']",
      "cssAttr": "content"
    },
    "longitude": {
      "cssLocator": "meta[property='place:location:longitude']",
      "cssAttr": "content"
    }
  },
  "intFields": {
    "count_bedrooms": {
      "cssLocator": ".bedrooms .count",
      "cssCountId": "0"  // always use if selector might match multiple elements
    }
  },
  "textFields": {
    "title": {
      "cssLocator": "h1.listing-title"
    },
    "price_string": {
      "cssLocator": ".price-value"
    },
    "reference": {
      "cssLocator": "input[name='listing_id']",
      "cssAttr": "value"
    },
    "postal_code": {
      "cssLocator": "meta[property='og:postal-code']",
      "cssAttr": "content"
    }
  },
  "booleanFields": {
    "for_sale": {
      "cssLocator": ".listing-status",
      "evaluator": "include?",
      "evaluatorParam": "sale",
      "caseInsensitive": true
    },
    "for_rent": {
      "cssLocator": ".listing-status",
      "evaluator": "include?",
      "evaluatorParam": "rent",
      "caseInsensitive": true
    }
  },
  "images": [{
    "cssLocator": ".gallery img",
    "cssAttr": "src"
  }]
}]
```

## Choosing the right strategy

| Site pattern | Strategy | Example sites |
|---|---|---|
| Classic server-rendered HTML | `cssLocator` | Older Rightmove, Realtor.com, Pisos.com |
| `window.VAR = {...}` in script | `scriptJsonVar` + `scriptJsonPath` | Rightmove (`PAGE_MODEL`), Idealista (`__INITIAL_STATE__`) |
| Next.js with `<script id="__NEXT_DATA__">` | `scriptJsonVar: "__NEXT_DATA__"` + `scriptJsonPath` | OnTheMarket, Daft.ie |
| Next.js RSC with `self.__next_f.push` | `flightDataPath` | Zoopla (coordinates) |
| Schema.org `<script type="application/ld+json">` | `jsonLdPath` + `jsonLdType` | Zoopla (description), many sites |
| Inline JS variables | `scriptRegEx` | Legacy scrapers |
| Data in URL path | `urlPathPart` | Reference from URL slug |

Multiple strategies can be used in the same mapping for different fields.

## Example: extracting from `window.VAR = {...}`

For sites like Rightmove that embed data in `window.PAGE_MODEL`:

```json5
{
  "count_bedrooms": {
    "scriptJsonVar": "PAGE_MODEL",
    "scriptJsonPath": "propertyData.bedrooms"
  },
  "latitude": {
    "scriptJsonVar": "PAGE_MODEL",
    "scriptJsonPath": "propertyData.location.latitude"
  }
}
```

## Example: extracting from `__NEXT_DATA__`

For Next.js sites like OnTheMarket:

```json5
{
  "count_bedrooms": {
    "scriptJsonVar": "__NEXT_DATA__",
    "scriptJsonPath": "props.pageProps.property.bedrooms"
  }
}
```

## Example: extracting from flight data

For Next.js RSC sites like Zoopla:

```json5
{
  "latitude": {
    "flightDataPath": "coordinates.latitude"
  }
}
```

The parser searches all parsed flight data objects for the first match.

## Example: extracting from JSON-LD

For sites with Schema.org structured data:

```json5
{
  "description": {
    "jsonLdPath": "description",
    "jsonLdType": "RealEstateListing"
  },
  "price_float": {
    "jsonLdPath": "offers.price",
    "jsonLdType": "RealEstateListing"
  }
}
```

## Example: extracting from script tags (regex)

When property data is embedded in JavaScript:

```html
<script>
  var listingData = { propertyId: "12345", lat: 40.7128, lng: -74.0060 };
</script>
```

Use `scriptRegEx`:
```json5
{
  "reference": {
    "scriptRegEx": "propertyId:\\s*[\"'](\\d+)[\"']"
  },
  "latitude": {
    "scriptRegEx": "lat:\\s*([\\d.-]+)"
  }
}
```

Note: the regex runs against ALL `<script>` tags concatenated together. The first
capture group match is returned. Prefer `scriptJsonVar` + `scriptJsonPath` when
the data is a proper JSON object.

## Example: extracting from URL

For a URL like `https://example.com/property/12345/some-slug`:

```json5
{
  "reference": {
    "urlPathPart": "2"  // segments: ["", "property", "12345", "some-slug"]
  }
}
```

## Manifest entry format

After creating the mapping, add an entry to `astro-app/test/fixtures/manifest.ts`:

```typescript
{
  scraper: 'example_site',
  fixture: 'example_site',
  sourceUrl: 'https://www.example.com/listing/12345',
  expected: {
    country: 'USA',
    currency: 'USD',
    title: 'Beautiful 3BR House',
    price_float: 299000,
    count_bedrooms: 3,
    for_sale: true,
    for_rent: false,
  },
},
```

Only include fields that have meaningful non-zero values. The test framework
checks that extracted values match `expected` using deep equality.
