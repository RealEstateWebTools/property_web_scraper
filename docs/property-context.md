# property-context — Developer Guide

A standalone enrichment service that accepts a property listing URL or haul URL
from the `property_web_scraper` project, fetches the scraped data, enriches each
property with location and market intelligence from external APIs, and stores
everything in its own independent database.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Prerequisites](#3-prerequisites)
4. [Project Setup](#4-project-setup)
5. [Environment Variables](#5-environment-variables)
6. [Database Setup](#6-database-setup)
7. [Project Structure](#7-project-structure)
8. [Implementation — Database Client](#8-implementation--database-client)
9. [Implementation — Fetchers](#9-implementation--fetchers)
10. [Implementation — Enrichers](#10-implementation--enrichers)
11. [Implementation — Queue & Worker](#11-implementation--queue--worker)
12. [Implementation — Routes](#12-implementation--routes)
13. [Implementation — App Entry Point](#13-implementation--app-entry-point)
14. [Running Locally](#14-running-locally)
15. [Deployment](#15-deployment)
16. [Enricher API Reference](#16-enricher-api-reference)
17. [Adding a New Enricher](#17-adding-a-new-enricher)

---

## 1. Overview

`property-context` augments raw property listing data with information that no
portal publishes — walkability, nearby amenities, flood risk, energy certificates,
historical sold prices, and more.

The only coupling to `property_web_scraper` is a single HTTP fetch at import time:

```
You → POST /imports { source_url }
   → property-context fetches from scraper API
   → stores property snapshot
   → enqueues enrichment jobs (background)
   → returns immediately with { import_id, property_ids }
```

Everything else — database, enrichers, API — is fully independent.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        property-context                         │
│                                                                 │
│  POST /imports                                                  │
│       │                                                         │
│       ▼                                                         │
│  ┌──────────┐    HTTP GET    ┌─────────────────────────────┐   │
│  │ Fetcher  │ ─────────────► │  property_web_scraper API   │   │
│  │          │ ◄───────────── │  /ext/v1/hauls/:id          │   │
│  └──────────┘   JSON         │  /public_api/v1/listings/:id│   │
│       │                      └─────────────────────────────┘   │
│       ▼                                                         │
│  ┌──────────────────────┐                                       │
│  │  Supabase (Postgres) │                                       │
│  │  ├── imports         │                                       │
│  │  ├── properties      │                                       │
│  │  └── enrichments     │                                       │
│  └──────────────────────┘                                       │
│       │                                                         │
│       ▼                                                         │
│  ┌──────────┐  pgboss jobs   ┌────────────────────────────┐    │
│  │  Queue   │ ─────────────► │  Worker process            │    │
│  │ (pgboss) │                │  ├── overpass.ts           │    │
│  └──────────┘                │  ├── walkscore.ts          │    │
│                              │  ├── epc-uk.ts             │    │
│                              │  ├── flood-uk.ts           │    │
│                              │  └── land-registry-uk.ts   │    │
│                              └────────────────────────────┘    │
│                                        │                        │
│                                        ▼                        │
│                              ┌──────────────────────┐          │
│                              │  Supabase (Postgres) │          │
│                              │  enrichments table   │          │
│                              └──────────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

**Processing model:** import is synchronous (fetch + insert properties immediately),
enrichment is asynchronous (pgboss jobs run in the background). Callers poll
`GET /imports/:id` for status or `GET /properties/:id` for results.

---

## 3. Prerequisites

- Node.js ≥ 20
- npm ≥ 10
- A [Supabase](https://supabase.com) account (free tier is sufficient)
- A [Walk Score API key](https://www.walkscore.com/professional/api.php) (free, 5 000 calls/day)
- For UK enrichers: an [EPC Register API key](https://epc.opendatacommunities.org/) (free)
- A running instance of `property_web_scraper` (the source project) with its base URL

---

## 4. Project Setup

### 4.1 Initialise the repository

```bash
mkdir property-context && cd property-context
git init
npm init -y
```

### 4.2 Install dependencies

```bash
# Runtime
npm install hono @hono/node-server
npm install @supabase/supabase-js
npm install pg-boss
npm install dotenv

# Dev
npm install -D typescript tsx @types/node vitest
```

### 4.3 `package.json`

Replace the generated `package.json` with:

```json
{
  "name": "property-context",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "worker": "tsx watch src/queue/worker.ts",
    "start": "node dist/index.js",
    "build": "tsc",
    "test": "vitest run"
  },
  "dependencies": {
    "@hono/node-server": "^1.12.0",
    "@supabase/supabase-js": "^2.45.0",
    "dotenv": "^16.4.0",
    "hono": "^4.5.0",
    "pg-boss": "^10.1.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.5.0",
    "vitest": "^2.1.0"
  }
}
```

### 4.4 `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "paths": {
      "@lib/*": ["src/lib/*"]
    }
  },
  "include": ["src"]
}
```

---

## 5. Environment Variables

Create `.env` (and `.env.example` for the repo):

```bash
# ── Supabase ──────────────────────────────────────────────────────
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...   # service role key (not anon key)

# ── Source project (property_web_scraper) ─────────────────────────
SCRAPER_BASE_URL=https://your-scraper-deployment.com
SCRAPER_API_KEY=pws_live_...            # optional; required only for /public_api routes

# ── Enricher API keys ─────────────────────────────────────────────
WALKSCORE_API_KEY=your_walkscore_key
EPC_API_EMAIL=you@example.com           # UK EPC Register credentials
EPC_API_KEY=your_epc_api_key            # UK EPC Register API key

# ── Server ────────────────────────────────────────────────────────
PORT=3000
```

> **Security:** Never commit `.env`. Add it to `.gitignore`.

---

## 6. Database Setup

### 6.1 Create a Supabase project

1. Go to [app.supabase.com](https://app.supabase.com) → **New project**
2. Choose a region close to your users
3. Note your **Project URL** and **service role key** (Settings → API)

### 6.2 Enable the PostGIS extension

In the Supabase dashboard → **SQL Editor**, run:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

### 6.3 Run the schema

Paste and run the following in the SQL editor:

```sql
-- ─── Imports ──────────────────────────────────────────────────────
-- Tracks each submitted scraper URL (haul or single listing)

CREATE TABLE imports (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url    TEXT        NOT NULL,
  source_type   TEXT        NOT NULL CHECK (source_type IN ('haul', 'listing')),
  source_id     TEXT        NOT NULL,     -- haul_id or listing_id from scraper
  status        TEXT        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','processing','complete','failed')),
  listing_count INT,
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ
);

-- ─── Properties ───────────────────────────────────────────────────
-- One row per property. Stores a snapshot of the scraped fields plus
-- denormalized enrichment summary columns for efficient filtering.

CREATE TABLE properties (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id             UUID        REFERENCES imports(id) ON DELETE CASCADE,
  source_listing_id     TEXT        NOT NULL,   -- listing id in scraper project
  source_url            TEXT        NOT NULL,   -- original listing URL
  portal                TEXT,                   -- e.g. 'uk_rightmove'
  country               TEXT,

  -- Scraped snapshot
  title                 TEXT,
  price_float           FLOAT,
  price_currency        TEXT,
  price_string          TEXT,
  latitude              FLOAT,
  longitude             FLOAT,
  location              GEOGRAPHY(POINT, 4326),
  address_string        TEXT,
  city                  TEXT,
  region                TEXT,
  postal_code           TEXT,
  count_bedrooms        INT,
  count_bathrooms       FLOAT,
  constructed_area      FLOAT,
  plot_area             FLOAT,
  area_unit             TEXT,
  year_construction     INT,
  property_type         TEXT,
  property_subtype      TEXT,
  tenure                TEXT,
  for_sale              BOOLEAN,
  for_rent              BOOLEAN,
  for_rent_long_term    BOOLEAN,
  for_rent_short_term   BOOLEAN,
  sold                  BOOLEAN,
  features              TEXT[],
  main_image_url        TEXT,
  description           TEXT,
  agent_name            TEXT,

  -- Enrichment summary (denormalized for fast queries)
  walkability_score     INT,
  transit_score         INT,
  bike_score            INT,
  flood_risk            TEXT,         -- 'low' | 'medium' | 'high' | 'very_high'
  epc_grade             TEXT,         -- 'A'..'G'
  nearby_schools        INT,
  nearby_transit_stops  INT,
  nearby_supermarkets   INT,

  -- Timestamps
  scraped_at            TIMESTAMPTZ,  -- last_retrieved_at from scraper
  imported_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  enriched_at           TIMESTAMPTZ,
  enrichment_status     TEXT         NOT NULL DEFAULT 'pending'
                                     CHECK (enrichment_status IN
                                       ('pending','partial','complete','failed'))
);

-- Spatial index for nearby queries
CREATE INDEX properties_location_idx  ON properties USING GIST(location);
CREATE INDEX properties_country_idx   ON properties(country);
CREATE INDEX properties_import_id_idx ON properties(import_id);

-- ─── Enrichments ──────────────────────────────────────────────────
-- One row per enricher per property.

CREATE TABLE enrichments (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id  UUID        NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  enricher     TEXT        NOT NULL,  -- 'overpass' | 'walkscore' | 'epc_uk' | ...
  status       TEXT        NOT NULL DEFAULT 'pending'
                           CHECK (status IN
                             ('pending','running','complete','failed','skipped')),
  data         JSONB,                 -- raw enricher output
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,          -- when to re-enrich
  UNIQUE (property_id, enricher)
);

CREATE INDEX enrichments_property_id_idx ON enrichments(property_id);
CREATE INDEX enrichments_status_idx      ON enrichments(status);
```

---

## 7. Project Structure

```
property-context/
├── src/
│   ├── index.ts                 # Hono app + server bootstrap
│   ├── db/
│   │   └── client.ts            # Supabase client singleton
│   ├── fetchers/
│   │   ├── index.ts             # dispatch: detect haul vs listing URL
│   │   ├── haul.ts              # fetch + normalise haul response
│   │   └── listing.ts          # fetch + normalise single listing
│   ├── enrichers/
│   │   ├── registry.ts          # maps country → applicable enrichers + TTLs
│   │   ├── types.ts             # shared Enricher interface
│   │   ├── overpass.ts          # OpenStreetMap nearby POIs (global, free)
│   │   ├── nominatim.ts         # reverse geocoding (global, free)
│   │   ├── walkscore.ts         # walk/transit/bike scores
│   │   ├── epc-uk.ts            # UK energy performance certificates
│   │   ├── flood-uk.ts          # UK Environment Agency flood risk
│   │   └── land-registry-uk.ts  # UK HM Land Registry sold prices
│   ├── queue/
│   │   ├── boss.ts              # pgboss singleton
│   │   ├── scheduler.ts         # enqueue jobs after import
│   │   └── worker.ts            # worker process entry point
│   └── routes/
│       ├── imports.ts
│       └── properties.ts
├── .env
├── .env.example
├── .gitignore
├── package.json
└── tsconfig.json
```

---

## 8. Implementation — Database Client

**`src/db/client.ts`**

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

export function getDb(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}
```

---

## 9. Implementation — Fetchers

### 9.1 Types

**`src/fetchers/types.ts`**

```typescript
// Normalised property shape that both haul and listing fetchers produce.
// Fields mirror the scraper project's Listing model.
export interface ScrapedProperty {
  source_listing_id: string;
  source_url:        string;
  portal:            string | null;
  country:           string | null;
  title:             string | null;
  price_float:       number | null;
  price_currency:    string | null;
  price_string:      string | null;
  latitude:          number | null;
  longitude:         number | null;
  address_string:    string | null;
  city:              string | null;
  region:            string | null;
  postal_code:       string | null;
  count_bedrooms:    number | null;
  count_bathrooms:   number | null;
  constructed_area:  number | null;
  plot_area:         number | null;
  area_unit:         string | null;
  year_construction: number | null;
  property_type:     string | null;
  property_subtype:  string | null;
  tenure:            string | null;
  for_sale:          boolean | null;
  for_rent:          boolean | null;
  for_rent_long_term:  boolean | null;
  for_rent_short_term: boolean | null;
  sold:              boolean | null;
  features:          string[];
  main_image_url:    string | null;
  description:       string | null;
  agent_name:        string | null;
  scraped_at:        string | null;
}
```

### 9.2 Haul fetcher

**`src/fetchers/haul.ts`**

Calls `GET /ext/v1/hauls/:id` on the scraper project. No authentication required.

```typescript
import type { ScrapedProperty } from './types.js';

const BASE_URL = process.env.SCRAPER_BASE_URL!;

export async function fetchHaul(haulId: string): Promise<ScrapedProperty[]> {
  const url = `${BASE_URL}/ext/v1/hauls/${haulId}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Haul fetch failed: ${res.status} ${await res.text()}`);
  }

  const body = await res.json() as {
    success: boolean;
    scrapes?: HaulScrape[];
  };

  if (!body.success || !Array.isArray(body.scrapes)) {
    throw new Error('Unexpected haul response shape');
  }

  return body.scrapes.map(normaliseHaulScrape);
}

interface HaulScrape {
  resultId:        string;
  url:             string;
  title?:          string;
  price_float?:    number;
  currency?:       string;
  price?:          string;
  latitude?:       number;
  longitude?:      number;
  city?:           string;
  country?:        string;
  count_bedrooms?: number;
  count_bathrooms?: number;
  constructed_area?: number;
  plot_area?:      number;
  main_image_url?: string;
  features?:       string[];
  createdAt?:      string;
  [key: string]:   unknown;
}

function normaliseHaulScrape(s: HaulScrape): ScrapedProperty {
  return {
    source_listing_id: s.resultId,
    source_url:        s.url,
    portal:            null,               // not exposed in haul summary
    country:           s.country ?? null,
    title:             s.title ?? null,
    price_float:       s.price_float ?? null,
    price_currency:    s.currency ?? null,
    price_string:      s.price ?? null,
    latitude:          s.latitude ?? null,
    longitude:         s.longitude ?? null,
    address_string:    null,
    city:              s.city ?? null,
    region:            null,
    postal_code:       null,
    count_bedrooms:    s.count_bedrooms ?? null,
    count_bathrooms:   s.count_bathrooms ?? null,
    constructed_area:  s.constructed_area ?? null,
    plot_area:         s.plot_area ?? null,
    area_unit:         null,
    year_construction: null,
    property_type:     null,
    property_subtype:  null,
    tenure:            null,
    for_sale:          null,
    for_rent:          null,
    for_rent_long_term:  null,
    for_rent_short_term: null,
    sold:              null,
    features:          s.features ?? [],
    main_image_url:    s.main_image_url ?? null,
    description:       null,
    agent_name:        null,
    scraped_at:        s.createdAt ?? null,
  };
}
```

### 9.3 Listing fetcher

**`src/fetchers/listing.ts`**

Calls `GET /public_api/v1/listings/:id`. Requires an API key.

```typescript
import type { ScrapedProperty } from './types.js';

const BASE_URL  = process.env.SCRAPER_BASE_URL!;
const API_KEY   = process.env.SCRAPER_API_KEY ?? '';

export async function fetchListing(listingId: string): Promise<ScrapedProperty> {
  const url = `${BASE_URL}/public_api/v1/listings/${listingId}`;
  const res = await fetch(url, {
    headers: { 'X-Api-Key': API_KEY },
  });

  if (!res.ok) {
    throw new Error(`Listing fetch failed: ${res.status} ${await res.text()}`);
  }

  const body = await res.json() as { success: boolean; listing?: Record<string, unknown> };
  if (!body.success || !body.listing) {
    throw new Error('Unexpected listing response shape');
  }

  return normaliseListing(body.listing);
}

function normaliseListing(l: Record<string, unknown>): ScrapedProperty {
  const str  = (k: string) => (typeof l[k] === 'string'  ? l[k] as string  : null);
  const num  = (k: string) => (typeof l[k] === 'number'  ? l[k] as number  : null);
  const bool = (k: string) => (typeof l[k] === 'boolean' ? l[k] as boolean : null);

  return {
    source_listing_id: str('id') ?? String(l['id']),
    source_url:        str('import_url') ?? '',
    portal:            str('import_host_slug'),
    country:           str('country'),
    title:             str('title'),
    price_float:       num('price_float'),
    price_currency:    str('price_currency'),
    price_string:      str('price_string'),
    latitude:          num('latitude'),
    longitude:         num('longitude'),
    address_string:    str('address_string'),
    city:              str('city'),
    region:            str('region'),
    postal_code:       str('postal_code'),
    count_bedrooms:    num('count_bedrooms'),
    count_bathrooms:   num('count_bathrooms'),
    constructed_area:  num('constructed_area'),
    plot_area:         num('plot_area'),
    area_unit:         str('area_unit'),
    year_construction: num('year_construction'),
    property_type:     str('property_type'),
    property_subtype:  str('property_subtype'),
    tenure:            str('tenure'),
    for_sale:          bool('for_sale'),
    for_rent:          bool('for_rent'),
    for_rent_long_term:  bool('for_rent_long_term'),
    for_rent_short_term: bool('for_rent_short_term'),
    sold:              bool('sold'),
    features:          Array.isArray(l['features']) ? l['features'] as string[] : [],
    main_image_url:    str('main_image_url'),
    description:       str('description'),
    agent_name:        str('agent_name'),
    scraped_at:        str('last_retrieved_at'),
  };
}
```

### 9.4 Dispatcher

**`src/fetchers/index.ts`**

Detects whether the submitted URL points to a haul or a single listing.

```typescript
import { fetchHaul }    from './haul.js';
import { fetchListing } from './listing.js';
import type { ScrapedProperty } from './types.js';

export type SourceType = 'haul' | 'listing';

export interface FetchResult {
  sourceType: SourceType;
  sourceId:   string;
  properties: ScrapedProperty[];
}

export async function fetchFromScraper(sourceUrl: string): Promise<FetchResult> {
  const url = new URL(sourceUrl);
  const path = url.pathname;

  // /ext/v1/hauls/:id
  const haulMatch = path.match(/\/ext\/v1\/hauls\/([^/]+)/);
  if (haulMatch) {
    const haulId = haulMatch[1];
    const properties = await fetchHaul(haulId);
    return { sourceType: 'haul', sourceId: haulId, properties };
  }

  // /public_api/v1/listings/:id
  const listingMatch = path.match(/\/public_api\/v1\/listings\/([^/]+)/);
  if (listingMatch) {
    const listingId = listingMatch[1];
    const property = await fetchListing(listingId);
    return { sourceType: 'listing', sourceId: listingId, properties: [property] };
  }

  throw new Error(`Unrecognised scraper URL pattern: ${path}`);
}
```

---

## 10. Implementation — Enrichers

### 10.1 Shared interface

**`src/enrichers/types.ts`**

```typescript
export interface EnricherInput {
  property_id:  string;
  latitude:     number;
  longitude:    number;
  country:      string | null;
  postal_code:  string | null;
  city:         string | null;
  address_string: string | null;
}

// What an enricher writes to the `enrichments` table.
// The `data` field is free-form JSONB; `summary` fields are
// written back to the `properties` table.
export interface EnricherResult {
  data:    Record<string, unknown>;
  summary: Partial<{
    walkability_score:    number;
    transit_score:        number;
    bike_score:           number;
    flood_risk:           string;
    epc_grade:            string;
    nearby_schools:       number;
    nearby_transit_stops: number;
    nearby_supermarkets:  number;
  }>;
  // ISO 8601 — when this enrichment becomes stale and should be re-run
  expiresAt: string;
}

export interface Enricher {
  name:   string;
  run:    (input: EnricherInput) => Promise<EnricherResult>;
}
```

### 10.2 Enricher registry

**`src/enrichers/registry.ts`**

Maps countries to which enrichers should run. Add entries here as you add enrichers.

```typescript
import { overpassEnricher }       from './overpass.js';
import { walkscoreEnricher }      from './walkscore.js';
import { epcUkEnricher }          from './epc-uk.js';
import { floodUkEnricher }        from './flood-uk.js';
import { landRegistryUkEnricher } from './land-registry-uk.js';
import type { Enricher } from './types.js';

// Enrichers that apply regardless of country
const GLOBAL_ENRICHERS: Enricher[] = [
  overpassEnricher,
  walkscoreEnricher,
];

// Enrichers keyed by ISO 3166-1 alpha-2 country code or common name
const COUNTRY_ENRICHERS: Record<string, Enricher[]> = {
  'GB':             [epcUkEnricher, floodUkEnricher, landRegistryUkEnricher],
  'UK':             [epcUkEnricher, floodUkEnricher, landRegistryUkEnricher],
  'United Kingdom': [epcUkEnricher, floodUkEnricher, landRegistryUkEnricher],
  'England':        [epcUkEnricher, floodUkEnricher, landRegistryUkEnricher],
  // Add: 'US', 'ES', 'DE', etc.
};

export function getEnrichersForCountry(country: string | null): Enricher[] {
  const countryEnrichers = country ? (COUNTRY_ENRICHERS[country] ?? []) : [];
  return [...GLOBAL_ENRICHERS, ...countryEnrichers];
}
```

### 10.3 Overpass enricher (OpenStreetMap nearby POIs)

**`src/enrichers/overpass.ts`**

Queries OpenStreetMap for nearby points of interest using the Overpass API.
Free, no API key, global coverage. Rate limit: avoid more than 1 req/s.

```typescript
import type { Enricher, EnricherInput, EnricherResult } from './types.js';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

interface OsmElement {
  type: string;
  id:   number;
  lat?: number;
  lon?: number;
  tags: Record<string, string>;
}

interface OverpassResponse {
  elements: OsmElement[];
}

interface PoiGroup {
  count:    number;
  nearest?: { name: string; distance_m: number };
  items:    Array<{ name: string; lat: number; lon: number }>;
}

function haversineMetres(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

async function queryOverpass(lat: number, lon: number, radiusM: number): Promise<OverpassResponse> {
  // Single consolidated query — one request for all POI types
  const query = `
    [out:json][timeout:25];
    (
      node["amenity"="school"](around:${radiusM},${lat},${lon});
      node["amenity"="college"](around:${radiusM},${lat},${lon});
      node["amenity"="university"](around:${radiusM},${lat},${lon});
      node["public_transport"="stop_position"](around:500,${lat},${lon});
      node["highway"="bus_stop"](around:500,${lat},${lon});
      node["railway"="station"](around:1000,${lat},${lon});
      node["railway"="subway_entrance"](around:1000,${lat},${lon});
      node["shop"="supermarket"](around:${radiusM},${lat},${lon});
      node["shop"="convenience"](around:500,${lat},${lon});
      node["leisure"="park"](around:${radiusM},${lat},${lon});
      node["amenity"="hospital"](around:${radiusM},${lat},${lon});
      node["amenity"="pharmacy"](around:${radiusM},${lat},${lon});
    );
    out body;
  `;

  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!res.ok) throw new Error(`Overpass error ${res.status}`);
  return res.json() as Promise<OverpassResponse>;
}

function groupElements(
  elements: OsmElement[],
  lat: number,
  lon: number,
): Record<string, PoiGroup> {
  const groups: Record<string, PoiGroup> = {
    schools:      { count: 0, items: [] },
    transit:      { count: 0, items: [] },
    supermarkets: { count: 0, items: [] },
    parks:        { count: 0, items: [] },
    hospitals:    { count: 0, items: [] },
    pharmacies:   { count: 0, items: [] },
  };

  for (const el of elements) {
    if (!el.lat || !el.lon) continue;
    const name = el.tags.name ?? el.tags.operator ?? 'Unknown';
    const dist = Math.round(haversineMetres(lat, lon, el.lat, el.lon));
    const item = { name, lat: el.lat, lon: el.lon };

    let key: keyof typeof groups | null = null;

    if (['school', 'college', 'university'].includes(el.tags.amenity)) {
      key = 'schools';
    } else if (
      el.tags.public_transport === 'stop_position' ||
      el.tags.highway === 'bus_stop' ||
      el.tags.railway === 'station' ||
      el.tags.railway === 'subway_entrance'
    ) {
      key = 'transit';
    } else if (['supermarket', 'convenience'].includes(el.tags.shop)) {
      key = 'supermarkets';
    } else if (el.tags.leisure === 'park') {
      key = 'parks';
    } else if (el.tags.amenity === 'hospital') {
      key = 'hospitals';
    } else if (el.tags.amenity === 'pharmacy') {
      key = 'pharmacies';
    }

    if (!key) continue;

    groups[key].count++;
    groups[key].items.push(item);
    if (!groups[key].nearest || dist < (groups[key].nearest?.distance_m ?? Infinity)) {
      groups[key].nearest = { name, distance_m: dist };
    }
  }

  return groups;
}

export const overpassEnricher: Enricher = {
  name: 'overpass',

  async run(input: EnricherInput): Promise<EnricherResult> {
    const { latitude: lat, longitude: lon } = input;

    const radius = 1000; // metres
    const response = await queryOverpass(lat, lon, radius);
    const groups   = groupElements(response.elements, lat, lon);

    // 90-day TTL — OSM data changes slowly
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

    return {
      data: {
        query_radius_m: radius,
        element_count:  response.elements.length,
        ...groups,
      },
      summary: {
        nearby_schools:       groups.schools.count,
        nearby_transit_stops: groups.transit.count,
        nearby_supermarkets:  groups.supermarkets.count,
      },
      expiresAt,
    };
  },
};
```

### 10.4 Walk Score enricher

**`src/enrichers/walkscore.ts`**

Returns walkability, transit, and bike scores (0–100) for a location.
Requires a free API key from [walkscore.com/professional/api.php](https://www.walkscore.com/professional/api.php).

```typescript
import type { Enricher, EnricherInput, EnricherResult } from './types.js';

const API_KEY = process.env.WALKSCORE_API_KEY ?? '';

interface WalkScoreResponse {
  status:            number;  // 1 = success
  walkscore:         number;
  description:       string;
  updated:           string;
  transit?: {
    score:       number;
    description: string;
    summary:     string;
  };
  bike?: {
    score:       number;
    description: string;
  };
}

export const walkscoreEnricher: Enricher = {
  name: 'walkscore',

  async run(input: EnricherInput): Promise<EnricherResult> {
    if (!API_KEY) throw new Error('WALKSCORE_API_KEY not set');

    const { latitude: lat, longitude: lon, address_string } = input;
    const address = encodeURIComponent(address_string ?? `${lat},${lon}`);

    const url = [
      `https://api.walkscore.com/score`,
      `?format=json`,
      `&address=${address}`,
      `&lat=${lat}`,
      `&lon=${lon}`,
      `&transit=1`,
      `&bike=1`,
      `&wsapikey=${API_KEY}`,
    ].join('');

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Walk Score error ${res.status}`);

    const body = await res.json() as WalkScoreResponse;
    if (body.status !== 1) throw new Error(`Walk Score status ${body.status}`);

    // 30-day TTL
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    return {
      data: {
        walkscore:            body.walkscore,
        walk_description:     body.description,
        transit_score:        body.transit?.score ?? null,
        transit_description:  body.transit?.description ?? null,
        transit_summary:      body.transit?.summary ?? null,
        bike_score:           body.bike?.score ?? null,
        bike_description:     body.bike?.description ?? null,
      },
      summary: {
        walkability_score: body.walkscore,
        transit_score:     body.transit?.score,
        bike_score:        body.bike?.score,
      },
      expiresAt,
    };
  },
};
```

### 10.5 UK EPC enricher

**`src/enrichers/epc-uk.ts`**

Looks up the Energy Performance Certificate for a UK property by postcode.
Register for a free API key at [epc.opendatacommunities.org](https://epc.opendatacommunities.org/).

```typescript
import type { Enricher, EnricherInput, EnricherResult } from './types.js';

const EPC_EMAIL = process.env.EPC_API_EMAIL ?? '';
const EPC_KEY   = process.env.EPC_API_KEY   ?? '';

interface EpcRow {
  'current-energy-rating':         string;
  'potential-energy-rating':        string;
  'current-energy-efficiency':      string;
  'potential-energy-efficiency':    string;
  'environment-impact-current':     string;
  'environment-impact-potential':   string;
  'co2-emissions-current':          string;
  'property-type':                  string;
  'built-form':                     string;
  'inspection-date':                string;
  'lodgement-date':                 string;
  address1?:                        string;
  address2?:                        string;
  posttown?:                        string;
}

interface EpcResponse {
  rows: EpcRow[];
}

export const epcUkEnricher: Enricher = {
  name: 'epc_uk',

  async run(input: EnricherInput): Promise<EnricherResult> {
    if (!EPC_EMAIL || !EPC_KEY) throw new Error('EPC_API_EMAIL / EPC_API_KEY not set');
    if (!input.postal_code) throw new Error('No postal_code — skipping EPC lookup');

    const postcode = input.postal_code.replace(/\s+/g, '+');
    const url = `https://epc.opendatacommunities.org/api/v1/domestic/search?postcode=${postcode}&size=1`;
    const auth = Buffer.from(`${EPC_EMAIL}:${EPC_KEY}`).toString('base64');

    const res = await fetch(url, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) throw new Error(`EPC API error ${res.status}`);

    const body = await res.json() as EpcResponse;
    const row  = body.rows[0];
    if (!row) throw new Error('No EPC certificate found for postcode');

    // 1-year TTL — EPC data is stable
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    return {
      data: {
        current_energy_rating:       row['current-energy-rating'],
        potential_energy_rating:     row['potential-energy-rating'],
        current_energy_efficiency:   Number(row['current-energy-efficiency']),
        potential_energy_efficiency: Number(row['potential-energy-efficiency']),
        co2_emissions_current:       Number(row['co2-emissions-current']),
        property_type:               row['property-type'],
        built_form:                  row['built-form'],
        inspection_date:             row['inspection-date'],
        lodgement_date:              row['lodgement-date'],
      },
      summary: {
        epc_grade: row['current-energy-rating'] ?? undefined,
      },
      expiresAt,
    };
  },
};
```

### 10.6 UK flood risk enricher

**`src/enrichers/flood-uk.ts`**

Queries the Environment Agency's ArcGIS services to determine which flood zone
a property falls in (Zone 1 = low risk, Zone 2 = medium, Zone 3 = high).

```typescript
import type { Enricher, EnricherInput, EnricherResult } from './types.js';

// Environment Agency Flood Map for Planning — flood zones 2 and 3
const EA_BASE = 'https://environment.data.gov.uk/arcgis/rest/services/EA';

interface EaQueryResponse {
  features: Array<{ attributes: Record<string, unknown> }>;
}

async function queryFloodZone(lat: number, lon: number, zone: 2 | 3): Promise<boolean> {
  const service = zone === 3
    ? 'FloodMapForPlanningRiversAndSeaFloodZone3/MapServer/0'
    : 'FloodMapForPlanningRiversAndSeaFloodZone2/MapServer/0';

  const params = new URLSearchParams({
    geometry:           `${lon},${lat}`,
    geometryType:       'esriGeometryPoint',
    inSR:               '4326',
    spatialRel:         'esriSpatialRelIntersects',
    outFields:          '*',
    returnGeometry:     'false',
    f:                  'json',
  });

  const res = await fetch(`${EA_BASE}/${service}/query?${params}`);
  if (!res.ok) throw new Error(`EA flood API error ${res.status}`);

  const body = await res.json() as EaQueryResponse;
  return body.features.length > 0;
}

function resolveRisk(inZone3: boolean, inZone2: boolean): string {
  if (inZone3) return 'high';       // Zone 3a/3b — significant flood probability
  if (inZone2) return 'medium';     // Zone 2 — between 0.1% and 1% annual probability
  return 'low';                     // Zone 1 — less than 0.1% annual probability
}

export const floodUkEnricher: Enricher = {
  name: 'flood_uk',

  async run(input: EnricherInput): Promise<EnricherResult> {
    const { latitude: lat, longitude: lon } = input;

    // Query both zones in parallel
    const [inZone3, inZone2] = await Promise.all([
      queryFloodZone(lat, lon, 3),
      queryFloodZone(lat, lon, 2),
    ]);

    const risk = resolveRisk(inZone3, inZone2);

    // 1-year TTL — flood zone designations change rarely
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    return {
      data: {
        in_flood_zone_3: inZone3,
        in_flood_zone_2: inZone2,
        flood_risk:      risk,
        source:          'Environment Agency Flood Map for Planning',
      },
      summary: { flood_risk: risk },
      expiresAt,
    };
  },
};
```

### 10.7 UK Land Registry enricher

**`src/enrichers/land-registry-uk.ts`**

Fetches recent sold prices in the same postcode from HM Land Registry open data.
No API key required. Returns price trend data and comparable transactions.

```typescript
import type { Enricher, EnricherInput, EnricherResult } from './types.js';

// HM Land Registry Price Paid Linked Data API
const LR_BASE = 'https://landregistry.data.gov.uk/data/ppi';

interface LrTransaction {
  '@id':                   string;
  transactionDate:         string;
  pricePaid:               number;
  propertyAddress: {
    postcode:    string;
    town?:       string;
    street?:     string;
  };
  estateType:              { prefLabel: string };
  newBuild:                boolean;
  propertyType:            { prefLabel: string };
}

interface LrResponse {
  result: {
    items: LrTransaction[];
  };
}

export const landRegistryUkEnricher: Enricher = {
  name: 'land_registry_uk',

  async run(input: EnricherInput): Promise<EnricherResult> {
    if (!input.postal_code) throw new Error('No postal_code for Land Registry lookup');

    const postcode = input.postal_code.replace(/\s+/g, '');
    const url = [
      `${LR_BASE}/transaction-record.json`,
      `?propertyAddress.postcode=${postcode}`,
      `&_pageSize=20`,
      `&_sort=-transactionDate`,
    ].join('');

    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Land Registry error ${res.status}`);

    const body = await res.json() as LrResponse;
    const items = body.result?.items ?? [];

    if (items.length === 0) {
      return {
        data:      { postcode, transaction_count: 0, transactions: [] },
        summary:   {},
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };
    }

    const prices = items.map(t => t.pricePaid).filter(Boolean);
    const avg    = prices.reduce((a, b) => a + b, 0) / prices.length;
    const min    = Math.min(...prices);
    const max    = Math.max(...prices);

    const transactions = items.slice(0, 10).map(t => ({
      date:          t.transactionDate,
      price:         t.pricePaid,
      property_type: t.propertyType?.prefLabel ?? null,
      new_build:     t.newBuild,
      estate_type:   t.estateType?.prefLabel ?? null,
    }));

    // 30-day TTL — new sales registered monthly
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    return {
      data: {
        postcode,
        transaction_count:  items.length,
        avg_sold_price:     Math.round(avg),
        min_sold_price:     min,
        max_sold_price:     max,
        most_recent_sale:   transactions[0],
        transactions,
      },
      summary: {},
      expiresAt,
    };
  },
};
```

---

## 11. Implementation — Queue & Worker

### 11.1 pgboss singleton

**`src/queue/boss.ts`**

```typescript
import PgBoss from 'pg-boss';

let _boss: PgBoss | null = null;

export async function getBoss(): Promise<PgBoss> {
  if (_boss) return _boss;

  // pgboss connects directly to PostgreSQL using the Supabase connection string.
  // Find this under: Supabase dashboard → Settings → Database → Connection string (URI)
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) throw new Error('SUPABASE_DB_URL is required for pgboss');

  _boss = new PgBoss({ connectionString, schema: 'pgboss' });
  _boss.on('error', err => console.error('[pgboss]', err));
  await _boss.start();
  return _boss;
}

export const ENRICH_QUEUE = 'enrich-property';
```

Add `SUPABASE_DB_URL` to your `.env` — find it in:
Supabase dashboard → **Settings → Database → Connection string (URI)**.

### 11.2 Scheduler

**`src/queue/scheduler.ts`**

Called after a successful import to enqueue one enrichment job per property.

```typescript
import { getBoss, ENRICH_QUEUE } from './boss.js';
import { getEnrichersForCountry } from '../enrichers/registry.js';

export interface EnrichJobData {
  property_id:    string;
  enricher_name:  string;
  latitude:       number;
  longitude:      number;
  country:        string | null;
  postal_code:    string | null;
  city:           string | null;
  address_string: string | null;
}

export async function scheduleEnrichment(
  propertyId:    string,
  latitude:      number,
  longitude:     number,
  country:       string | null,
  postalCode:    string | null,
  city:          string | null,
  addressString: string | null,
): Promise<void> {
  const boss     = await getBoss();
  const enrichers = getEnrichersForCountry(country);

  const jobs = enrichers.map(enricher => ({
    name: ENRICH_QUEUE,
    data: {
      property_id:    propertyId,
      enricher_name:  enricher.name,
      latitude,
      longitude,
      country,
      postal_code:    postalCode,
      city,
      address_string: addressString,
    } satisfies EnrichJobData,
    options: {
      retryLimit:  3,
      retryDelay:  60,    // seconds between retries
      expireInHours: 24,
    },
  }));

  await boss.insert(jobs);
}
```

### 11.3 Worker

**`src/queue/worker.ts`**

Run this as a separate process alongside the API server.

```typescript
import 'dotenv/config';
import { getBoss, ENRICH_QUEUE }  from './boss.js';
import { getEnrichersForCountry } from '../enrichers/registry.js';
import { getDb }                  from '../db/client.js';
import type { EnrichJobData }     from './scheduler.js';

async function runWorker(): Promise<void> {
  const boss = await getBoss();
  const db   = getDb();

  console.log('[worker] started, listening for enrichment jobs');

  await boss.work<EnrichJobData>(
    ENRICH_QUEUE,
    { teamSize: 5, teamConcurrency: 5 },
    async (job) => {
      const {
        property_id,
        enricher_name,
        latitude,
        longitude,
        country,
        postal_code,
        city,
        address_string,
      } = job.data;

      console.log(`[worker] enriching ${property_id} with ${enricher_name}`);

      // Mark as running
      await db.from('enrichments').upsert({
        property_id,
        enricher: enricher_name,
        status:   'running',
      }, { onConflict: 'property_id,enricher' });

      // Find the enricher
      const allEnrichers  = getEnrichersForCountry(country);
      const enricher      = allEnrichers.find(e => e.name === enricher_name);

      if (!enricher) {
        await db.from('enrichments').upsert({
          property_id,
          enricher:    enricher_name,
          status:      'skipped',
          error:       'enricher not found in registry',
          completed_at: new Date().toISOString(),
        }, { onConflict: 'property_id,enricher' });
        return;
      }

      try {
        const result = await enricher.run({
          property_id,
          latitude,
          longitude,
          country,
          postal_code,
          city,
          address_string,
        });

        // Write full enrichment result
        await db.from('enrichments').upsert({
          property_id,
          enricher:    enricher_name,
          status:      'complete',
          data:        result.data,
          completed_at: new Date().toISOString(),
          expires_at:  result.expiresAt,
        }, { onConflict: 'property_id,enricher' });

        // Merge summary fields back into properties
        if (Object.keys(result.summary).length > 0) {
          await db.from('properties')
            .update({ ...result.summary, enriched_at: new Date().toISOString() })
            .eq('id', property_id);
        }

        // Check if all enrichments are done; update enrichment_status
        const { data: pending } = await db
          .from('enrichments')
          .select('status')
          .eq('property_id', property_id)
          .in('status', ['pending', 'running']);

        if (!pending?.length) {
          await db.from('properties')
            .update({ enrichment_status: 'complete' })
            .eq('id', property_id);
        }

      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        console.error(`[worker] ${enricher_name} failed for ${property_id}:`, error);

        await db.from('enrichments').upsert({
          property_id,
          enricher:    enricher_name,
          status:      'failed',
          error,
          completed_at: new Date().toISOString(),
        }, { onConflict: 'property_id,enricher' });
      }
    },
  );
}

runWorker().catch(err => {
  console.error('[worker] fatal:', err);
  process.exit(1);
});
```

---

## 12. Implementation — Routes

### 12.1 Imports route

**`src/routes/imports.ts`**

```typescript
import { Hono }             from 'hono';
import { getDb }            from '../db/client.js';
import { fetchFromScraper } from '../fetchers/index.js';
import { scheduleEnrichment } from '../queue/scheduler.js';

export const importsRouter = new Hono();

// POST /imports — submit a scraper URL
importsRouter.post('/', async (c) => {
  const body = await c.req.json<{ source_url?: string }>();
  const sourceUrl = body.source_url?.trim();

  if (!sourceUrl) {
    return c.json({ error: 'source_url is required' }, 400);
  }

  const db = getDb();

  // Fetch from scraper project
  let fetchResult;
  try {
    fetchResult = await fetchFromScraper(sourceUrl);
  } catch (err) {
    return c.json({ error: String(err) }, 422);
  }

  const { sourceType, sourceId, properties } = fetchResult;

  // Create import record
  const { data: importRow, error: importErr } = await db
    .from('imports')
    .insert({
      source_url:    sourceUrl,
      source_type:   sourceType,
      source_id:     sourceId,
      status:        'processing',
      listing_count: properties.length,
    })
    .select('id')
    .single();

  if (importErr || !importRow) {
    return c.json({ error: 'Failed to create import record' }, 500);
  }

  const importId = importRow.id as string;

  // Insert properties and enqueue enrichment jobs
  const propertyIds: string[] = [];

  for (const prop of properties) {
    // Build PostGIS point string if coordinates available
    const location = (prop.latitude && prop.longitude)
      ? `POINT(${prop.longitude} ${prop.latitude})`
      : null;

    const { data: propRow, error: propErr } = await db
      .from('properties')
      .insert({
        import_id:          importId,
        source_listing_id:  prop.source_listing_id,
        source_url:         prop.source_url,
        portal:             prop.portal,
        country:            prop.country,
        title:              prop.title,
        price_float:        prop.price_float,
        price_currency:     prop.price_currency,
        price_string:       prop.price_string,
        latitude:           prop.latitude,
        longitude:          prop.longitude,
        location:           location ? `SRID=4326;${location}` : null,
        address_string:     prop.address_string,
        city:               prop.city,
        region:             prop.region,
        postal_code:        prop.postal_code,
        count_bedrooms:     prop.count_bedrooms,
        count_bathrooms:    prop.count_bathrooms,
        constructed_area:   prop.constructed_area,
        plot_area:          prop.plot_area,
        area_unit:          prop.area_unit,
        year_construction:  prop.year_construction,
        property_type:      prop.property_type,
        property_subtype:   prop.property_subtype,
        tenure:             prop.tenure,
        for_sale:           prop.for_sale,
        for_rent:           prop.for_rent,
        for_rent_long_term:  prop.for_rent_long_term,
        for_rent_short_term: prop.for_rent_short_term,
        sold:               prop.sold,
        features:           prop.features,
        main_image_url:     prop.main_image_url,
        description:        prop.description,
        agent_name:         prop.agent_name,
        scraped_at:         prop.scraped_at,
        enrichment_status:  (prop.latitude && prop.longitude) ? 'pending' : 'failed',
      })
      .select('id')
      .single();

    if (propErr || !propRow) continue;

    const propertyId = propRow.id as string;
    propertyIds.push(propertyId);

    // Only enqueue enrichment if coordinates are available
    if (prop.latitude && prop.longitude) {
      await scheduleEnrichment(
        propertyId,
        prop.latitude,
        prop.longitude,
        prop.country,
        prop.postal_code,
        prop.city,
        prop.address_string,
      );
    }
  }

  // Mark import complete
  await db.from('imports').update({ status: 'complete', completed_at: new Date().toISOString() })
    .eq('id', importId);

  return c.json({
    import_id:    importId,
    source_type:  sourceType,
    source_id:    sourceId,
    listing_count: properties.length,
    property_ids: propertyIds,
    status:       'processing',   // enrichment still running in background
  }, 201);
});

// GET /imports/:id — poll import status
importsRouter.get('/:id', async (c) => {
  const db = getDb();
  const { data, error } = await db
    .from('imports')
    .select('*')
    .eq('id', c.req.param('id'))
    .single();

  if (error || !data) return c.json({ error: 'Import not found' }, 404);

  // Include property enrichment summary
  const { data: props } = await db
    .from('properties')
    .select('id, enrichment_status, source_url')
    .eq('import_id', data.id);

  return c.json({ ...data, properties: props ?? [] });
});
```

### 12.2 Properties route

**`src/routes/properties.ts`**

```typescript
import { Hono } from 'hono';
import { getDb } from '../db/client.js';

export const propertiesRouter = new Hono();

// GET /properties — list with optional filters
propertiesRouter.get('/', async (c) => {
  const db      = getDb();
  const country = c.req.query('country');
  const city    = c.req.query('city');
  const minBeds = c.req.query('min_beds');
  const maxPrice = c.req.query('max_price');
  const limit   = Math.min(Number(c.req.query('limit') ?? 50), 200);
  const offset  = Number(c.req.query('offset') ?? 0);

  let query = db
    .from('properties')
    .select('id, source_url, title, price_float, price_currency, city, country, count_bedrooms, property_type, walkability_score, flood_risk, epc_grade, enrichment_status, imported_at')
    .order('imported_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (country)  query = query.eq('country', country);
  if (city)     query = query.ilike('city', `%${city}%`);
  if (minBeds)  query = query.gte('count_bedrooms', Number(minBeds));
  if (maxPrice) query = query.lte('price_float', Number(maxPrice));

  const { data, error } = await query;
  if (error) return c.json({ error: error.message }, 500);

  return c.json({ properties: data ?? [], limit, offset });
});

// GET /properties/:id — full enriched property
propertiesRouter.get('/:id', async (c) => {
  const db = getDb();
  const { data: prop, error } = await db
    .from('properties')
    .select('*')
    .eq('id', c.req.param('id'))
    .single();

  if (error || !prop) return c.json({ error: 'Property not found' }, 404);

  const { data: enrichments } = await db
    .from('enrichments')
    .select('enricher, status, data, completed_at, expires_at')
    .eq('property_id', prop.id);

  return c.json({ ...prop, enrichments: enrichments ?? [] });
});

// GET /properties/:id/enrichments — enrichment details only
propertiesRouter.get('/:id/enrichments', async (c) => {
  const db = getDb();
  const { data, error } = await db
    .from('enrichments')
    .select('*')
    .eq('property_id', c.req.param('id'))
    .order('enricher');

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ enrichments: data ?? [] });
});

// POST /properties/:id/re-enrich — trigger fresh enrichment
propertiesRouter.post('/:id/re-enrich', async (c) => {
  const db = getDb();
  const { data: prop, error } = await db
    .from('properties')
    .select('id, latitude, longitude, country, postal_code, city, address_string')
    .eq('id', c.req.param('id'))
    .single();

  if (error || !prop) return c.json({ error: 'Property not found' }, 404);
  if (!prop.latitude || !prop.longitude) {
    return c.json({ error: 'Property has no coordinates — cannot enrich' }, 422);
  }

  // Reset enrichment state
  await db.from('enrichments').delete().eq('property_id', prop.id);
  await db.from('properties').update({ enrichment_status: 'pending', enriched_at: null })
    .eq('id', prop.id);

  const { scheduleEnrichment } = await import('../queue/scheduler.js');
  await scheduleEnrichment(
    prop.id,
    prop.latitude,
    prop.longitude,
    prop.country,
    prop.postal_code,
    prop.city,
    prop.address_string,
  );

  return c.json({ message: 'Re-enrichment queued', property_id: prop.id });
});

// GET /properties/nearby — spatial query
propertiesRouter.get('/nearby', async (c) => {
  const lat    = Number(c.req.query('lat'));
  const lng    = Number(c.req.query('lng'));
  const radius = Number(c.req.query('radius_km') ?? 1);
  const limit  = Math.min(Number(c.req.query('limit') ?? 20), 100);

  if (!lat || !lng) return c.json({ error: 'lat and lng are required' }, 400);

  const db = getDb();

  // PostGIS ST_DWithin — distance in metres (geography type)
  const { data, error } = await db.rpc('properties_within_radius', {
    ref_lat:    lat,
    ref_lng:    lng,
    radius_m:   radius * 1000,
    row_limit:  limit,
  });

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ properties: data ?? [], radius_km: radius });
});
```

Add the PostGIS RPC function to Supabase (SQL editor):

```sql
CREATE OR REPLACE FUNCTION properties_within_radius(
  ref_lat   FLOAT,
  ref_lng   FLOAT,
  radius_m  FLOAT,
  row_limit INT DEFAULT 20
)
RETURNS TABLE (
  id              UUID,
  source_url      TEXT,
  title           TEXT,
  price_float     FLOAT,
  price_currency  TEXT,
  latitude        FLOAT,
  longitude       FLOAT,
  city            TEXT,
  country         TEXT,
  count_bedrooms  INT,
  property_type   TEXT,
  distance_m      FLOAT
)
LANGUAGE sql STABLE AS $$
  SELECT
    p.id, p.source_url, p.title, p.price_float, p.price_currency,
    p.latitude, p.longitude, p.city, p.country, p.count_bedrooms,
    p.property_type,
    ST_Distance(p.location, ST_MakePoint(ref_lng, ref_lat)::GEOGRAPHY) AS distance_m
  FROM properties p
  WHERE p.location IS NOT NULL
    AND ST_DWithin(p.location, ST_MakePoint(ref_lng, ref_lat)::GEOGRAPHY, radius_m)
  ORDER BY distance_m
  LIMIT row_limit;
$$;
```

---

## 13. Implementation — App Entry Point

**`src/index.ts`**

```typescript
import 'dotenv/config';
import { serve }   from '@hono/node-server';
import { Hono }    from 'hono';
import { logger }  from 'hono/logger';
import { cors }    from 'hono/cors';

import { importsRouter }    from './routes/imports.js';
import { propertiesRouter } from './routes/properties.js';

const app = new Hono();

app.use('*', logger());
app.use('*', cors());

app.get('/health', (c) => c.json({ status: 'ok', ts: new Date().toISOString() }));

app.route('/imports',    importsRouter);
app.route('/properties', propertiesRouter);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message }, 500);
});

const port = Number(process.env.PORT ?? 3000);
console.log(`property-context listening on :${port}`);

serve({ fetch: app.fetch, port });
```

---

## 14. Running Locally

You need two terminal processes: the API server and the worker.

```bash
# Terminal 1 — API server
npm run dev

# Terminal 2 — enrichment worker
npm run worker
```

**Test the import flow:**

```bash
# Submit a haul URL from the scraper project
curl -X POST http://localhost:3000/imports \
  -H 'Content-Type: application/json' \
  -d '{"source_url":"https://your-scraper.com/ext/v1/hauls/haul_abc123"}'

# Response:
# { "import_id": "...", "property_ids": ["..."], "status": "processing" }

# Poll import status
curl http://localhost:3000/imports/<import_id>

# Get enriched property (enrichment may still be running)
curl http://localhost:3000/properties/<property_id>

# List all properties
curl http://localhost:3000/properties

# Nearby properties (1km radius around London Bridge)
curl "http://localhost:3000/properties/nearby?lat=51.5079&lng=-0.0877&radius_km=1"
```

---

## 15. Deployment

### 15.1 Railway (recommended)

Railway handles both the API server and worker as separate services sharing
environment variables.

1. Push your code to GitHub
2. Go to [railway.app](https://railway.app) → **New project → Deploy from GitHub**
3. Set all environment variables in Railway's **Variables** tab
4. Railway auto-detects Node.js and runs `npm start`
5. For the worker: **New service → same repo**, override start command to `npm run worker`

**`railway.json`** (optional, for explicit config):
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": { "builder": "NIXPACKS" },
  "deploy": { "startCommand": "node dist/index.js", "restartPolicyType": "ON_FAILURE" }
}
```

### 15.2 Fly.io (alternative)

```bash
# Install flyctl and log in
curl -L https://fly.io/install.sh | sh
fly auth login

# Launch (creates fly.toml)
fly launch

# Set secrets
fly secrets set \
  SUPABASE_URL=https://xxx.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=eyJ... \
  SUPABASE_DB_URL=postgresql://... \
  SCRAPER_BASE_URL=https://... \
  SCRAPER_API_KEY=pws_live_... \
  WALKSCORE_API_KEY=... \
  EPC_API_EMAIL=... \
  EPC_API_KEY=...

# Deploy
fly deploy

# Deploy worker as a separate machine
fly machine run . --env NODE_ENV=production --command "node dist/queue/worker.js"
```

---

## 16. Enricher API Reference

### Overpass (OpenStreetMap)

| Detail | Value |
|--------|-------|
| API | `https://overpass-api.de/api/interpreter` |
| Auth | None |
| Method | `POST` with OverpassQL in body |
| Rate limit | ~1 req/s recommended, do not hammer |
| Docs | [wiki.openstreetmap.org/wiki/Overpass_API](https://wiki.openstreetmap.org/wiki/Overpass_API) |
| TTL | 90 days |

Output fields: `schools`, `transit`, `supermarkets`, `parks`, `hospitals`, `pharmacies`
(each with `count`, `nearest.name`, `nearest.distance_m`, `items[]`)

### Walk Score

| Detail | Value |
|--------|-------|
| API | `https://api.walkscore.com/score` |
| Auth | API key in query string (`wsapikey=`) |
| Rate limit | 5 000 calls/day on free tier |
| Register | [walkscore.com/professional/api.php](https://www.walkscore.com/professional/api.php) |
| TTL | 30 days |

Output fields: `walkscore` (0–100), `transit_score` (0–100), `bike_score` (0–100),
plus description strings for each.

### UK EPC Register

| Detail | Value |
|--------|-------|
| API | `https://epc.opendatacommunities.org/api/v1/domestic/search` |
| Auth | Basic auth — email + API key |
| Rate limit | Not published; be reasonable |
| Register | [epc.opendatacommunities.org](https://epc.opendatacommunities.org/) |
| TTL | 1 year |

Output fields: `current_energy_rating` (A–G), `potential_energy_rating`,
`current_energy_efficiency` (0–100), `potential_energy_efficiency`,
`co2_emissions_current`, `property_type`, `built_form`.

### UK Flood Risk (Environment Agency)

| Detail | Value |
|--------|-------|
| API | Environment Agency ArcGIS REST services |
| Auth | None |
| Rate limit | Not published |
| Docs | [environment.data.gov.uk](https://environment.data.gov.uk) |
| TTL | 1 year |

Output fields: `in_flood_zone_3` (boolean), `in_flood_zone_2` (boolean),
`flood_risk` (`low` / `medium` / `high`).

Risk mapping: Zone 3 = high (>1% annual probability), Zone 2 = medium (0.1–1%),
Zone 1 (neither) = low (<0.1%).

### UK Land Registry Price Paid

| Detail | Value |
|--------|-------|
| API | `https://landregistry.data.gov.uk/data/ppi/transaction-record.json` |
| Auth | None |
| Rate limit | Not published |
| Docs | [landregistry.data.gov.uk](https://landregistry.data.gov.uk) |
| TTL | 30 days |

Output fields: `transaction_count`, `avg_sold_price`, `min_sold_price`,
`max_sold_price`, `most_recent_sale`, `transactions[]` (up to 10 recent).

---

## 17. Adding a New Enricher

1. **Create the file** `src/enrichers/<name>.ts`
2. **Implement** the `Enricher` interface from `src/enrichers/types.ts`
3. **Register it** in `src/enrichers/registry.ts` (global or country-specific)
4. The worker picks it up automatically — no other changes needed

Minimal enricher template:

```typescript
import type { Enricher, EnricherInput, EnricherResult } from './types.js';

export const myEnricher: Enricher = {
  name: 'my_enricher',  // must be unique; stored in enrichments.enricher column

  async run(input: EnricherInput): Promise<EnricherResult> {
    const { latitude, longitude, country, postal_code } = input;

    // ... call external API ...
    const apiData = {};

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    return {
      data:    apiData,          // stored as-is in enrichments.data (JSONB)
      summary: {},               // merged into properties table summary columns
      expiresAt,
    };
  },
};
```

Then in `registry.ts`:

```typescript
import { myEnricher } from './my-enricher.js';

// Add to GLOBAL_ENRICHERS or a specific country entry
const GLOBAL_ENRICHERS: Enricher[] = [
  overpassEnricher,
  walkscoreEnricher,
  myEnricher,   // ← add here
];
```

That's all that's needed. The queue, worker, and API routes require no changes.
