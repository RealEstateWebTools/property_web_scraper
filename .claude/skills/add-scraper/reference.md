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
| `scriptRegEx` | string | Regex pattern run against concatenated `<script>` tag text |
| `urlPathPart` | string | Extract URL path segment by index (1-based). `"3"` extracts 3rd segment. |

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

## Example: extracting from script tags

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
capture group match is returned.

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
