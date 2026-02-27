# Supplementary Data Links

This document describes how `supplementary_data_links` are generated for each listing, what fields are available, and how to add or tune link rules.

## Purpose

`SupplementaryDataService` builds a curated list of external context links (risk, schools, energy, demographics, maps, valuation) for each listing and stores them in `listing.supplementary_data_links`.

The configuration source is:

- `astro-app/src/config/supplementary-links.json`

The generator is:

- `astro-app/src/lib/services/supplementary-data-links.ts`

## Config shape

Each country key maps to an array of link definitions. `DEFAULT` applies to all countries.

```json
{
  "DEFAULT": [
    {
      "id": "osm-location",
      "titleTemplate": "OpenStreetMap Location",
      "descriptionTemplate": "Map context for {street_address} {postal_code} {city}",
      "urlTemplate": "https://www.openstreetmap.org/?mlat={latitude}&mlon={longitude}#map=16/{latitude}/{longitude}",
      "requireFields": ["latitude", "longitude"],
      "category": "maps",
      "intent": "location_context",
      "geoLevel": "property",
      "sourceType": "community",
      "access": "free",
      "freshness": "real_time",
      "priority": 10
    }
  ],
  "GB": [
    {
      "id": "uk-flood-risk-gov",
      "titleTemplate": "UK Flood Risk Check",
      "urlTemplate": "https://check-long-term-flood-risk.service.gov.uk/postcode/{postal_code}",
      "requireFields": ["postal_code"],
      "category": "risk",
      "intent": "climate_risk",
      "sourceType": "official",
      "priority": 50
    }
  ]
}
```

## Supported fields

### Templates

- `id` (string, recommended)
- `titleTemplate` (string, required)
- `descriptionTemplate` (string, optional)
- `urlTemplate` (string, required)

Template tokens use listing field names in braces, e.g. `{postal_code}`, `{city}`, `{latitude}`.

### Conditions

- `requireFields` (all listed fields must exist)
- `requireAnyFields` (at least one listed field must exist)
- `excludeIfFields` (hide if any listed field exists)

Condition order is:

1. `requireFields`
2. `requireAnyFields`
3. `excludeIfFields`

### Metadata

- `category`
- `icon`
- `intent`
- `geoLevel`
- `sourceName`
- `sourceType`: `official | commercial | community`
- `access`: `free | freemium | paid | api_key_required`
- `freshness`: `real_time | daily | weekly | monthly | ad_hoc`
- `priority` (lower number = appears earlier)

## Runtime behavior

- The service combines `DEFAULT` + country-specific links.
- Templates are interpolated and URL-encoded.
- Only valid `http/https` URLs are returned.
- Links are de-duplicated by `id` (or URL if no `id`).
- Final list is sorted by `priority` ascending.

## Output shape

Each emitted link may include:

```json
{
  "id": "uk-flood-risk-gov",
  "title": "UK Flood Risk Check",
  "description": "Long-term flood risk at postcode SW1A%202AA",
  "url": "https://check-long-term-flood-risk.service.gov.uk/postcode/SW1A%202AA",
  "category": "risk",
  "intent": "climate_risk",
  "geoLevel": "postcode",
  "sourceName": "GOV.UK",
  "sourceType": "official",
  "access": "free",
  "freshness": "ad_hoc",
  "priority": 50
}
```

## Adding a new link rule

1. Choose the country key (`DEFAULT`, `UK`, `GB`, `ES`, `US`, etc).
2. Add an object with `id`, `titleTemplate`, `urlTemplate`.
3. Add conditions (`requireFields` / `requireAnyFields`) so the link only appears when valid.
4. Add metadata (`intent`, `sourceType`, `access`, `freshness`, `priority`) to make it actionable for clients.
5. Run tests:

```bash
cd astro-app
npx vitest run test/lib/supplementary-data-links.test.ts test/lib/models.test.ts
```

## Testing coverage

Current tests include:

- `test/lib/supplementary-data-links.test.ts` (service behavior)
- `test/lib/models.test.ts` (integration via `Listing.updateFromHash`)
