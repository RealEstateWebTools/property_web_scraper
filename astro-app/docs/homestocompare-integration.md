# HomesToCompare Integration Guide

## Overview

PropertyWebScraper sends users to HomesToCompare to view side-by-side property comparisons. This document describes the URL format HomesToCompare should accept and the API it should call to retrieve property data.

---

## Incoming URL Format

When a user clicks "Compare on HomesToCompare", they are sent to one of these URLs:

### Case 1 — Haul with exactly 2 properties
```
https://homestocompare.com/compare/{haulId}
```

Example:
```
https://homestocompare.com/compare/sleek-robin-37
```

Go straight to the comparison view with the two properties side by side.

### Case 2 — User selected 2 properties from a larger haul
```
https://homestocompare.com/compare/{haulId}?left={resultId}&right={resultId}
```

Example:
```
https://homestocompare.com/compare/sleek-robin-37?left=abc123&right=def456
```

The `left` and `right` parameters are `resultId` values identifying which two properties to compare.

### Case 3 — Haul with 3+ properties, no pre-selection
```
https://homestocompare.com/compare/{haulId}
```

Same URL as Case 1 but with more than 2 properties in the API response. Show a picker so the user can select two to compare.

---

## Fetching Property Data

Call the PropertyWebScraper API to retrieve all property data for the haul. **No authentication required.**

### Request

```
GET https://property-web-scraper.com/ext/v1/hauls/{haulId}
Accept: application/json
```

### Success Response (200)

```json
{
  "haul_id": "sleek-robin-37",
  "name": "London flats shortlist",
  "scrape_count": 2,
  "scrape_capacity": 20,
  "created_at": "2026-02-25T10:00:00.000Z",
  "expires_at": "2026-03-25T10:00:00.000Z",
  "scrapes": [
    {
      "resultId": "abc123",
      "url": "https://www.rightmove.co.uk/properties/12345",
      "title": "3 bed flat in London SE1",
      "price": "£450,000",
      "price_float": 450000,
      "currency": "GBP",
      "grade": "B",
      "extractionRate": 0.82,
      "main_image_url": "https://media.rightmove.co.uk/...",
      "count_bedrooms": 3,
      "count_bathrooms": 2,
      "constructed_area": 95,
      "area_unit": "sqm",
      "city": "London",
      "address_string": "123 High Street, London SE1",
      "latitude": 51.5074,
      "longitude": -0.1278,
      "description": "A bright, south-facing flat...",
      "for_sale": true,
      "for_rent": false,
      "property_type": "flat",
      "property_subtype": "apartment",
      "tenure": "leasehold",
      "listing_status": "active",
      "agent_name": "Foxtons London Bridge",
      "agent_phone": "020 1234 5678",
      "agent_logo_url": "https://...",
      "price_qualifier": "Offers over",
      "features": ["parking", "garden", "gym", "concierge"],
      "floor_plan_urls": ["https://..."],
      "energy_certificate_grade": "C",
      "locale_code": "en-GB",
      "import_host_slug": "uk_rightmove",
      "createdAt": "2026-02-25T10:00:00.000Z"
    }
  ]
}
```

### Not Found / Expired Response (404)

```json
{
  "error": "Haul not found or expired"
}
```

Hauls expire after approximately 30 days.

---

## Field Reference

All fields except those marked **required** are optional. Check for presence before rendering.

