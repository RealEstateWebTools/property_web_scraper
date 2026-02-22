# property_data_enhancer — Developer Guide

A standalone property enrichment service built with Astro.js and
Firebase/Firestore. Give it the URL of a haul JSON endpoint from
`property_web_scraper` and it fetches the scraped data, enriches each property
with location and market intelligence from external APIs, and stores everything
in Firestore.

Each deployment is configured for a **single country** via the `COUNTRY_CODE`
environment variable. Country-specific enrichers live in their own folder under
`src/lib/countries/<code>/`, making it easy to add support for new markets
without touching existing code.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Prerequisites](#3-prerequisites)
4. [Project Setup](#4-project-setup)
5. [Environment Variables](#5-environment-variables)
6. [Database Setup](#6-database-setup)
7. [Project Structure](#7-project-structure)
8. [Implementation — Firestore Client](#8-implementation--firestore-client)
9. [Implementation — Haul Fetcher](#9-implementation--haul-fetcher)
10. [Implementation — Country Modules & Enrichers](#10-implementation--country-modules--enrichers)
11. [Implementation — Routes](#11-implementation--routes)
12. [Implementation — Frontend Pages](#12-implementation--frontend-pages)
13. [Implementation — Astro Config](#13-implementation--astro-config)
14. [Running Locally](#14-running-locally)
15. [Deployment](#15-deployment)
16. [Enricher API Reference](#16-enricher-api-reference)
17. [Adding a New Country](#17-adding-a-new-country)
18. [Adding a New Enricher](#18-adding-a-new-enricher)

---

## 1. Overview

`property_data_enhancer` is a **standalone** service. Its only external dependency is
a URL that returns haul JSON from `property_web_scraper`. It has no API keys for
the scraper, no shared database, and no code imports from the parent project.

```
You → POST /api/imports { haul_url }
   → fetches JSON from the haul URL
   → stores property snapshots in Firestore
   → runs country-specific enrichers inline
   → returns { import_id, property_ids, status }
```

**Key design decisions:**

- **One country per deployment.** Set `COUNTRY_CODE=GB` (or `US`, `ES`, etc.)
  as an environment variable. The app loads only the enrichers for that country
  plus the global enrichers. Deploy the same codebase to multiple Cloudflare
  URLs with different `COUNTRY_CODE` values to support multiple countries.

- **Inline enrichment.** No job queue or worker process. Enrichers run inside
  the import request via `Promise.allSettled()`.

- **Modular country folders.** Each country is a self-contained folder under
  `src/lib/countries/`. Adding a new country means adding a new folder — no
  changes to existing code.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        property_data_enhancer                         │
│              Astro.js SSR on Cloudflare Pages                   │
│              COUNTRY_CODE=GB (per deployment)                   │
│                                                                 │
│  POST /api/imports { haul_url }                                 │
│       │                                                         │
│       ▼                                                         │
│  ┌──────────┐    HTTP GET    ┌─────────────────────────────┐   │
│  │ Fetcher  │ ─────────────► │  Haul JSON endpoint         │   │
│  │          │ ◄───────────── │  (any property_web_scraper) │   │
│  └──────────┘   JSON         └─────────────────────────────┘   │
│       │                                                         │
│       ▼                                                         │
│  ┌──────────────────────┐                                       │
│  │  Firestore (REST)    │                                       │
│  │  ├── imports          │                                       │
│  │  └── properties       │                                       │
│  │      └── enrichments  │  (subcollection)                     │
│  └──────────────────────┘                                       │
│       │                                                         │
│       ▼                                                         │
│  ┌──────────────────────────────────────┐                       │
│  │  Enrichment runner                   │                       │
│  │  Promise.allSettled([                │                       │
│  │    ...globalEnrichers,   ◄── always  │                       │
│  │    ...countryEnrichers,  ◄── GB only │                       │
│  │  ])                                  │                       │
│  └──────────────────────────────────────┘                       │
│       │                                                         │
│  ┌──────────────────────────────────────┐                       │
│  │  src/lib/countries/                  │                       │
│  │  ├── global/          (all deploys)  │                       │
│  │  │   ├── overpass.ts                 │                       │
│  │  │   └── walkscore.ts               │                       │
│  │  ├── gb/              (GB deploys)   │                       │
│  │  │   ├── epc.ts                     │                       │
│  │  │   ├── flood.ts                   │                       │
│  │  │   └── land-registry.ts           │                       │
│  │  └── us/              (US deploys)   │                       │
│  │      └── ...                         │                       │
│  └──────────────────────────────────────┘                       │
│                                                                 │
│  ┌──────────────────────────────────────┐                       │
│  │  Astro Pages (frontend)              │                       │
│  │  ├── /dashboard                      │                       │
│  │  ├── /properties/:id                 │                       │
│  │  └── /imports/new                    │                       │
│  └──────────────────────────────────────┘                       │
└─────────────────────────────────────────────────────────────────┘
```

**Multi-country deployment example:**

| Cloudflare URL | `COUNTRY_CODE` | Active enrichers |
|---|---|---|
| `property-data-enhancer-gb.pages.dev` | `GB` | overpass, walkscore, epc, flood, land-registry |
| `property-data-enhancer-us.pages.dev` | `US` | overpass, walkscore _(+ future US enrichers)_ |
| `property-data-enhancer-es.pages.dev` | `ES` | overpass, walkscore _(+ future ES enrichers)_ |

---

## 3. Prerequisites

- Node.js ≥ 20
- npm ≥ 10
- A [Firebase](https://firebase.google.com) project with Firestore enabled (free Spark plan is sufficient)
- A Firebase service account JSON key
- A [Walk Score API key](https://www.walkscore.com/professional/api.php) (free, 5 000 calls/day)
- Country-specific API keys (e.g. for GB: an [EPC Register API key](https://epc.opendatacommunities.org/))
- A haul JSON URL from a running `property_web_scraper` instance

---

## 4. Project Setup

### 4.1 Initialise the repository

```bash
npm create astro@latest property_data_enhancer -- --template minimal
cd property_data_enhancer
git init
```

### 4.2 Install dependencies

```bash
# Runtime
npm install astro @astrojs/cloudflare geofire-common

# Dev
npm install -D vitest @types/node wrangler
```

### 4.3 `package.json`

```json
{
  "name": "property_data_enhancer",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "wrangler pages dev dist",
    "deploy": "astro build && wrangler pages deploy dist",
    "test": "vitest run"
  },
  "dependencies": {
    "@astrojs/cloudflare": "^12.0.0",
    "astro": "^5.17.0",
    "geofire-common": "^6.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "vitest": "^2.1.0",
    "wrangler": "^4.0.0"
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

For local development, create `.dev.vars` (Cloudflare convention, equivalent to
`.env`). For production, set these in the Cloudflare Pages dashboard under
**Settings → Environment variables**.

```bash
# ── Country ──────────────────────────────────────────────────────
COUNTRY_CODE=GB                          # which country module to load

# ── Firestore ────────────────────────────────────────────────────
FIRESTORE_PROJECT_ID=your-firebase-project-id
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}
FIRESTORE_COLLECTION_PREFIX=             # optional: prefix for collection names (e.g. "dev_")

# ── Enricher API keys (global) ───────────────────────────────────
WALKSCORE_API_KEY=your_walkscore_key

# ── Enricher API keys (GB-specific) ─────────────────────────────
EPC_API_EMAIL=you@example.com
EPC_API_KEY=your_epc_api_key
```

Each country module declares which environment variables it requires (see
[section 10](#10-implementation--country-modules--enrichers)). Only set the
variables for the country you are deploying.

> **Security:** Never commit `.dev.vars`. Add it to `.gitignore`.

---

## 6. Database Setup

### 6.1 Create a Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project**
2. Enable **Cloud Firestore** (start in test mode or configure rules below)
3. Go to **Project Settings → Service accounts → Generate new private key**
4. Paste the JSON into `GOOGLE_SERVICE_ACCOUNT_JSON`

### 6.2 Firestore collection structure

```
{prefix}imports/
  {import_id}/
    haul_url:         string
    status:           "pending" | "processing" | "complete" | "failed"
    country_code:     string         # the COUNTRY_CODE active at import time
    listing_count:    number
    error:            string | null
    created_at:       number         # Date.now() timestamp
    completed_at:     number | null

{prefix}properties/
  {property_id}/
    import_id:             string
    source_listing_id:     string
    source_url:            string
    country:               string | null
    title:                 string | null
    price_float:           number | null
    price_currency:        string | null
    price_string:          string | null
    latitude:              number | null
    longitude:             number | null
    geohash:               string | null
    address_string:        string | null
    city:                  string | null
    region:                string | null
    postal_code:           string | null
    count_bedrooms:        number | null
    count_bathrooms:       number | null
    constructed_area:      number | null
    plot_area:             number | null
    property_type:         string | null
    features:              string[]
    main_image_url:        string | null
    description:           string | null
    agent_name:            string | null

    # Enrichment summary (denormalized for fast queries)
    walkability_score:     number | null
    transit_score:         number | null
    bike_score:            number | null
    flood_risk:            string | null
    epc_grade:             string | null
    nearby_schools:        number | null
    nearby_transit_stops:  number | null
    nearby_supermarkets:   number | null

    imported_at:           number
    enriched_at:           number | null
    enrichment_status:     "pending" | "partial" | "complete" | "failed"

    # Subcollection
    enrichments/
      {enricher_name}/
        enricher:      string
        status:        "running" | "complete" | "failed"
        data:          map
        error:         string | null
        completed_at:  number | null
        expires_at:    number | null
```

The optional `FIRESTORE_COLLECTION_PREFIX` prepends a string to collection names
(e.g. `dev_imports`, `dev_properties`), useful for isolating dev/staging data.

### 6.3 Firestore security rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

All access is via the service account (REST API with JWT auth), which bypasses
security rules. These rules deny accidental client-side access.

### 6.4 Firestore indexes

Create a composite index for geohash-based nearby queries:

```
Collection: {prefix}properties
Fields:     geohash (ascending), imported_at (descending)
```

---

## 7. Project Structure

```
property_data_enhancer/
├── src/
│   ├── lib/
│   │   ├── firestore/
│   │   │   ├── client.ts            # Singleton (REST-based, CF Workers compatible)
│   │   │   ├── rest-client.ts       # Firestore REST API client
│   │   │   └── types.ts             # FirestoreClient interface
│   │   ├── fetcher/
│   │   │   ├── haul.ts              # fetch haul JSON → ScrapedProperty[]
│   │   │   └── types.ts             # ScrapedProperty interface
│   │   ├── countries/
│   │   │   ├── types.ts             # CountryModule interface
│   │   │   ├── loader.ts            # loads module for COUNTRY_CODE
│   │   │   ├── global/              # enrichers that run for ALL countries
│   │   │   │   ├── overpass.ts
│   │   │   │   └── walkscore.ts
│   │   │   ├── gb/                  # Great Britain
│   │   │   │   ├── index.ts         # exports CountryModule
│   │   │   │   ├── epc.ts
│   │   │   │   ├── flood.ts
│   │   │   │   └── land-registry.ts
│   │   │   └── us/                  # United States (placeholder)
│   │   │       └── index.ts
│   │   ├── enricher/
│   │   │   ├── types.ts             # Enricher interface
│   │   │   └── runner.ts            # inline enrichment runner
│   │   └── services/
│   │       └── api-response.ts      # JSON response helpers
│   ├── pages/
│   │   ├── api/
│   │   │   ├── imports/
│   │   │   │   ├── index.ts         # POST /api/imports
│   │   │   │   └── [id].ts          # GET  /api/imports/:id
│   │   │   └── properties/
│   │   │       ├── index.ts         # GET  /api/properties
│   │   │       ├── nearby.ts        # GET  /api/properties/nearby
│   │   │       ├── [id].ts          # GET  /api/properties/:id
│   │   │       └── [id]/
│   │   │           └── re-enrich.ts # POST /api/properties/:id/re-enrich
│   │   ├── dashboard.astro
│   │   ├── imports/
│   │   │   └── new.astro
│   │   └── properties/
│   │       └── [id].astro
│   └── layouts/
│       └── Base.astro
├── .dev.vars                        # local env vars (not committed)
├── .gitignore
├── astro.config.mjs
├── package.json
├── tsconfig.json
└── wrangler.jsonc
```

---

## 8. Implementation — Firestore Client

The Firestore client uses the REST API directly with JWT auth, making it
compatible with Cloudflare Workers (no Node.js native modules required). This
follows the same pattern as the existing `astro-app` project.

### 8.1 Types

**`src/lib/firestore/types.ts`**

```typescript
export type DocData = Record<string, unknown>;

export interface FirestoreDocumentSnapshot {
  readonly id: string;
  readonly exists: boolean;
  data(): DocData | undefined;
  readonly ref: FirestoreDocumentReference;
}

export interface FirestoreDocumentReference {
  readonly id: string;
  get(): Promise<FirestoreDocumentSnapshot>;
  set(data: DocData): Promise<void>;
  update(data: DocData): Promise<void>;
  delete(): Promise<void>;
}

export interface FirestoreQuerySnapshot {
  readonly docs: FirestoreDocumentSnapshot[];
  readonly empty: boolean;
}

export interface FirestoreQuery {
  where(field: string, op: string, value: unknown): FirestoreQuery;
  get(): Promise<FirestoreQuerySnapshot>;
}

export interface FirestoreCollectionReference extends FirestoreQuery {
  doc(id?: string): FirestoreDocumentReference;
  listDocuments(): Promise<FirestoreDocumentReference[]>;
}

export interface FirestoreClient {
  collection(name: string): FirestoreCollectionReference;
}
```

### 8.2 REST client

**`src/lib/firestore/rest-client.ts`**

A fetch()-based Firestore client that authenticates via a self-signed JWT.
Copy this from the existing `astro-app/src/lib/firestore/rest-client.ts` —
it handles JWT generation, document CRUD, and structured queries using
only Web APIs (no Node.js dependencies).

### 8.3 Singleton

**`src/lib/firestore/client.ts`**

```typescript
import { RestFirestoreClient, parseServiceAccountJson } from './rest-client.js';
import type { FirestoreClient } from './types.js';

let client: FirestoreClient | null = null;

export async function getClient(): Promise<FirestoreClient> {
  if (client) return client;

  const projectId = import.meta.env.FIRESTORE_PROJECT_ID;
  const credsJson = import.meta.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (!projectId || !credsJson) {
    throw new Error(
      '[Firestore] Missing env vars: FIRESTORE_PROJECT_ID and/or GOOGLE_SERVICE_ACCOUNT_JSON. ' +
      'Add them to .dev.vars (local) or Cloudflare Pages environment variables (production).'
    );
  }

  const creds = parseServiceAccountJson(credsJson);
  const restClient = new RestFirestoreClient(creds);
  const health = await restClient.healthCheck();

  if (!health.ok) {
    throw new Error(`[Firestore] Health check failed: ${health.error}`);
  }

  client = restClient;
  return client;
}

export function resetClient(): void {
  client = null;
}

export function getCollectionPrefix(): string {
  return import.meta.env.FIRESTORE_COLLECTION_PREFIX || '';
}
```

---

## 9. Implementation — Haul Fetcher

The only external data source. Given a haul URL, it fetches the JSON and
normalises each scrape into a `ScrapedProperty`.

### 9.1 Types

**`src/lib/fetcher/types.ts`**

```typescript
export interface ScrapedProperty {
  source_listing_id: string;
  source_url:        string;
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
  property_type:     string | null;
  features:          string[];
  main_image_url:    string | null;
  description:       string | null;
  agent_name:        string | null;
  scraped_at:        string | null;
}
```

### 9.2 Haul fetcher

**`src/lib/fetcher/haul.ts`**

Fetches haul JSON from the given URL. No API key needed — haul endpoints are
public. This is the **only** coupling to `property_web_scraper`: the shape of
the JSON response.

```typescript
import type { ScrapedProperty } from './types.js';

interface HaulScrape {
  resultId:          string;
  url:               string;
  title?:            string;
  price_float?:      number;
  currency?:         string;
  price?:            string;
  latitude?:         number;
  longitude?:        number;
  city?:             string;
  country?:          string;
  region?:           string;
  postal_code?:      string;
  count_bedrooms?:   number;
  count_bathrooms?:  number;
  constructed_area?: number;
  plot_area?:        number;
  property_type?:    string;
  main_image_url?:   string;
  features?:         string[];
  description?:      string;
  agent_name?:       string;
  createdAt?:        string;
  [key: string]:     unknown;
}

export async function fetchHaul(haulUrl: string): Promise<ScrapedProperty[]> {
  const res = await fetch(haulUrl);

  if (!res.ok) {
    throw new Error(`Haul fetch failed: ${res.status} ${await res.text()}`);
  }

  const body = await res.json() as {
    success: boolean;
    scrapes?: HaulScrape[];
  };

  if (!body.success || !Array.isArray(body.scrapes)) {
    throw new Error('Unexpected haul response shape — expected { success: true, scrapes: [...] }');
  }

  return body.scrapes.map(normalise);
}

function normalise(s: HaulScrape): ScrapedProperty {
  return {
    source_listing_id: s.resultId,
    source_url:        s.url,
    country:           s.country ?? null,
    title:             s.title ?? null,
    price_float:       s.price_float ?? null,
    price_currency:    s.currency ?? null,
    price_string:      s.price ?? null,
    latitude:          s.latitude ?? null,
    longitude:         s.longitude ?? null,
    address_string:    null,
    city:              s.city ?? null,
    region:            s.region ?? null,
    postal_code:       s.postal_code ?? null,
    count_bedrooms:    s.count_bedrooms ?? null,
    count_bathrooms:   s.count_bathrooms ?? null,
    constructed_area:  s.constructed_area ?? null,
    plot_area:         s.plot_area ?? null,
    property_type:     s.property_type ?? null,
    features:          s.features ?? [],
    main_image_url:    s.main_image_url ?? null,
    description:       s.description ?? null,
    agent_name:        s.agent_name ?? null,
    scraped_at:        s.createdAt ?? null,
  };
}
```

---

## 10. Implementation — Country Modules & Enrichers

### 10.1 Enricher interface

**`src/lib/enricher/types.ts`**

```typescript
export interface EnricherInput {
  property_id:    string;
  latitude:       number;
  longitude:      number;
  country:        string | null;
  postal_code:    string | null;
  city:           string | null;
  address_string: string | null;
}

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
  expiresAt: string;   // ISO 8601
}

export interface Enricher {
  name: string;
  run:  (input: EnricherInput) => Promise<EnricherResult>;
}
```

### 10.2 Country module interface

**`src/lib/countries/types.ts`**

Each country folder exports a `CountryModule` — a self-describing bundle of
enrichers, required env vars, and metadata.

```typescript
import type { Enricher } from '@lib/enricher/types.js';

export interface CountryModule {
  /** ISO 3166-1 alpha-2 code (e.g. 'GB', 'US') */
  code:     string;
  /** Human-readable label (e.g. 'United Kingdom') */
  label:    string;
  /** Enrichers specific to this country */
  enrichers: Enricher[];
  /** Env vars this module requires (validated at startup) */
  requiredEnvVars: string[];
}
```

### 10.3 Country loader

**`src/lib/countries/loader.ts`**

Reads `COUNTRY_CODE` from the environment and dynamically imports the matching
country module. Also loads the global enrichers that run for every country.

```typescript
import type { CountryModule } from './types.js';
import type { Enricher } from '@lib/enricher/types.js';
import { overpassEnricher } from './global/overpass.js';
import { walkscoreEnricher } from './global/walkscore.js';

// Register country modules here.
// Each entry is a lazy import so only the active country is loaded.
const COUNTRY_MODULES: Record<string, () => Promise<CountryModule>> = {
  GB: () => import('./gb/index.js').then((m) => m.default),
  US: () => import('./us/index.js').then((m) => m.default),
  // Add new countries here:
  // ES: () => import('./es/index.js').then((m) => m.default),
};

const GLOBAL_ENRICHERS: Enricher[] = [
  overpassEnricher,
  walkscoreEnricher,
];

let _cached: { country: CountryModule; all: Enricher[] } | null = null;

export async function loadEnrichers(): Promise<{ country: CountryModule; all: Enricher[] }> {
  if (_cached) return _cached;

  const code = (import.meta.env.COUNTRY_CODE || '').toUpperCase();

  if (!code) {
    throw new Error(
      '[Country] COUNTRY_CODE env var is required. ' +
      `Available: ${Object.keys(COUNTRY_MODULES).join(', ')}`
    );
  }

  const loader = COUNTRY_MODULES[code];
  if (!loader) {
    throw new Error(
      `[Country] Unsupported COUNTRY_CODE "${code}". ` +
      `Available: ${Object.keys(COUNTRY_MODULES).join(', ')}`
    );
  }

  const country = await loader();

  // Validate required env vars
  const missing = country.requiredEnvVars.filter(
    (v) => !import.meta.env[v]
  );
  if (missing.length > 0) {
    throw new Error(
      `[Country:${code}] Missing required env vars: ${missing.join(', ')}`
    );
  }

  const all = [...GLOBAL_ENRICHERS, ...country.enrichers];
  _cached = { country, all };
  return _cached;
}

export function getAvailableCountries(): string[] {
  return Object.keys(COUNTRY_MODULES);
}
```

### 10.4 Global enrichers

These enrichers run for **every** country deployment.

**`src/lib/countries/global/overpass.ts`**

Queries OpenStreetMap for nearby POIs. Free, no API key, global coverage.

```typescript
import type { Enricher, EnricherInput, EnricherResult } from '@lib/enricher/types.js';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

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

export const overpassEnricher: Enricher = {
  name: 'overpass',

  async run(input: EnricherInput): Promise<EnricherResult> {
    const { latitude: lat, longitude: lon } = input;
    const radius = 1000;

    const query = `
      [out:json][timeout:25];
      (
        node["amenity"="school"](around:${radius},${lat},${lon});
        node["amenity"="college"](around:${radius},${lat},${lon});
        node["amenity"="university"](around:${radius},${lat},${lon});
        node["public_transport"="stop_position"](around:500,${lat},${lon});
        node["highway"="bus_stop"](around:500,${lat},${lon});
        node["railway"="station"](around:1000,${lat},${lon});
        node["railway"="subway_entrance"](around:1000,${lat},${lon});
        node["shop"="supermarket"](around:${radius},${lat},${lon});
        node["shop"="convenience"](around:500,${lat},${lon});
        node["leisure"="park"](around:${radius},${lat},${lon});
        node["amenity"="hospital"](around:${radius},${lat},${lon});
        node["amenity"="pharmacy"](around:${radius},${lat},${lon});
      );
      out body;
    `;

    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!res.ok) throw new Error(`Overpass error ${res.status}`);
    const body = await res.json() as { elements: Array<{ lat?: number; lon?: number; tags: Record<string, string> }> };

    // Group elements by category
    const counts = { schools: 0, transit: 0, supermarkets: 0 };
    for (const el of body.elements) {
      if (!el.lat || !el.lon) continue;
      if (['school', 'college', 'university'].includes(el.tags.amenity)) counts.schools++;
      else if (el.tags.public_transport || el.tags.highway === 'bus_stop' || el.tags.railway) counts.transit++;
      else if (['supermarket', 'convenience'].includes(el.tags.shop)) counts.supermarkets++;
    }

    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

    return {
      data: { query_radius_m: radius, element_count: body.elements.length, ...counts },
      summary: {
        nearby_schools:       counts.schools,
        nearby_transit_stops: counts.transit,
        nearby_supermarkets:  counts.supermarkets,
      },
      expiresAt,
    };
  },
};
```

**`src/lib/countries/global/walkscore.ts`**

```typescript
import type { Enricher, EnricherInput, EnricherResult } from '@lib/enricher/types.js';

export const walkscoreEnricher: Enricher = {
  name: 'walkscore',

  async run(input: EnricherInput): Promise<EnricherResult> {
    const apiKey = import.meta.env.WALKSCORE_API_KEY ?? '';
    if (!apiKey) throw new Error('WALKSCORE_API_KEY not set');

    const { latitude: lat, longitude: lon, address_string } = input;
    const address = encodeURIComponent(address_string ?? `${lat},${lon}`);

    const url = `https://api.walkscore.com/score?format=json&address=${address}&lat=${lat}&lon=${lon}&transit=1&bike=1&wsapikey=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Walk Score error ${res.status}`);

    const body = await res.json() as {
      status: number;
      walkscore: number;
      transit?: { score: number };
      bike?: { score: number };
    };
    if (body.status !== 1) throw new Error(`Walk Score status ${body.status}`);

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    return {
      data: { walkscore: body.walkscore, transit_score: body.transit?.score ?? null, bike_score: body.bike?.score ?? null },
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

### 10.5 GB country module

**`src/lib/countries/gb/index.ts`**

```typescript
import type { CountryModule } from '../types.js';
import { epcEnricher } from './epc.js';
import { floodEnricher } from './flood.js';
import { landRegistryEnricher } from './land-registry.js';

const gb: CountryModule = {
  code:  'GB',
  label: 'United Kingdom',
  enrichers: [
    epcEnricher,
    floodEnricher,
    landRegistryEnricher,
  ],
  requiredEnvVars: [
    'EPC_API_EMAIL',
    'EPC_API_KEY',
  ],
};

export default gb;
```

**`src/lib/countries/gb/epc.ts`**

```typescript
import type { Enricher, EnricherInput, EnricherResult } from '@lib/enricher/types.js';

export const epcEnricher: Enricher = {
  name: 'epc_uk',

  async run(input: EnricherInput): Promise<EnricherResult> {
    const email = import.meta.env.EPC_API_EMAIL ?? '';
    const key   = import.meta.env.EPC_API_KEY   ?? '';
    if (!email || !key) throw new Error('EPC_API_EMAIL / EPC_API_KEY not set');
    if (!input.postal_code) throw new Error('No postal_code — skipping EPC lookup');

    const postcode = input.postal_code.replace(/\s+/g, '+');
    const url = `https://epc.opendatacommunities.org/api/v1/domestic/search?postcode=${postcode}&size=1`;
    const auth = btoa(`${email}:${key}`);

    const res = await fetch(url, {
      headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`EPC API error ${res.status}`);

    const body = await res.json() as { rows: Array<Record<string, string>> };
    const row = body.rows[0];
    if (!row) throw new Error('No EPC certificate found for postcode');

    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    return {
      data: {
        current_energy_rating:     row['current-energy-rating'],
        potential_energy_rating:   row['potential-energy-rating'],
        current_energy_efficiency: Number(row['current-energy-efficiency']),
        property_type:             row['property-type'],
        inspection_date:           row['inspection-date'],
      },
      summary: { epc_grade: row['current-energy-rating'] ?? undefined },
      expiresAt,
    };
  },
};
```

**`src/lib/countries/gb/flood.ts`**

```typescript
import type { Enricher, EnricherInput, EnricherResult } from '@lib/enricher/types.js';

const EA_BASE = 'https://environment.data.gov.uk/arcgis/rest/services/EA';

async function queryFloodZone(lat: number, lon: number, zone: 2 | 3): Promise<boolean> {
  const service = zone === 3
    ? 'FloodMapForPlanningRiversAndSeaFloodZone3/MapServer/0'
    : 'FloodMapForPlanningRiversAndSeaFloodZone2/MapServer/0';

  const params = new URLSearchParams({
    geometry: `${lon},${lat}`, geometryType: 'esriGeometryPoint',
    inSR: '4326', spatialRel: 'esriSpatialRelIntersects',
    outFields: '*', returnGeometry: 'false', f: 'json',
  });

  const res = await fetch(`${EA_BASE}/${service}/query?${params}`);
  if (!res.ok) throw new Error(`EA flood API error ${res.status}`);
  const body = await res.json() as { features: unknown[] };
  return body.features.length > 0;
}

export const floodEnricher: Enricher = {
  name: 'flood_uk',

  async run(input: EnricherInput): Promise<EnricherResult> {
    const [inZone3, inZone2] = await Promise.all([
      queryFloodZone(input.latitude, input.longitude, 3),
      queryFloodZone(input.latitude, input.longitude, 2),
    ]);

    const risk = inZone3 ? 'high' : inZone2 ? 'medium' : 'low';
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    return {
      data: { in_flood_zone_3: inZone3, in_flood_zone_2: inZone2, flood_risk: risk },
      summary: { flood_risk: risk },
      expiresAt,
    };
  },
};
```

**`src/lib/countries/gb/land-registry.ts`**

```typescript
import type { Enricher, EnricherInput, EnricherResult } from '@lib/enricher/types.js';

const LR_BASE = 'https://landregistry.data.gov.uk/data/ppi';

export const landRegistryEnricher: Enricher = {
  name: 'land_registry_uk',

  async run(input: EnricherInput): Promise<EnricherResult> {
    if (!input.postal_code) throw new Error('No postal_code for Land Registry lookup');

    const postcode = input.postal_code.replace(/\s+/g, '');
    const url = `${LR_BASE}/transaction-record.json?propertyAddress.postcode=${postcode}&_pageSize=20&_sort=-transactionDate`;

    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Land Registry error ${res.status}`);

    const body = await res.json() as { result: { items: Array<{ pricePaid: number; transactionDate: string; propertyType?: { prefLabel: string }; newBuild: boolean }> } };
    const items = body.result?.items ?? [];

    const prices = items.map((t) => t.pricePaid).filter(Boolean);
    const avg = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null;

    const transactions = items.slice(0, 10).map((t) => ({
      date: t.transactionDate,
      price: t.pricePaid,
      property_type: t.propertyType?.prefLabel ?? null,
      new_build: t.newBuild,
    }));

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    return {
      data: { postcode, transaction_count: items.length, avg_sold_price: avg, transactions },
      summary: {},
      expiresAt,
    };
  },
};
```

### 10.6 US country module (placeholder)

**`src/lib/countries/us/index.ts`**

```typescript
import type { CountryModule } from '../types.js';

const us: CountryModule = {
  code:  'US',
  label: 'United States',
  enrichers: [
    // Add US-specific enrichers here as they are built:
    // zillowEnricher,
    // femaFloodEnricher,
  ],
  requiredEnvVars: [],
};

export default us;
```

### 10.7 Enrichment runner

**`src/lib/enricher/runner.ts`**

Runs all enrichers (global + country) for a single property.

```typescript
import { getClient, getCollectionPrefix } from '@lib/firestore/client.js';
import { loadEnrichers } from '@lib/countries/loader.js';
import type { EnricherInput } from './types.js';

export async function runEnrichment(input: EnricherInput): Promise<void> {
  const db = await getClient();
  const prefix = getCollectionPrefix();
  const { all: enrichers } = await loadEnrichers();

  if (enrichers.length === 0) return;

  const propertyRef = db.collection(`${prefix}properties`).doc(input.property_id);

  const results = await Promise.allSettled(
    enrichers.map(async (enricher) => {
      // Mark as running
      await propertyRef.collection('enrichments').doc(enricher.name).set({
        enricher: enricher.name,
        status:   'running',
        created_at: Date.now(),
      });

      try {
        const result = await enricher.run(input);

        await propertyRef.collection('enrichments').doc(enricher.name).set({
          enricher:     enricher.name,
          status:       'complete',
          data:         result.data,
          completed_at: Date.now(),
          expires_at:   new Date(result.expiresAt).getTime(),
        });

        if (Object.keys(result.summary).length > 0) {
          await propertyRef.update({
            ...result.summary,
            enriched_at: Date.now(),
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
          completed_at: Date.now(),
        });

        return { enricher: enricher.name, status: 'failed' as const };
      }
    }),
  );

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

---

## 11. Implementation — Routes

### 11.1 Response helpers

**`src/lib/services/api-response.ts`**

```typescript
export function successResponse(data: Record<string, unknown>, statusCode = 200): Response {
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
import { getClient, getCollectionPrefix } from '@lib/firestore/client.js';
import { fetchHaul } from '@lib/fetcher/haul.js';
import { runEnrichment } from '@lib/enricher/runner.js';
import { loadEnrichers } from '@lib/countries/loader.js';
import { successResponse, errorResponse } from '@lib/services/api-response.js';
import { geohashForLocation } from 'geofire-common';

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json() as { haul_url?: string };
  const haulUrl = body.haul_url?.trim();

  if (!haulUrl) {
    return errorResponse('haul_url is required', 400);
  }

  const db = await getClient();
  const prefix = getCollectionPrefix();
  const { country } = await loadEnrichers();

  // Fetch haul JSON
  let properties;
  try {
    properties = await fetchHaul(haulUrl);
  } catch (err) {
    return errorResponse(String(err), 422);
  }

  // Create import record
  const importRef = db.collection(`${prefix}imports`).doc();
  const importId = importRef.id;

  await importRef.set({
    haul_url:      haulUrl,
    status:        'processing',
    country_code:  country.code,
    listing_count: properties.length,
    error:         null,
    created_at:    Date.now(),
    completed_at:  null,
  });

  // Insert properties and run enrichment
  const propertyIds: string[] = [];

  for (const prop of properties) {
    const propertyRef = db.collection(`${prefix}properties`).doc();
    const propertyId = propertyRef.id;

    const geohash = (prop.latitude && prop.longitude)
      ? geohashForLocation([prop.latitude, prop.longitude])
      : null;

    await propertyRef.set({
      import_id:          importId,
      source_listing_id:  prop.source_listing_id,
      source_url:         prop.source_url,
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
      property_type:      prop.property_type,
      features:           prop.features,
      main_image_url:     prop.main_image_url,
      description:        prop.description,
      agent_name:         prop.agent_name,
      scraped_at:         prop.scraped_at,
      imported_at:        Date.now(),
      enriched_at:        null,
      enrichment_status:  (prop.latitude && prop.longitude) ? 'pending' : 'failed',
    });

    propertyIds.push(propertyId);

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

  await importRef.update({ status: 'complete', completed_at: Date.now() });

  return successResponse({
    import_id:     importId,
    country_code:  country.code,
    listing_count: properties.length,
    property_ids:  propertyIds,
    status:        'complete',
  }, 201);
};
```

**`src/pages/api/imports/[id].ts`** — `GET /api/imports/:id`

```typescript
import type { APIRoute } from 'astro';
import { getClient, getCollectionPrefix } from '@lib/firestore/client.js';
import { successResponse, errorResponse } from '@lib/services/api-response.js';

export const GET: APIRoute = async ({ params }) => {
  const db = await getClient();
  const prefix = getCollectionPrefix();

  const doc = await db.collection(`${prefix}imports`).doc(params.id!).get();
  if (!doc.exists) return errorResponse('Import not found', 404);

  const propsSnap = await db.collection(`${prefix}properties`)
    .where('import_id', '==', doc.id)
    .get();
  const properties = propsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return successResponse({ id: doc.id, ...doc.data(), properties });
};
```

### 11.3 Properties routes

**`src/pages/api/properties/index.ts`** — `GET /api/properties`

```typescript
import type { APIRoute } from 'astro';
import { getClient, getCollectionPrefix } from '@lib/firestore/client.js';
import { successResponse } from '@lib/services/api-response.js';

export const GET: APIRoute = async ({ url }) => {
  const db     = await getClient();
  const prefix = getCollectionPrefix();
  const limit  = Math.min(Number(url.searchParams.get('limit') ?? 50), 200);

  const snap = await db.collection(`${prefix}properties`).get();
  const properties = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .slice(0, limit);

  return successResponse({ properties, limit });
};
```

**`src/pages/api/properties/[id].ts`** — `GET /api/properties/:id`

```typescript
import type { APIRoute } from 'astro';
import { getClient, getCollectionPrefix } from '@lib/firestore/client.js';
import { successResponse, errorResponse } from '@lib/services/api-response.js';

export const GET: APIRoute = async ({ params }) => {
  const db     = await getClient();
  const prefix = getCollectionPrefix();

  const doc = await db.collection(`${prefix}properties`).doc(params.id!).get();
  if (!doc.exists) return errorResponse('Property not found', 404);

  const enrichSnap = await doc.ref.collection('enrichments').get();
  const enrichments = enrichSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return successResponse({ id: doc.id, ...doc.data(), enrichments });
};
```

**`src/pages/api/properties/[id]/re-enrich.ts`** — `POST /api/properties/:id/re-enrich`

```typescript
import type { APIRoute } from 'astro';
import { getClient, getCollectionPrefix } from '@lib/firestore/client.js';
import { runEnrichment } from '@lib/enricher/runner.js';
import { successResponse, errorResponse } from '@lib/services/api-response.js';

export const POST: APIRoute = async ({ params }) => {
  const db     = await getClient();
  const prefix = getCollectionPrefix();

  const doc = await db.collection(`${prefix}properties`).doc(params.id!).get();
  if (!doc.exists) return errorResponse('Property not found', 404);

  const prop = doc.data()!;
  if (!prop.latitude || !prop.longitude) {
    return errorResponse('Property has no coordinates — cannot enrich', 422);
  }

  // Delete existing enrichments
  const enrichSnap = await doc.ref.collection('enrichments').get();
  for (const d of enrichSnap.docs) await d.ref.delete();

  await doc.ref.update({ enrichment_status: 'pending', enriched_at: null });

  await runEnrichment({
    property_id:    doc.id,
    latitude:       prop.latitude as number,
    longitude:      prop.longitude as number,
    country:        (prop.country as string) ?? null,
    postal_code:    (prop.postal_code as string) ?? null,
    city:           (prop.city as string) ?? null,
    address_string: (prop.address_string as string) ?? null,
  });

  return successResponse({ message: 'Re-enrichment complete', property_id: doc.id });
};
```

**`src/pages/api/properties/nearby.ts`** — `GET /api/properties/nearby`

```typescript
import type { APIRoute } from 'astro';
import { getClient, getCollectionPrefix } from '@lib/firestore/client.js';
import { geohashQueryBounds, distanceBetween } from 'geofire-common';
import { successResponse, errorResponse } from '@lib/services/api-response.js';

export const GET: APIRoute = async ({ url }) => {
  const lat      = Number(url.searchParams.get('lat'));
  const lng      = Number(url.searchParams.get('lng'));
  const radiusKm = Number(url.searchParams.get('radius_km') ?? 1);
  const limit    = Math.min(Number(url.searchParams.get('limit') ?? 20), 100);

  if (!lat || !lng) return errorResponse('lat and lng are required', 400);

  const db     = await getClient();
  const prefix = getCollectionPrefix();
  const center: [number, number] = [lat, lng];
  const radiusM = radiusKm * 1000;
  const bounds = geohashQueryBounds(center, radiusM);

  const snapshots = await Promise.all(
    bounds.map(([start, end]) =>
      db.collection(`${prefix}properties`)
        .where('geohash', '>=', start)
        .where('geohash', '<=', end)
        .get(),
    ),
  );

  const properties: Array<Record<string, unknown>> = [];
  for (const snap of snapshots) {
    for (const doc of snap.docs) {
      const data = doc.data();
      if (!data.latitude || !data.longitude) continue;
      const distKm = distanceBetween([data.latitude as number, data.longitude as number], center);
      if (distKm <= radiusKm) {
        properties.push({ id: doc.id, ...data, distance_m: Math.round(distKm * 1000) });
      }
    }
  }

  properties.sort((a, b) => (a.distance_m as number) - (b.distance_m as number));

  return successResponse({ properties: properties.slice(0, limit), radius_km: radiusKm });
};
```

---

## 12. Implementation — Frontend Pages

### 12.1 Base layout

**`src/layouts/Base.astro`**

```astro
---
interface Props { title: string }
const { title } = Astro.props;
---
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{title} — property_data_enhancer</title>
</head>
<body>
  <nav>
    <a href="/dashboard">Dashboard</a>
    <a href="/imports/new">New Import</a>
  </nav>
  <main><slot /></main>
</body>
</html>
```

### 12.2 Dashboard

**`src/pages/dashboard.astro`**

```astro
---
import Base from '../layouts/Base.astro';
import { getClient, getCollectionPrefix } from '@lib/firestore/client.js';
import { loadEnrichers } from '@lib/countries/loader.js';

const db = await getClient();
const prefix = getCollectionPrefix();
const { country } = await loadEnrichers();

const importsSnap = await db.collection(`${prefix}imports`).get();
const imports = importsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

const propsSnap = await db.collection(`${prefix}properties`).get();
const properties = propsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
---
<Base title="Dashboard">
  <h1>property_data_enhancer — {country.label} ({country.code})</h1>

  <h2>Recent Imports ({imports.length})</h2>
  <ul>
    {imports.map(imp => (
      <li>{imp.haul_url} — {imp.status} — {imp.listing_count} listings</li>
    ))}
  </ul>

  <h2>Properties ({properties.length})</h2>
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
import { getClient, getCollectionPrefix } from '@lib/firestore/client.js';

const { id } = Astro.params;
const db = await getClient();
const prefix = getCollectionPrefix();

const doc = await db.collection(`${prefix}properties`).doc(id!).get();
if (!doc.exists) return Astro.redirect('/dashboard');

const prop = { id: doc.id, ...doc.data() } as Record<string, any>;
const enrichSnap = await doc.ref.collection('enrichments').get();
const enrichments = enrichSnap.docs.map(d => ({ id: d.id, ...d.data() }));
---
<Base title={prop.title ?? 'Property'}>
  <h1>{prop.title ?? 'Untitled Property'}</h1>
  <p>{prop.city}, {prop.country} — {prop.price_string ?? 'N/A'}</p>
  <p>Enrichment: {prop.enrichment_status}</p>

  <h2>Scores</h2>
  <ul>
    <li>Walk: {prop.walkability_score ?? '—'} | Transit: {prop.transit_score ?? '—'} | Bike: {prop.bike_score ?? '—'}</li>
    <li>Flood: {prop.flood_risk ?? '—'} | EPC: {prop.epc_grade ?? '—'}</li>
    <li>Schools: {prop.nearby_schools ?? '—'} | Transit stops: {prop.nearby_transit_stops ?? '—'}</li>
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
  <h1>Import from Haul</h1>
  <form id="import-form">
    <label for="haul_url">Haul JSON URL:</label>
    <input type="url" id="haul_url" name="haul_url" required
      placeholder="https://scraper.example.com/ext/v1/hauls/haul_abc123" />
    <button type="submit">Import & Enrich</button>
  </form>
  <pre id="result"></pre>

  <script>
    const form = document.getElementById('import-form') as HTMLFormElement;
    const result = document.getElementById('result')!;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      result.textContent = 'Importing & enriching...';

      const haulUrl = new FormData(form).get('haul_url') as string;
      const res = await fetch('/api/imports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ haul_url: haulUrl }),
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
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
});
```

**`wrangler.jsonc`**

```jsonc
{
  "name": "property_data_enhancer",
  "compatibility_date": "2026-02-01",
  "compatibility_flags": ["nodejs_compat"],
  "pages_build_output_dir": "dist"
}
```

---

## 14. Running Locally

```bash
npm run dev
```

Test the import flow:

```bash
# Import a haul
curl -X POST http://localhost:4321/api/imports \
  -H 'Content-Type: application/json' \
  -d '{"haul_url":"https://your-scraper.com/ext/v1/hauls/haul_abc123"}'

# Response:
# { "success": true, "import_id": "...", "country_code": "GB", "property_ids": [...], "status": "complete" }

# Get import details
curl http://localhost:4321/api/imports/<import_id>

# Get enriched property
curl http://localhost:4321/api/properties/<property_id>

# List all properties
curl http://localhost:4321/api/properties

# Nearby properties
curl "http://localhost:4321/api/properties/nearby?lat=51.5079&lng=-0.0877&radius_km=1"

# Re-enrich
curl -X POST http://localhost:4321/api/properties/<property_id>/re-enrich
```

Or visit `http://localhost:4321/dashboard`.

---

## 15. Deployment

### 15.1 Cloudflare Pages (recommended)

Each country gets its own Cloudflare Pages project, all deployed from the same
repository. The only difference is the environment variables.

```bash
# Build and deploy
npm run deploy
```

Or connect the GitHub repository to Cloudflare Pages:

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages → Create**
2. Connect your GitHub repo
3. Build command: `npm run build`
4. Output directory: `dist`
5. Set environment variables:

| Variable | GB deployment | US deployment |
|---|---|---|
| `COUNTRY_CODE` | `GB` | `US` |
| `FIRESTORE_PROJECT_ID` | `my-project` | `my-project` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | `{...}` | `{...}` |
| `WALKSCORE_API_KEY` | `abc123` | `abc123` |
| `EPC_API_EMAIL` | `me@example.com` | _(not needed)_ |
| `EPC_API_KEY` | `xyz789` | _(not needed)_ |
| `FIRESTORE_COLLECTION_PREFIX` | `gb_` | `us_` |

Using `FIRESTORE_COLLECTION_PREFIX` keeps each country's data in separate
Firestore collections (`gb_properties`, `us_properties`, etc.) within the same
Firebase project.

### 15.2 Multiple deployments from one repo

With Cloudflare Pages, you can create multiple projects pointing at the same
repo. Each project has its own URL and environment variables:

| Project name | URL | `COUNTRY_CODE` |
|---|---|---|
| `property-data-enhancer-gb` | `property-data-enhancer-gb.pages.dev` | `GB` |
| `property-data-enhancer-us` | `property-data-enhancer-us.pages.dev` | `US` |
| `property-data-enhancer-es` | `property-data-enhancer-es.pages.dev` | `ES` |

---

## 16. Enricher API Reference

### Overpass (OpenStreetMap) — global

| Detail | Value |
|--------|-------|
| API | `https://overpass-api.de/api/interpreter` |
| Auth | None |
| Rate limit | ~1 req/s recommended |
| TTL | 90 days |

### Walk Score — global

| Detail | Value |
|--------|-------|
| API | `https://api.walkscore.com/score` |
| Auth | API key in query string |
| Rate limit | 5 000 calls/day (free) |
| TTL | 30 days |

### UK EPC Register — `countries/gb/`

| Detail | Value |
|--------|-------|
| API | `https://epc.opendatacommunities.org/api/v1/domestic/search` |
| Auth | Basic auth (email + key) |
| TTL | 1 year |

### UK Flood Risk — `countries/gb/`

| Detail | Value |
|--------|-------|
| API | Environment Agency ArcGIS REST services |
| Auth | None |
| TTL | 1 year |

### UK Land Registry — `countries/gb/`

| Detail | Value |
|--------|-------|
| API | `https://landregistry.data.gov.uk/data/ppi/transaction-record.json` |
| Auth | None |
| TTL | 30 days |

---

## 17. Adding a New Country

1. Create a folder: `src/lib/countries/<code>/`

2. Create `index.ts` exporting a `CountryModule`:

```typescript
import type { CountryModule } from '../types.js';

const xx: CountryModule = {
  code:  'XX',
  label: 'Country Name',
  enrichers: [],
  requiredEnvVars: [],
};

export default xx;
```

3. Register it in `src/lib/countries/loader.ts`:

```typescript
const COUNTRY_MODULES: Record<string, () => Promise<CountryModule>> = {
  GB: () => import('./gb/index.js').then((m) => m.default),
  US: () => import('./us/index.js').then((m) => m.default),
  XX: () => import('./xx/index.js').then((m) => m.default),  // ← add
};
```

4. Deploy with `COUNTRY_CODE=XX`.

No other files need to change. The loader, runner, routes, and frontend all
work automatically with the new country.

---

## 18. Adding a New Enricher

1. Create the enricher file in the appropriate country folder (or `global/`
   for all countries):

```typescript
// src/lib/countries/gb/my-enricher.ts
import type { Enricher, EnricherInput, EnricherResult } from '@lib/enricher/types.js';

export const myEnricher: Enricher = {
  name: 'my_enricher',

  async run(input: EnricherInput): Promise<EnricherResult> {
    // ... call external API ...
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    return { data: {}, summary: {}, expiresAt };
  },
};
```

2. Add it to the country's `index.ts`:

```typescript
import { myEnricher } from './my-enricher.js';

const gb: CountryModule = {
  // ...
  enrichers: [epcEnricher, floodEnricher, landRegistryEnricher, myEnricher],
  // ...
};
```

3. If the enricher needs an API key, add it to `requiredEnvVars`:

```typescript
requiredEnvVars: ['EPC_API_EMAIL', 'EPC_API_KEY', 'MY_API_KEY'],
```

The runner picks it up automatically. No route or config changes needed.
