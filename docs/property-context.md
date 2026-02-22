# property-context — Developer Guide

A property enrichment service built with Astro.js and Firebase/Firestore. It
accepts a property listing URL or haul URL from the `property_web_scraper`
project, fetches the scraped data, enriches each property with location and
market intelligence from external APIs, and stores everything in Firestore.

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
11. [Implementation — Routes](#11-implementation--routes)
12. [Implementation — Frontend Pages](#12-implementation--frontend-pages)
13. [Implementation — Astro Config](#13-implementation--astro-config)
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
You → POST /api/imports { source_url }
   → property-context fetches from scraper API
   → stores property snapshot in Firestore
   → runs enrichment inline (awaits all enrichers)
   → returns with { import_id, property_ids, status }
```

Everything else — database, enrichers, API, frontend — is fully independent.

**Key difference from a queue-based design:** enrichment runs inline during the
import request using `Promise.allSettled()`. There is no separate worker process
or job queue. The import endpoint waits for all enrichers to complete before
responding.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        property-context                         │
│                        (Astro.js SSR)                           │
│                                                                 │
│  POST /api/imports                                              │
│       │                                                         │
│       ▼                                                         │
│  ┌──────────┐    HTTP GET    ┌─────────────────────────────┐   │
│  │ Fetcher  │ ─────────────► │  property_web_scraper API   │   │
│  │          │ ◄───────────── │  /ext/v1/hauls/:id          │   │
│  └──────────┘   JSON         │  /public_api/v1/listings/:id│   │
│       │                      └─────────────────────────────┘   │
│       ▼                                                         │
│  ┌──────────────────────┐                                       │
│  │  Firestore           │                                       │
│  │  ├── imports          │                                       │
│  │  ├── properties       │                                       │
│  │  │   └── enrichments  │  (subcollection)                     │
│  │  └──                  │                                       │
│  └──────────────────────┘                                       │
│       │                                                         │
│       ▼                                                         │
│  ┌──────────────────────────────────────┐                       │
│  │  Inline enrichment (Promise.allSettled)                      │
│  │  ├── overpass.ts      (global)       │                       │
│  │  ├── walkscore.ts     (global)       │                       │
│  │  ├── epc-uk.ts        (UK only)      │                       │
│  │  ├── flood-uk.ts      (UK only)      │                       │
│  │  └── land-registry-uk.ts (UK only)   │                       │
│  └──────────────────────────────────────┘                       │
│       │                                                         │
│       ▼                                                         │
│  ┌──────────────────────┐                                       │
│  │  Firestore           │                                       │
│  │  enrichments written  │                                       │
│  └──────────────────────┘                                       │
│                                                                 │
│  ┌──────────────────────────────────────┐                       │
│  │  Astro Pages (frontend)              │                       │
│  │  ├── /dashboard      (recent imports)│                       │
│  │  ├── /properties/:id (detail view)   │                       │
│  │  └── /imports/new    (import form)   │                       │
│  └──────────────────────────────────────┘                       │
└─────────────────────────────────────────────────────────────────┘
```

**Processing model:** both fetch and enrichment happen synchronously within the
`POST /api/imports` handler. The caller receives the full result when enrichment
completes. Use `GET /api/properties/:id` to retrieve enriched data later.

---

## 3. Prerequisites

- Node.js ≥ 20
- npm ≥ 10
- A [Firebase](https://firebase.google.com) project with Firestore enabled (free Spark plan is sufficient)
- A Firebase service account JSON key (for server-side Admin SDK access)
- A [Walk Score API key](https://www.walkscore.com/professional/api.php) (free, 5 000 calls/day)
- For UK enrichers: an [EPC Register API key](https://epc.opendatacommunities.org/) (free)
- A running instance of `property_web_scraper` (the source project) with its base URL

---

## 4. Project Setup

### 4.1 Initialise the repository

```bash
npm create astro@latest property-context -- --template minimal
cd property-context
git init
```

### 4.2 Install dependencies

```bash
# Runtime
npm install firebase-admin geofire-common

# Dev
npm install -D vitest @types/node
```

### 4.3 `package.json`

Update the generated `package.json`:

```json
{
  "name": "property-context",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "start": "node dist/server/entry.mjs",
    "test": "vitest run"
  },
  "dependencies": {
    "astro": "^5.17.0",
    "firebase-admin": "^13.0.0",
    "geofire-common": "^6.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "vitest": "^2.1.0"
  }
}
```

### 4.4 `tsconfig.json`

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@lib/*": ["src/lib/*"],
      "@components/*": ["src/components/*"]
    }
  }
}
```

---

## 5. Environment Variables

Create `.env` (and `.env.example` for the repo):

```bash
# ── Firebase ─────────────────────────────────────────────────────
FIRESTORE_PROJECT_ID=your-firebase-project-id
GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'

# ── Source project (property_web_scraper) ─────────────────────────
SCRAPER_BASE_URL=https://your-scraper-deployment.com
SCRAPER_API_KEY=pws_live_...            # optional; required only for /public_api routes

# ── Enricher API keys ─────────────────────────────────────────────
WALKSCORE_API_KEY=your_walkscore_key
EPC_API_EMAIL=you@example.com           # UK EPC Register credentials
EPC_API_KEY=your_epc_api_key            # UK EPC Register API key
```

> **Security:** Never commit `.env`. Add it to `.gitignore`.

---

## 6. Database Setup

### 6.1 Create a Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project**
2. Enable **Cloud Firestore** (start in test mode or configure rules below)
3. Go to **Project Settings → Service accounts → Generate new private key**
4. Paste the JSON into `GOOGLE_SERVICE_ACCOUNT_JSON` in your `.env`

### 6.2 Firestore collection structure

Firestore is schema-less, but the application expects these collections:

```
imports/
  {import_id}/
    source_url:       string
    source_type:      "haul" | "listing"
    source_id:        string
    status:           "pending" | "processing" | "complete" | "failed"
    listing_count:    number
    error:            string | null
    created_at:       timestamp
    completed_at:     timestamp | null

properties/
  {property_id}/
    import_id:             string
    source_listing_id:     string
    source_url:            string
    portal:                string | null
    country:               string | null

    # Scraped snapshot
    title:                 string | null
    price_float:           number | null
    price_currency:        string | null
    price_string:          string | null
    latitude:              number | null
    longitude:             number | null
    geohash:               string | null    # for proximity queries
    address_string:        string | null
    city:                  string | null
    region:                string | null
    postal_code:           string | null
    count_bedrooms:        number | null
    count_bathrooms:       number | null
    constructed_area:      number | null
    plot_area:             number | null
    area_unit:             string | null
    year_construction:     number | null
    property_type:         string | null
    property_subtype:      string | null
    tenure:                string | null
    for_sale:              boolean | null
    for_rent:              boolean | null
    for_rent_long_term:    boolean | null
    for_rent_short_term:   boolean | null
    sold:                  boolean | null
    features:              string[]
    main_image_url:        string | null
    description:           string | null
    agent_name:            string | null

    # Enrichment summary (denormalized for fast queries)
    walkability_score:     number | null
    transit_score:         number | null
    bike_score:            number | null
    flood_risk:            string | null    # "low" | "medium" | "high"
    epc_grade:             string | null    # "A".."G"
    nearby_schools:        number | null
    nearby_transit_stops:  number | null
    nearby_supermarkets:   number | null

    # Timestamps
    scraped_at:            timestamp | null
    imported_at:           timestamp
    enriched_at:           timestamp | null
    enrichment_status:     "pending" | "partial" | "complete" | "failed"

    # Subcollection
    enrichments/
      {enricher_name}/
        enricher:      string
        status:        "pending" | "running" | "complete" | "failed" | "skipped"
        data:          map          # raw enricher output
        error:         string | null
        created_at:    timestamp
        completed_at:  timestamp | null
        expires_at:    timestamp | null
```

### 6.3 Firestore security rules

For development, use permissive rules. For production, restrict to the
service account only (Admin SDK bypasses rules, but this protects against
accidental client access):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Deny all client access — only Admin SDK (server) writes
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### 6.4 Firestore indexes

Create a composite index for nearby queries (geohash-based):

```
Collection: properties
Fields:     geohash (ascending), imported_at (descending)
```

Create this in the Firebase console under **Firestore → Indexes → Composite**.

---

## 7. Project Structure

```
property-context/
├── src/
│   ├── lib/
│   │   ├── db/
│   │   │   └── client.ts            # Firebase Admin SDK singleton
│   │   ├── fetchers/
│   │   │   ├── index.ts             # dispatch: detect haul vs listing URL
│   │   │   ├── types.ts             # ScrapedProperty interface
│   │   │   ├── haul.ts              # fetch + normalise haul response
│   │   │   └── listing.ts           # fetch + normalise single listing
│   │   ├── enrichers/
│   │   │   ├── registry.ts          # maps country → applicable enrichers
│   │   │   ├── types.ts             # shared Enricher interface
│   │   │   ├── runner.ts            # inline enrichment runner
│   │   │   ├── overpass.ts          # OpenStreetMap nearby POIs (global, free)
│   │   │   ├── walkscore.ts         # walk/transit/bike scores
│   │   │   ├── epc-uk.ts            # UK energy performance certificates
│   │   │   ├── flood-uk.ts          # UK Environment Agency flood risk
│   │   │   └── land-registry-uk.ts  # UK HM Land Registry sold prices
│   │   └── services/
│   │       └── api-response.ts      # JSON response helpers
│   ├── pages/
│   │   ├── api/
│   │   │   ├── imports/
│   │   │   │   ├── index.ts         # POST /api/imports
│   │   │   │   └── [id].ts          # GET /api/imports/:id
│   │   │   └── properties/
│   │   │       ├── index.ts         # GET /api/properties
│   │   │       ├── nearby.ts        # GET /api/properties/nearby
│   │   │       ├── [id].ts          # GET /api/properties/:id
│   │   │       └── [id]/
│   │   │           └── re-enrich.ts # POST /api/properties/:id/re-enrich
│   │   ├── dashboard.astro          # Recent imports and properties
│   │   ├── imports/
│   │   │   └── new.astro            # Import form
│   │   └── properties/
│   │       └── [id].astro           # Property detail page
│   └── layouts/
│       └── Base.astro               # Shared page layout
├── .env
├── .env.example
├── .gitignore
├── astro.config.mjs
├── package.json
└── tsconfig.json
```

---

## 8. Implementation — Database Client

**`src/lib/db/client.ts`**

Singleton pattern matching the existing astro-app conventions.

```typescript
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

let _db: Firestore | null = null;

export function getDb(): Firestore {
  if (_db) return _db;

  const projectId = import.meta.env.FIRESTORE_PROJECT_ID;
  const credsJson = import.meta.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (!projectId || !credsJson) {
    throw new Error('FIRESTORE_PROJECT_ID and GOOGLE_SERVICE_ACCOUNT_JSON are required');
  }

  if (getApps().length === 0) {
    const creds = JSON.parse(credsJson);
    initializeApp({ credential: cert(creds), projectId });
  }

  _db = getFirestore();
  return _db;
}

export function resetDb(): void {
  _db = null;
}
```

---

## 9. Implementation — Fetchers

### 9.1 Types

**`src/lib/fetchers/types.ts`**

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

**`src/lib/fetchers/haul.ts`**

Calls `GET /ext/v1/hauls/:id` on the scraper project. No authentication required.

```typescript
import type { ScrapedProperty } from './types.js';

const BASE_URL = import.meta.env.SCRAPER_BASE_URL;

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
    portal:            null,
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

**`src/lib/fetchers/listing.ts`**

Calls `GET /public_api/v1/listings/:id`. Requires an API key.

```typescript
import type { ScrapedProperty } from './types.js';

const BASE_URL  = import.meta.env.SCRAPER_BASE_URL;
const API_KEY   = import.meta.env.SCRAPER_API_KEY ?? '';

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

**`src/lib/fetchers/index.ts`**

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

**`src/lib/enrichers/types.ts`**

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

// What an enricher writes to the enrichments subcollection.
// The `data` field is free-form; `summary` fields are
// written back to the property document.
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

**`src/lib/enrichers/registry.ts`**

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

### 10.3 Enrichment runner

**`src/lib/enrichers/runner.ts`**

Runs all applicable enrichers inline using `Promise.allSettled()`. Called
directly from the import route — no queue or worker needed.

```typescript
import { getDb } from '@lib/db/client.js';
import { getEnrichersForCountry } from './registry.js';
import { FieldValue } from 'firebase-admin/firestore';
import type { EnricherInput } from './types.js';

export async function runEnrichment(input: EnricherInput): Promise<void> {
  const db = getDb();
  const enrichers = getEnrichersForCountry(input.country);

  if (enrichers.length === 0) return;

  const propertyRef = db.collection('properties').doc(input.property_id);

  const results = await Promise.allSettled(
    enrichers.map(async (enricher) => {
      // Mark as running
      await propertyRef.collection('enrichments').doc(enricher.name).set({
        enricher: enricher.name,
        status:   'running',
        created_at: FieldValue.serverTimestamp(),
      });

      try {
        const result = await enricher.run(input);

        // Write enrichment result
        await propertyRef.collection('enrichments').doc(enricher.name).set({
          enricher:     enricher.name,
          status:       'complete',
          data:         result.data,
          completed_at: FieldValue.serverTimestamp(),
          expires_at:   new Date(result.expiresAt),
        });

        // Merge summary fields back into property document
        if (Object.keys(result.summary).length > 0) {
          await propertyRef.update({
            ...result.summary,
            enriched_at: FieldValue.serverTimestamp(),
          });
        }

        return { enricher: enricher.name, status: 'complete' as const };
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        console.error(`[enricher] ${enricher.name} failed for ${input.property_id}:`, error);

        await propertyRef.collection('enrichments').doc(enricher.name).set({
          enricher:     enricher.name,
          status:       'failed',
          error,
          completed_at: FieldValue.serverTimestamp(),
        });

        return { enricher: enricher.name, status: 'failed' as const };
      }
    }),
  );

  // Determine overall enrichment status
  const statuses = results.map((r) =>
    r.status === 'fulfilled' ? r.value.status : 'failed',
  );
  const allComplete = statuses.every((s) => s === 'complete');
  const allFailed   = statuses.every((s) => s === 'failed');

  await propertyRef.update({
    enrichment_status: allComplete ? 'complete' : allFailed ? 'failed' : 'partial',
  });
}
```

### 10.4 Overpass enricher (OpenStreetMap nearby POIs)

**`src/lib/enrichers/overpass.ts`**

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

### 10.5 Walk Score enricher

**`src/lib/enrichers/walkscore.ts`**

Returns walkability, transit, and bike scores (0–100) for a location.
Requires a free API key from [walkscore.com/professional/api.php](https://www.walkscore.com/professional/api.php).

```typescript
import type { Enricher, EnricherInput, EnricherResult } from './types.js';

const API_KEY = import.meta.env.WALKSCORE_API_KEY ?? '';

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

### 10.6 UK EPC enricher

**`src/lib/enrichers/epc-uk.ts`**

Looks up the Energy Performance Certificate for a UK property by postcode.
Register for a free API key at [epc.opendatacommunities.org](https://epc.opendatacommunities.org/).

```typescript
import type { Enricher, EnricherInput, EnricherResult } from './types.js';

const EPC_EMAIL = import.meta.env.EPC_API_EMAIL ?? '';
const EPC_KEY   = import.meta.env.EPC_API_KEY   ?? '';

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

### 10.7 UK flood risk enricher

**`src/lib/enrichers/flood-uk.ts`**

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

### 10.8 UK Land Registry enricher

**`src/lib/enrichers/land-registry-uk.ts`**

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

## 11. Implementation — Routes

### 11.1 Response helpers

**`src/lib/services/api-response.ts`**

```typescript
export function successResponse(
  data: Record<string, unknown>,
  statusCode = 200,
): Response {
  return new Response(JSON.stringify({ success: true, ...data }), {
    status: statusCode,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function errorResponse(message: string, statusCode = 400): Response {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status: statusCode,
    headers: { 'Content-Type': 'application/json' },
  });
}
```

### 11.2 Imports routes

**`src/pages/api/imports/index.ts`** — `POST /api/imports`

```typescript
import type { APIRoute } from 'astro';
import { getDb } from '@lib/db/client.js';
import { fetchFromScraper } from '@lib/fetchers/index.js';
import { runEnrichment } from '@lib/enrichers/runner.js';
import { successResponse, errorResponse } from '@lib/services/api-response.js';
import { FieldValue } from 'firebase-admin/firestore';
import { geohashForLocation } from 'geofire-common';

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json() as { source_url?: string };
  const sourceUrl = body.source_url?.trim();

  if (!sourceUrl) {
    return errorResponse('source_url is required', 400);
  }

  const db = getDb();

  // Fetch from scraper project
  let fetchResult;
  try {
    fetchResult = await fetchFromScraper(sourceUrl);
  } catch (err) {
    return errorResponse(String(err), 422);
  }

  const { sourceType, sourceId, properties } = fetchResult;

  // Create import record
  const importRef = db.collection('imports').doc();
  const importId = importRef.id;

  await importRef.set({
    source_url:    sourceUrl,
    source_type:   sourceType,
    source_id:     sourceId,
    status:        'processing',
    listing_count: properties.length,
    error:         null,
    created_at:    FieldValue.serverTimestamp(),
    completed_at:  null,
  });

  // Insert properties and run enrichment inline
  const propertyIds: string[] = [];

  for (const prop of properties) {
    const propertyRef = db.collection('properties').doc();
    const propertyId = propertyRef.id;

    // Compute geohash for proximity queries
    const geohash = (prop.latitude && prop.longitude)
      ? geohashForLocation([prop.latitude, prop.longitude])
      : null;

    await propertyRef.set({
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
      geohash,
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
      imported_at:        FieldValue.serverTimestamp(),
      enriched_at:        null,
      enrichment_status:  (prop.latitude && prop.longitude) ? 'pending' : 'failed',
    });

    propertyIds.push(propertyId);

    // Run enrichment inline if coordinates are available
    if (prop.latitude && prop.longitude) {
      await runEnrichment({
        property_id:    propertyId,
        latitude:       prop.latitude,
        longitude:      prop.longitude,
        country:        prop.country,
        postal_code:    prop.postal_code,
        city:           prop.city,
        address_string: prop.address_string,
      });
    }
  }

  // Mark import complete
  await importRef.update({
    status:       'complete',
    completed_at: FieldValue.serverTimestamp(),
  });

  return successResponse({
    import_id:    importId,
    source_type:  sourceType,
    source_id:    sourceId,
    listing_count: properties.length,
    property_ids: propertyIds,
    status:       'complete',
  }, 201);
};
```

**`src/pages/api/imports/[id].ts`** — `GET /api/imports/:id`

```typescript
import type { APIRoute } from 'astro';
import { getDb } from '@lib/db/client.js';
import { successResponse, errorResponse } from '@lib/services/api-response.js';

export const GET: APIRoute = async ({ params }) => {
  const db = getDb();
  const { id } = params;

  const importDoc = await db.collection('imports').doc(id!).get();
  if (!importDoc.exists) {
    return errorResponse('Import not found', 404);
  }

  const importData = { id: importDoc.id, ...importDoc.data() };

  // Include property enrichment summary
  const propsSnap = await db.collection('properties')
    .where('import_id', '==', id)
    .select('enrichment_status', 'source_url')
    .get();

  const properties = propsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return successResponse({ ...importData, properties });
};
```

### 11.3 Properties routes

**`src/pages/api/properties/index.ts`** — `GET /api/properties`

```typescript
import type { APIRoute } from 'astro';
import { getDb } from '@lib/db/client.js';
import { successResponse, errorResponse } from '@lib/services/api-response.js';

export const GET: APIRoute = async ({ url }) => {
  const db      = getDb();
  const country = url.searchParams.get('country');
  const limit   = Math.min(Number(url.searchParams.get('limit') ?? 50), 200);
  const offset  = Number(url.searchParams.get('offset') ?? 0);

  let query: FirebaseFirestore.Query = db.collection('properties')
    .orderBy('imported_at', 'desc')
    .limit(limit)
    .offset(offset);

  if (country) {
    query = query.where('country', '==', country);
  }

  const snap = await query.get();
  const properties = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return successResponse({ properties, limit, offset });
};
```

**`src/pages/api/properties/[id].ts`** — `GET /api/properties/:id`

```typescript
import type { APIRoute } from 'astro';
import { getDb } from '@lib/db/client.js';
import { successResponse, errorResponse } from '@lib/services/api-response.js';

export const GET: APIRoute = async ({ params }) => {
  const db = getDb();
  const { id } = params;

  const propDoc = await db.collection('properties').doc(id!).get();
  if (!propDoc.exists) {
    return errorResponse('Property not found', 404);
  }

  const prop = { id: propDoc.id, ...propDoc.data() };

  // Fetch enrichment subcollection
  const enrichSnap = await propDoc.ref.collection('enrichments').get();
  const enrichments = enrichSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return successResponse({ ...prop, enrichments });
};
```

**`src/pages/api/properties/[id]/re-enrich.ts`** — `POST /api/properties/:id/re-enrich`

```typescript
import type { APIRoute } from 'astro';
import { getDb } from '@lib/db/client.js';
import { runEnrichment } from '@lib/enrichers/runner.js';
import { successResponse, errorResponse } from '@lib/services/api-response.js';

export const POST: APIRoute = async ({ params }) => {
  const db = getDb();
  const { id } = params;

  const propDoc = await db.collection('properties').doc(id!).get();
  if (!propDoc.exists) {
    return errorResponse('Property not found', 404);
  }

  const prop = propDoc.data()!;
  if (!prop.latitude || !prop.longitude) {
    return errorResponse('Property has no coordinates — cannot enrich', 422);
  }

  // Delete existing enrichments
  const enrichSnap = await propDoc.ref.collection('enrichments').get();
  const batch = db.batch();
  enrichSnap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();

  // Reset enrichment state
  await propDoc.ref.update({ enrichment_status: 'pending', enriched_at: null });

  // Run enrichment inline
  await runEnrichment({
    property_id:    propDoc.id,
    latitude:       prop.latitude,
    longitude:      prop.longitude,
    country:        prop.country,
    postal_code:    prop.postal_code,
    city:           prop.city,
    address_string: prop.address_string,
  });

  return successResponse({ message: 'Re-enrichment complete', property_id: propDoc.id });
};
```

**`src/pages/api/properties/nearby.ts`** — `GET /api/properties/nearby`

Uses geohash-based proximity queries via `geofire-common`.

```typescript
import type { APIRoute } from 'astro';
import { getDb } from '@lib/db/client.js';
import { geohashQueryBounds, distanceBetween } from 'geofire-common';
import { successResponse, errorResponse } from '@lib/services/api-response.js';

export const GET: APIRoute = async ({ url }) => {
  const lat      = Number(url.searchParams.get('lat'));
  const lng      = Number(url.searchParams.get('lng'));
  const radiusKm = Number(url.searchParams.get('radius_km') ?? 1);
  const limit    = Math.min(Number(url.searchParams.get('limit') ?? 20), 100);

  if (!lat || !lng) {
    return errorResponse('lat and lng are required', 400);
  }

  const db = getDb();
  const center: [number, number] = [lat, lng];
  const radiusM = radiusKm * 1000;

  // Get geohash range bounds for the query radius
  const bounds = geohashQueryBounds(center, radiusM);

  // Run all geohash range queries in parallel
  const snapshots = await Promise.all(
    bounds.map(([start, end]) =>
      db.collection('properties')
        .orderBy('geohash')
        .startAt(start)
        .endAt(end)
        .get(),
    ),
  );

  // Merge, filter by actual distance, sort, and limit
  const properties: Array<Record<string, unknown>> = [];

  for (const snap of snapshots) {
    for (const doc of snap.docs) {
      const data = doc.data();
      if (!data.latitude || !data.longitude) continue;

      const distKm = distanceBetween(
        [data.latitude, data.longitude],
        center,
      );

      if (distKm <= radiusKm) {
        properties.push({
          id: doc.id,
          ...data,
          distance_m: Math.round(distKm * 1000),
        });
      }
    }
  }

  properties.sort((a, b) => (a.distance_m as number) - (b.distance_m as number));
  const limited = properties.slice(0, limit);

  return successResponse({ properties: limited, radius_km: radiusKm });
};
```

---

## 12. Implementation — Frontend Pages

Astro pages provide a simple dashboard for viewing imports and properties.

### 12.1 Base layout

**`src/layouts/Base.astro`**

```astro
---
interface Props {
  title: string;
}
const { title } = Astro.props;
---
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{title} — property-context</title>
</head>
<body>
  <nav>
    <a href="/dashboard">Dashboard</a>
    <a href="/imports/new">New Import</a>
  </nav>
  <main>
    <slot />
  </main>
</body>
</html>
```

### 12.2 Dashboard

**`src/pages/dashboard.astro`**

```astro
---
import Base from '../layouts/Base.astro';
import { getDb } from '@lib/db/client.js';

const db = getDb();

const importsSnap = await db.collection('imports')
  .orderBy('created_at', 'desc')
  .limit(10)
  .get();
const imports = importsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

const propsSnap = await db.collection('properties')
  .orderBy('imported_at', 'desc')
  .limit(20)
  .get();
const properties = propsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
---
<Base title="Dashboard">
  <h1>Recent Imports</h1>
  <ul>
    {imports.map(imp => (
      <li>
        <strong>{imp.source_type}</strong> — {imp.source_id}
        ({imp.status}) — {imp.listing_count} listings
      </li>
    ))}
  </ul>

  <h1>Recent Properties</h1>
  <ul>
    {properties.map(prop => (
      <li>
        <a href={`/properties/${prop.id}`}>{prop.title ?? 'Untitled'}</a>
        — {prop.city} — {prop.enrichment_status}
      </li>
    ))}
  </ul>
</Base>
```

### 12.3 Property detail

**`src/pages/properties/[id].astro`**

```astro
---
import Base from '../../layouts/Base.astro';
import { getDb } from '@lib/db/client.js';

const { id } = Astro.params;
const db = getDb();

const propDoc = await db.collection('properties').doc(id!).get();
if (!propDoc.exists) return Astro.redirect('/dashboard');

const prop = { id: propDoc.id, ...propDoc.data() } as Record<string, any>;

const enrichSnap = await propDoc.ref.collection('enrichments').get();
const enrichments = enrichSnap.docs.map(d => ({ id: d.id, ...d.data() }));
---
<Base title={prop.title ?? 'Property'}>
  <h1>{prop.title ?? 'Untitled Property'}</h1>
  <p>{prop.address_string} — {prop.city}, {prop.country}</p>
  <p>Price: {prop.price_string ?? 'N/A'}</p>
  <p>Bedrooms: {prop.count_bedrooms ?? 'N/A'}</p>
  <p>Enrichment status: {prop.enrichment_status}</p>

  <h2>Enrichment Summary</h2>
  <ul>
    <li>Walk Score: {prop.walkability_score ?? '—'}</li>
    <li>Transit Score: {prop.transit_score ?? '—'}</li>
    <li>Bike Score: {prop.bike_score ?? '—'}</li>
    <li>Flood Risk: {prop.flood_risk ?? '—'}</li>
    <li>EPC Grade: {prop.epc_grade ?? '—'}</li>
    <li>Nearby Schools: {prop.nearby_schools ?? '—'}</li>
    <li>Nearby Transit: {prop.nearby_transit_stops ?? '—'}</li>
    <li>Nearby Supermarkets: {prop.nearby_supermarkets ?? '—'}</li>
  </ul>

  <h2>Enrichment Details</h2>
  {enrichments.map(e => (
    <details>
      <summary>{e.enricher} — {e.status}</summary>
      <pre>{JSON.stringify(e.data, null, 2)}</pre>
    </details>
  ))}

  <form method="post" action={`/api/properties/${id}/re-enrich`}>
    <button type="submit">Re-enrich</button>
  </form>
</Base>
```

### 12.4 Import form

**`src/pages/imports/new.astro`**

```astro
---
import Base from '../../layouts/Base.astro';
---
<Base title="New Import">
  <h1>Import Properties</h1>
  <form id="import-form">
    <label for="source_url">Scraper URL (haul or listing):</label>
    <input type="url" id="source_url" name="source_url" required
      placeholder="https://your-scraper.com/ext/v1/hauls/haul_abc123" />
    <button type="submit">Import</button>
  </form>
  <div id="result"></div>

  <script>
    const form = document.getElementById('import-form') as HTMLFormElement;
    const result = document.getElementById('result')!;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      result.textContent = 'Importing...';

      const sourceUrl = new FormData(form).get('source_url') as string;
      const res = await fetch('/api/imports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_url: sourceUrl }),
      });

      const data = await res.json();
      result.textContent = JSON.stringify(data, null, 2);
    });
  </script>
</Base>
```

---

## 13. Implementation — Astro Config

**`astro.config.mjs`**

```javascript
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
});
```

> **Note:** If deploying to Cloudflare (matching the existing astro-app), swap
> `@astrojs/node` for `@astrojs/cloudflare`. The Firebase Admin SDK requires a
> Node.js runtime, so Cloud Run or a standalone Node adapter is recommended.

---

## 14. Running Locally

Only one process is needed — the Astro dev server handles both API routes and
frontend pages:

```bash
npm run dev
```

**Test the import flow:**

```bash
# Submit a haul URL from the scraper project
curl -X POST http://localhost:4321/api/imports \
  -H 'Content-Type: application/json' \
  -d '{"source_url":"https://your-scraper.com/ext/v1/hauls/haul_abc123"}'

# Response (enrichment runs inline, so status is 'complete'):
# { "success": true, "import_id": "...", "property_ids": ["..."], "status": "complete" }

# Get import details
curl http://localhost:4321/api/imports/<import_id>

# Get enriched property
curl http://localhost:4321/api/properties/<property_id>

# List all properties
curl http://localhost:4321/api/properties

# Nearby properties (1km radius around London Bridge)
curl "http://localhost:4321/api/properties/nearby?lat=51.5079&lng=-0.0877&radius_km=1"

# Re-enrich a property
curl -X POST http://localhost:4321/api/properties/<property_id>/re-enrich
```

Or visit `http://localhost:4321/dashboard` for the web UI.

---

## 15. Deployment

### 15.1 Firebase Hosting + Cloud Run (recommended)

Firebase Admin SDK requires a Node.js runtime. Deploy the Astro SSR app to
Cloud Run and optionally front it with Firebase Hosting.

```bash
# Install Firebase CLI
npm install -g firebase-tools
firebase login

# Initialize (select Hosting + set up Cloud Run)
firebase init hosting

# Build the Astro app
npm run build

# Deploy to Cloud Run
gcloud run deploy property-context \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "FIRESTORE_PROJECT_ID=your-project-id"

# Or use firebase.json to proxy Hosting → Cloud Run
```

### 15.2 Standalone Node.js (Railway, Fly.io, etc.)

Since the app uses the Node.js adapter, it can run anywhere Node.js is available.

```bash
# Build
npm run build

# Start
node dist/server/entry.mjs
```

Set all environment variables in your hosting platform's dashboard.

**Railway:**
1. Push code to GitHub
2. Go to [railway.app](https://railway.app) → **New project → Deploy from GitHub**
3. Set environment variables
4. Railway auto-detects Node.js and runs `npm start`

**Fly.io:**
```bash
fly launch
fly secrets set \
  FIRESTORE_PROJECT_ID=your-project-id \
  GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}' \
  SCRAPER_BASE_URL=https://... \
  WALKSCORE_API_KEY=... \
  EPC_API_EMAIL=... \
  EPC_API_KEY=...
fly deploy
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

1. **Create the file** `src/lib/enrichers/<name>.ts`
2. **Implement** the `Enricher` interface from `src/lib/enrichers/types.ts`
3. **Register it** in `src/lib/enrichers/registry.ts` (global or country-specific)

That's it. The inline runner picks it up automatically — no queue, worker, or
route changes needed.

Minimal enricher template:

```typescript
import type { Enricher, EnricherInput, EnricherResult } from './types.js';

export const myEnricher: Enricher = {
  name: 'my_enricher',  // must be unique; used as the enrichment doc ID

  async run(input: EnricherInput): Promise<EnricherResult> {
    const { latitude, longitude, country, postal_code } = input;

    // ... call external API ...
    const apiData = {};

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    return {
      data:    apiData,          // stored as-is in enrichments subcollection
      summary: {},               // merged into property document summary fields
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
