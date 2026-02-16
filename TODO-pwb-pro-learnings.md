# Implementation Plan: Applying pwb-pro-be Learnings

Learnings from the `pwb-pro-be` Ruby on Rails project applied to the `property_web_scraper` Astro app.

## Current State

The Astro app has 18 scraper mappings, 14 HTML fixtures, and 4 extraction strategies:
- `cssLocator` — CSS selectors via Cheerio
- `scriptRegEx` — regex on concatenated `<script>` tag text
- `urlPathPart` — URL path segment extraction
- `flightDataPath` — Next.js RSC flight data (`self.__next_f.push`)
- `scriptJsonPath` + `scriptJsonVar` — named JSON variables in script tags (e.g. `window.PAGE_MODEL`)

Recently added: `rightmove_v2` scraper using `scriptJsonPath` for `window.PAGE_MODEL`.

---

## TODO 1: Add `__NEXT_DATA__` Strategy Support

**Priority: High** | **Effort: Small**

Many modern portals use Next.js `<script id="__NEXT_DATA__">` tags containing a JSON blob with all page data. The current `scriptJsonVar` strategy won't find this because it looks for `window.VAR = {...}` assignment syntax, not `<script id="...">` content.

### Portals that use `__NEXT_DATA__`:
- **Zoopla** — `props.pageProps.listingDetails.*`
- **OnTheMarket** — `props.pageProps.property.*` or `props.initialReduxState.property.*`
- **Daft.ie** — `props.pageProps.*`

### Changes needed:

**File: `astro-app/src/lib/extractor/strategies.ts`**
- [ ] Add `getOrParseNextData($)` function that finds `<script id="__NEXT_DATA__">` and parses its JSON content
- [ ] Cache result in a WeakMap keyed by Cheerio instance (same pattern as `scriptJsonCache`)
- [ ] When `scriptJsonVar` is `"__NEXT_DATA__"`, use this new function instead of the regex-based `getOrParseScriptJson`

Alternatively (simpler approach):
- [ ] In `getOrParseScriptJson`, add a fallback: if the regex doesn't find `window.VAR = {...}`, also check for `<script id="VAR">` or `<script id="__NEXT_DATA__" type="application/json">` and parse its innerHTML as JSON

**File: `astro-app/src/lib/extractor/mapping-loader.ts`**
- No changes needed — `scriptJsonVar` and `scriptJsonPath` already exist

**File: `astro-app/test/lib/strategies.test.ts`**
- [ ] Add test: `scriptJsonPath` with `__NEXT_DATA__` script tag (not window assignment)

---

## TODO 2: Add Zoopla v2 Scraper

**Priority: High** | **Effort: Medium**

The current Zoopla mapping uses CSS selectors which are fragile. Modern Zoopla uses Next.js with `__NEXT_DATA__`. The pwb-pro-be `zoopla_pasarela.rb` reveals the complete data structure.

### Data paths (from pwb-pro-be):
| Field | Path in `__NEXT_DATA__` |
|-------|------------------------|
| latitude | `props.pageProps.listingDetails.location.coordinates.latitude` |
| longitude | `props.pageProps.listingDetails.location.coordinates.longitude` |
| postal_code | `props.pageProps.listingDetails.location.postalCode` |
| count_bedrooms | `props.pageProps.listingDetails.counts.numBedrooms` |
| count_bathrooms | `props.pageProps.listingDetails.counts.numBathrooms` |
| price_float | `props.pageProps.listingDetails.adTargeting.priceActual` |
| price_string | `props.pageProps.listingDetails.pricing.label` |
| constructed_area | `props.pageProps.listingDetails.floorArea.value` |
| address_string | `props.pageProps.listingDetails.adTargeting.displayAddress` |
| title | CSS `<title>` tag |
| images | `props.pageProps.listingDetails.propertyImage[].filename` with prefix `https://lid.zoocdn.com/1024/768/` |
| features | `props.pageProps.listingDetails.features.bullets[]` |

### Steps:
- [ ] Implement TODO 1 first (`__NEXT_DATA__` support)
- [ ] Capture fixture: Use Claude-in-Chrome to navigate to a Zoopla listing and save DOM
- [ ] Create `config/scraper_mappings/zoopla_v2.json` using `scriptJsonVar: "__NEXT_DATA__"` paths
- [ ] Register in `mappings-bundle.ts`
- [ ] Add manifest entry in `manifest.ts`
- [ ] Update `LOCAL_HOST_MAP` in `url-validator.ts` to point to `zoopla_v2`
- [ ] Update `HOSTNAME_MAP` in `capture-fixture.ts`
- [ ] Run tests

---

## TODO 3: Add OnTheMarket Scraper

**Priority: Medium** | **Effort: Medium**

OnTheMarket also uses `__NEXT_DATA__`. From pwb-pro-be:

### Data paths:
| Field | Path |
|-------|------|
| property data | `props.pageProps.property` or `props.initialReduxState.property` |
| coordinates | within property object |

### Steps:
- [ ] Depends on TODO 1 (`__NEXT_DATA__` support)
- [ ] Capture fixture from onthemarket.com listing
- [ ] Inspect `__NEXT_DATA__` to map exact field paths
- [ ] Create `config/scraper_mappings/onthemarket.json`
- [ ] Register in `mappings-bundle.ts`
- [ ] Add to `LOCAL_HOST_MAP` and `HOSTNAME_MAP`
- [ ] Add manifest entry
- [ ] Run tests

---

## TODO 4: Add Daft.ie Scraper

**Priority: Medium** | **Effort: Medium**

Irish property portal. Uses `__NEXT_DATA__` per pwb-pro-be.

