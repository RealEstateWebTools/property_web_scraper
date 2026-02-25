# Supplementary Data Links

## Overview
The Supplementary Data Links feature automatically enriches extracted property listings with relevant outbound links to external data sources. When a listing is parsed, the backend checks the listing's properties (like `country` and `postal_code`) against a set of predefined conditions to generate URLs for third-party tools, area guides, and demographic data.

These dynamically generated links are attached to the `supplementary_data_links` field in the payload of both the internal Property Web Scraper (`PWB`) response and the public-facing `ext/v1/listings` API.

## Current Implementation

### Data Structures
The core logic resides in `src/lib/services/supplementary-data-links.ts`, which exports a singleton `supplementaryDataService`.

- **`SupplementaryLinkConfig`**: Represents a single rule for link generation.
  - `titleTemplate`: The human-readable name of the link (e.g., `"Doogal Postcode Data"`).
  - `urlTemplate`: The template string for the outbound URL, allowing substitution of listing fields (e.g., `"https://www.doogal.co.uk/UKPostcodes.php?Search={postal_code}"`).
  - `condition`: A boolean callback function evaluated against a listing to decide whether this link should be generated (e.g., `(listing) => !!listing.postal_code`).

- **`CountryLinkConfig`**: A record that maps a 2-letter country code (e.g., `UK`, `US`, `ES`) to an array of `SupplementaryLinkConfig`s. 

### Processing Example
If a processed property has a `country` set to `"UK"` and a `postal_code` of `"E1 4UZ"`, the service will evaluate the `UK` rules. It checks the condition (the postal code exists), heavily URL-encodes the placeholder variable, and produces the payload:

```json
"supplementary_data_links": [
  {
    "title": "Doogal Postcode Data",
    "url": "https://www.doogal.co.uk/UKPostcodes.php?Search=E1%204UZ"
  },
  {
    "title": "Mouseprice Property Data",
    "url": "https://www.mouseprice.com/property-for-sale/refine?search=E1%204UZ"
  }
]
```

### Integration Points
- **Listing Model** (`src/lib/models/listing.ts`): Hooked into the overridden `asJson()` method so the links are generated just-in-time when the serialized object is compiled.
- **Data Extractor APIs** (`src/pages/public_api/v1/listings.ts`): Attached dynamically to the active payload mappings.
- **Search Extension API** (`src/pages/ext/v1/listings.ts`): Exported as part of the `items` payload for front-end rendering engines.

---

## Areas for Improvement

While the current system covers the basic use cases, here are several suggestions to enhance scalability and robustness:

### 1. Externalize the Configuration
Currently, `DEFAULT_LINK_CONFIGS` is hardcoded in the `supplementary-data-links.ts` file. 
- **Database/Firestore Config**: Move the configuration map to a Firestore collection (e.g., `system_configs/supplementary_links`). This would allow administrators to add or tweak templates on the fly without needing to redeploy the codebase.
- **JSON Manifests**: Alternatively, store them in a static JSON/YAML file that gets hot-loaded, moving it out of executable logic completely.

### 2. Complex Interpolation and Sanitization
- **Fallback Keys**: Allow template expressions with defaults, like `{postal_code|city}` where if `postal_code` is missing, it falls back to parsing the `city`.
- **Custom Formatting**: Instead of straightforward `encodeURIComponent`, certain third-party systems might require specific slugging (e.g., converting spaces to hyphens rather than `%20`). We could enhance the interpolator to support modifiers (e.g., `{city:slug}` or `{postal_code:spaceless}`).

### 3. Localization and i18n
- Right now, the `titleTemplate` is hardcoded in English. If the API is served in multiple locales, we should allow dictionary keys for titles (e.g., `titleTemplate: 'external_links.idealista_guide'`), which the front end resolves based on the user's active language.

### 4. Geo-Coordinates Fallbacks
- Many properties lack structured postal codes but provide parsed `latitude` and `longitude`. We should add default templates that rely on coordinates. For example, pointing to Google Maps or local transit guides using the raw coordinate strings.

### 5. UI Rendering System
- Add explicit React/Astro UI components to seamlessly handle these links. 
- It might be beneficial to extend the `SupplementaryLinkConfig` with an `icon` or `category` field (e.g., `category: "transport" | "price_history" | "neighborhood"`). This would allow the UI to group the supplementary links into distinct visual sections rather than a flat string array.

### 6. Caching
- Since listing properties typically won't change between loads, repeatedly instantiating `.generateLinks()` during `asJson()` can have a small performance penalty if looping over thousands of records. Memoization or pre-compiling the results into a discrete database field for the property during the extraction/save step could speed up read-heavy paths.