| Field | Type | Required | Description |
|---|---|---|---|
| `resultId` | string | ✅ | Unique ID for this property within the haul |
| `url` | string | ✅ | Original listing URL on the source website |
| `title` | string | ✅ | Property title as extracted |
| `price` | string | ✅ | Formatted price string (e.g. `"£450,000"`) |
| `price_float` | number | | Numeric price for sorting/comparison |
| `currency` | string | | ISO 4217 currency code (e.g. `"GBP"`, `"EUR"`) |
| `grade` | string | ✅ | Extraction quality grade: `A`, `B`, `C`, `D`, `F` |
| `main_image_url` | string | | Primary photo URL |
| `count_bedrooms` | number | | Number of bedrooms |
| `count_bathrooms` | number | | Number of bathrooms |
| `constructed_area` | number | | Floor area (use `area_unit` for unit) |
| `area_unit` | string | | `"sqm"` or `"sqft"` |
| `city` | string | | City name |
| `address_string` | string | | Full address |
| `latitude` | number | | For map display |
| `longitude` | number | | For map display |
| `description` | string | | Plain text description |
| `description_html` | string | | HTML description (sanitise before rendering) |
| `for_sale` | boolean | | True if listed for sale |
| `for_rent` | boolean | | True if listed for rent |
| `property_type` | string | | e.g. `"flat"`, `"house"`, `"land"` |
| `property_subtype` | string | | e.g. `"apartment"`, `"terraced"` |
| `tenure` | string | | e.g. `"freehold"`, `"leasehold"` |
| `listing_status` | string | | e.g. `"active"`, `"sold"`, `"under offer"` |
| `agent_name` | string | | Estate agent name |
| `agent_phone` | string | | Agent phone number |
| `agent_email` | string | | Agent email |
| `agent_logo_url` | string | | Agent logo image |
| `price_qualifier` | string | | e.g. `"Offers over"`, `"Guide price"` |
| `features` | string[] | | List of features/amenities |
| `floor_plan_urls` | string[] | | Floor plan image URLs |
| `energy_certificate_grade` | string | | EPC/energy rating (e.g. `"C"`) |
| `locale_code` | string | | BCP 47 locale (e.g. `"en-GB"`, `"es-ES"`) |
| `import_host_slug` | string | | Source site identifier (e.g. `"uk_rightmove"`, `"es_idealista"`) |
| `createdAt` | string | ✅ | ISO 8601 timestamp when scraped |

---

## Implementation Logic

```typescript
// Pseudocode — adapt to your framework

async function loadComparePage(haulId: string, leftId?: string, rightId?: string) {

  const res = await fetch(`https://property-web-scraper.com/ext/v1/hauls/${haulId}`)

  if (res.status === 404) {
    return showExpiredMessage()
    // "This comparison link has expired.
    //  Ask the sender to share a new one."
  }

  if (!res.ok) {
    return showErrorMessage()
  }

  const data = await res.json()
  const scrapes = data.scrapes  // property data already extracted — no re-scraping needed

  if (leftId && rightId) {
    // Pre-selected pair from URL params
    const left = scrapes.find(s => s.resultId === leftId)
    const right = scrapes.find(s => s.resultId === rightId)

    if (!left || !right) {
      return showErrorMessage('One or both selected properties could not be found.')
    }

    return showComparison(left, right, scrapes)
  }

  if (scrapes.length === 2) {
    // Exactly 2 properties — go straight to comparison
    return showComparison(scrapes[0], scrapes[1], scrapes)
  }

  if (scrapes.length > 2) {
    // Let the user pick 2 to compare
    return showPicker(scrapes)
  }

  // 0 or 1 scrape — edge case
  return showErrorMessage('Not enough properties in this haul to compare.')
}
```

---

## Error Handling

| Scenario | Recommended behaviour |
|---|---|
| 404 from API | Show "link expired" message with link back to PropertyWebScraper |
| `left` / `right` params present but not found in scrapes | Show "properties not found" and fall back to picker |
| Only 1 property in scrapes | Show the single property and explain comparison needs 2 |
| `description_html` rendered | Sanitise HTML before injecting into DOM |
| Missing optional fields | Omit gracefully — do not show empty rows in comparison table |

---

## CORS

The API sets `Access-Control-Allow-Origin: *`, so the fetch can be made from the browser (client-side) or from your server (server-side rendering). Server-side is preferred to avoid a loading flash.

---

## Questions

Contact the PropertyWebScraper team or refer to `DESIGN.md` in the repository for full API documentation.
