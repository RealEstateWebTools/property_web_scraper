# Export Functionality - Usage Guide

> **Status**: The export service (`export-service.ts`) and endpoints (`/public_api/v1/export`, `/public_api/v1/listings/:id/export`) are implemented. The batch streaming endpoint (`/api/export/batch`) referenced below is planned but not yet available.

This guide shows how to use the PropertyWebScraper export functionality to download listings in multiple formats.

## Available Formats

### Current (Production Ready)

- **JSON** - For API integration and data pipelines
- **CSV** - For spreadsheets and database import
- **GeoJSON** - For mapping applications and GIS tools

### Coming Soon

- **XML/RETS** - For US MLS system integration
- **Schema.org/JSON-LD** - For SEO and semantic web
- **iCalendar** - For availability calendars

---

## API Usage

### 1. Get Available Formats

```bash
curl -X GET "http://localhost:4321/api/export?formats=true"
```

Response:
```json
{
  "formats": [
    {
      "format": "json",
      "label": "JSON",
      "description": "JSON format for API integration and data pipelines",
      "fileExtension": ".json",
      "mimeType": "application/json",
      "isAvailable": true
    },
    {
      "format": "csv",
      "label": "CSV",
      "description": "CSV format for spreadsheets and database import",
      "fileExtension": ".csv",
      "mimeType": "text/csv",
      "isAvailable": true
    },
    {
      "format": "geojson",
      "label": "GeoJSON",
      "description": "GeoJSON format for mapping applications",
      "fileExtension": ".geojson",
      "mimeType": "application/geo+json",
      "isAvailable": true,
      "requiresGeoLocation": true
    }
  ]
}
```

### 2. Export Listings (JSON)

```bash
curl -X POST "http://localhost:4321/api/export" \
  -H "Content-Type: application/json" \
  -d '{
    "format": "json",
    "listings": [
      {
        "reference": "123",
        "title": "Beautiful Property",
        "price_float": 250000,
        "currency": "GBP",
        "count_bedrooms": 3,
        "count_bathrooms": 2,
        "city": "London",
        "country": "UK",
        "latitude": 51.5074,
        "longitude": -0.1278
      }
    ],
    "options": {
      "pretty": true,
      "includeMetadata": true,
      "fieldSelection": "essential"
    }
  }' > properties.json
```

### 3. Export as CSV

```bash
curl -X POST "http://localhost:4321/api/export" \
  -H "Content-Type: application/json" \
  -d '{
    "format": "csv",
    "listings": [...],
    "options": {
      "fieldSelection": ["title", "price_float", "city", "latitude", "longitude"],
      "delimiter": ",",
      "includeHeader": true,
      "encoding": "utf-8-bom"
    }
  }' > properties.csv
```

### 4. Export as GeoJSON (for Mapping)

```bash
curl -X POST "http://localhost:4321/api/export" \
  -H "Content-Type: application/json" \
  -d '{
    "format": "geojson",
    "listings": [...]
  }' > properties.geojson
```

---

## JavaScript/TypeScript Usage

### In Astro Components

```typescript
import { getExportService } from '@lib/services/export-service.js';
import type { Listing } from '@lib/models/listing.js';

export async function exportListings(listings: Listing[], format: 'json' | 'csv' | 'geojson') {
  const service = getExportService();
  
  const result = await service.export({
    format,
    listings,
    options: {
      pretty: true,
      fieldSelection: 'essential'
    }
  });
  
  // Download file
  const blob = new Blob([result.data], { type: result.mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = result.filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

### In Frontend (Astro Islands/React)

```typescript
// components/ExportButton.tsx
export function ExportButton({ listing }) {
  const handleExport = async (format: 'json' | 'csv' | 'geojson') => {
    const response = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        format,
        listings: [listing]
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error('Export failed:', error);
      return;
    }
    
    const filename = response.headers.get('Content-Disposition')
      ?.match(/filename="([^"]+)"/)?.[1] || `export${'.json'}`;
    
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  return (
    <div className="export-buttons">
      <button onClick={() => handleExport('json')}>Export JSON</button>
      <button onClick={() => handleExport('csv')}>Export CSV</button>
      <button onClick={() => handleExport('geojson')}>Export GeoJSON</button>
    </div>
  );
}
```

---

## Format Examples

### JSON Output

```json
{
  "export_version": "1.0",
  "export_date": "2026-02-17T10:30:00Z",
  "source_platform": "PropertyWebScraper",
  "metadata": {
    "total_listings": 1,
    "scraper_version": "5.0.0",
    "duration_ms": 145
  },
  "listings": [
    {
      "reference": "123",
      "title": "Beautiful London Townhouse",
      "price_float": 850000,
      "currency": "GBP",
      "count_bedrooms": 4,
      "count_bathrooms": 3,
      "constructed_area": 250,
      "city": "London",
      "country": "UK",
      "latitude": 51.5074,
      "longitude": -0.1278,
      "main_image_url": "https://...",
      "import_url": "https://www.rightmove.co.uk/properties/123"
    }
  ]
}
```

### CSV Output

```csv
reference,title,price_float,currency,count_bedrooms,count_bathrooms,constructed_area,city,country,latitude,longitude,main_image_url,import_url
123,"Beautiful London Townhouse",850000,GBP,4,3,250,London,UK,51.5074,-0.1278,https://...,https://www.rightmove.co.uk/properties/123
```

### GeoJSON Output

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [-0.1278, 51.5074]
      },
      "properties": {
        "reference": "123",
        "title": "Beautiful London Townhouse",
        "price_float": 850000,
        "currency": "GBP",
        "bedrooms": 4,
        "bathrooms": 3,
        "city": "London",
        "address": "123 Main Street, London, UK",
        "country": "UK",
        "main_image_url": "https://...",
        "source_url": "https://www.rightmove.co.uk/properties/123"
      }
    }
  ]
}
```