### Steps:
- [ ] Depends on TODO 1 (`__NEXT_DATA__` support)
- [ ] Capture fixture from daft.ie listing
- [ ] Inspect `__NEXT_DATA__` to map field paths
- [ ] Create `config/scraper_mappings/daft.json`
- [ ] Register in `mappings-bundle.ts`
- [ ] Add to `LOCAL_HOST_MAP` and `HOSTNAME_MAP`
- [ ] Add manifest entry
- [ ] Run tests

---

## TODO 5: Add JSON-LD Extraction Strategy

**Priority: Medium** | **Effort: Small**

Many real estate sites embed structured data as `<script type="application/ld+json">` with Schema.org `RealEstateListing` or `Product` types. The pwb-pro-be project uses this for C21NW and it's a reliable data source.

### Changes needed:

**File: `astro-app/src/lib/extractor/strategies.ts`**
- [ ] Add `getOrParseJsonLd($)` function that finds all `<script type="application/ld+json">` tags
- [ ] Parse each as JSON, filter for relevant `@type` values (`RealEstateListing`, `Product`, `Residence`, `SingleFamilyResidence`, `Apartment`)
- [ ] Cache per Cheerio instance

**File: `astro-app/src/lib/extractor/mapping-loader.ts`**
- [ ] Add `jsonLdPath?: string` to `FieldMapping` — dot-path into the JSON-LD object
- [ ] Add `jsonLdType?: string` to `FieldMapping` — optional filter by `@type`

**File: `astro-app/test/lib/strategies.test.ts`**
- [ ] Add tests for JSON-LD extraction with various `@type` values

**File: `.claude/skills/add-scraper/reference.md`**
- [ ] Document `jsonLdPath` and `jsonLdType` strategy

---

## TODO 6: Modernize Idealista Scraper

**Priority: Low** | **Effort: Medium**

The current Idealista mapping (`idealista.json`) uses the 2018 site structure. The pwb-pro-be project shows that modern Idealista uses `window.__INITIAL_STATE__` in script tags.

The existing `scriptJsonVar` strategy should already handle this — just set `scriptJsonVar: "__INITIAL_STATE__"`.

### Steps:
- [ ] Capture fresh fixture from idealista.com (requires handling anti-bot — may need browser)
- [ ] Create `config/scraper_mappings/idealista_v2.json` using `scriptJsonVar: "__INITIAL_STATE__"`
- [ ] Map fields from `__INITIAL_STATE__` structure (needs inspection of live page)
- [ ] Register in `mappings-bundle.ts`
- [ ] Add manifest entry
- [ ] Run tests

---

## TODO 7: Enrich rightmove_v2 with Additional Fields

**Priority: Low** | **Effort: Small**

The pwb-pro-be `rightmove_pasarela.rb` extracts many fields we don't yet capture.

### Additional fields available in `PAGE_MODEL`:
- [ ] `tenure` — `propertyData.tenure.tenureType`
- [ ] `features` — `propertyData.keyFeatures` (array of strings)
- [ ] `year_construction` — possibly in `propertyData`
- [ ] `constructed_area` — `propertyData.sizings[0].value` (with unit from `propertyData.sizings[0].unit`)
- [ ] `epc_rating` — `propertyData.epc.currentRating` (new field)
- [ ] Additional images — `propertyData.images[].url` with `https://media.rightmove.co.uk/` prefix

### Steps:
- [ ] Add `features` extractor config to `rightmove_v2.json`
- [ ] Add `constructed_area` to floatFields using `scriptJsonPath`
- [ ] Add remaining fields
- [ ] Update fixture if needed to include the data
- [ ] Update manifest expected values
- [ ] Run tests

---

## TODO 8: Add Fixtures for Scrapers Without Them

**Priority: Low** | **Effort: Medium**

Four scrapers currently have no HTML fixtures (fixture: null in manifest):
- `cerdfw`
- `carusoimmobiliare`
- `forsalebyowner`
- `weebrix`

### Steps (for each):
- [ ] Attempt to capture fixture using `npm run capture-fixture -- <url>`
- [ ] If site blocks simple fetching, use Claude-in-Chrome to capture DOM
- [ ] Add manifest expected values
- [ ] Run tests

---

## TODO 9: Document New Strategies in Reference

**Priority: Medium** | **Effort: Small**

The `reference.md` skill file needs updating with the new strategies added in the flight data / scriptJson work and any future strategies.

### File: `.claude/skills/add-scraper/reference.md`
- [ ] Add `flightDataPath` strategy documentation with examples
- [ ] Add `scriptJsonVar` + `scriptJsonPath` strategy documentation with examples
- [ ] Add section on choosing the right strategy for different site architectures:
  - Classic server-rendered HTML → `cssLocator`
  - `window.VAR = {...}` pattern → `scriptJsonVar` + `scriptJsonPath`
  - Next.js with `__NEXT_DATA__` → `scriptJsonVar: "__NEXT_DATA__"` + `scriptJsonPath`
  - Next.js RSC with `__next_f.push` → `flightDataPath`
  - Schema.org structured data → `jsonLdPath` (after TODO 5)

---

## Implementation Order

Recommended sequence based on dependencies and impact:

1. **TODO 1** — `__NEXT_DATA__` support (unblocks TODO 2, 3, 4)
2. **TODO 2** — Zoopla v2 (high-value UK portal)
3. **TODO 9** — Document strategies (quick win, helps future work)
4. **TODO 5** — JSON-LD strategy (broadly useful)
5. **TODO 3** — OnTheMarket (UK portal)
6. **TODO 4** — Daft.ie (Irish portal)
7. **TODO 7** — Enrich rightmove_v2 (incremental improvement)
8. **TODO 6** — Idealista v2 (complex due to anti-bot)
9. **TODO 8** — Missing fixtures (cleanup)