---

## Configuration Options

### JSON Export Options

```typescript
interface JSONExportOptions {
  pretty?: boolean;              // Pretty-print JSON (default: true)
  includeMetadata?: boolean;     // Include export metadata (default: true)
  dateFormat?: 'ISO8601' | 'unix' | 'localized';
  fieldSelection?: 'all' | 'essential' | string[];
}
```

### CSV Export Options

```typescript
interface CSVExportOptions {
  fieldSelection?: 'essential' | 'all' | string[];
  delimiter?: ',' | ';' | '\t';  // Default: ','
  includeHeader?: boolean;        // Default: true
  quoteChar?: '"' | "'";          // Default: '"'
  encoding?: 'utf-8' | 'utf-8-bom';
  nestedArrayHandling?: 'json-string' | 'first-item' | 'count';
}
```

### GeoJSON Export Options

```typescript
interface GeoJSONExportOptions {
  includeImages?: boolean;
  maxPropertiesPerFeature?: number;
}
```

---

## Batch Export (Large Datasets)

For exporting many listings, use batch export with streaming:

```bash
curl -X POST "http://localhost:4321/api/export/batch" \
  -H "Content-Type: application/json" \
  -d '{
    "format": "csv",
    "listing_ids": ["id1", "id2", "id3", ...],
    "options": {
      "fieldSelection": ["title", "price_float", "city"],
      "nestedArrayHandling": "json-string"
    }
  }' > large_export.csv
```

---

## Integration Examples

### Google Sheets Import

1. Export to CSV
2. Open Google Sheets
3. File → Import → Upload file
4. Select your CSV export

### Excel Import

1. Export to CSV
2. Open Excel
3. Data → From Text
4. Select your CSV file
5. Follow import wizard

### Map Visualization (Mapbox)

```html
<script>
  // Fetch GeoJSON export
  const response = await fetch('/api/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      format: 'geojson',
      listings: [...]
    })
  });
  
  const data = await response.json();
  
  // Add to Mapbox map
  map.addSource('properties', {
    type: 'geojson',
    data: data
  });
  
  map.addLayer({
    id: 'properties-layer',
    type: 'circle',
    source: 'properties',
    paint: {
      'circle-radius': 6,
      'circle-color': '#B42222'
    }
  });
</script>
```

### PostgreSQL Import

```sql
-- Create temp table from CSV export
CREATE TEMP TABLE import_listings (
  reference TEXT,
  title TEXT,
  price_float NUMERIC,
  currency TEXT,
  count_bedrooms INT,
  count_bathrooms INT,
  city TEXT,
  country TEXT,
  latitude NUMERIC,
  longitude NUMERIC
);

-- Import CSV
\COPY import_listings FROM 'properties.csv' WITH (FORMAT csv, HEADER true);

-- Merge into main table
INSERT INTO listings (reference, title, price, ...)
SELECT reference, title, price_float, ...
FROM import_listings;
```

---

## Performance Tips

1. **fieldSelection** - Limit to essential fields for faster export
2. **Batch Size** - Split large exports into chunks (max 1000 at a time)
3. **Streaming** - For datasets > 10MB, use streaming endpoint
4. **Caching** - Exports are cached for 1 hour
5. **Async** - Use background jobs for batch exports

---

## Troubleshooting

### "Format not available"
- Only JSON, CSV, and GeoJSON are production-ready
- XML/RETS and Schema.org coming soon

### "Listings require geolocation"
- GeoJSON requires valid latitude/longitude
- Ensure listings have coordinates before exporting

### "Too many fields"
- Use `fieldSelection: 'essential'` to reduce output
- Or specify exact fields needed

### "Memory error on large exports"
- Use batch export endpoint with streaming
- Or split into smaller chunks (max 1000 per request)

