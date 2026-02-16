# Scraper Maintenance Guide

How to diagnose and fix broken scraper mappings in the extraction engine.

## How the Extraction Pipeline Works

The extraction engine (`html-extractor.ts`) processes field sections in a
**strict, fixed order**. Each section overwrites any field set by a prior section
if the same field name appears in both:

```
1. defaultValues   ->  propertyHash[key] = fieldMapping.value  (always a string)
2. images          ->  image URL arrays
3. features        ->  feature string arrays
4. intFields       ->  parseInt(text, 10) || 0
5. floatFields     ->  parseFloat(text) || 0  (with optional stripPunct, stripFirstChar)
6. textFields      ->  text.trim()  (a string)
7. booleanFields   ->  evaluator function  (returns true/false)
```

**Key implication**: if `count_bedrooms` appears in both `intFields` and
`textFields`, the textFields version wins because it runs later. The value
becomes a string instead of an integer.

### Text Retrieval (`strategies.ts`)

`retrieveTargetText()` tries strategies in order — the last one that produces
a result wins:

| Strategy | Dispatches to | What it does |
|---|---|---|
| `scriptRegEx` | regex on `$('script').text()` | Regex match against concatenated script tag text |
| `urlPathPart` | `getTextFromUrl()` | Extract a segment from the URL path |
| `cssLocator` | `getTextFromCss()` | CSS selector via Cheerio |

### CSS Selector Behaviour (`getTextFromCss`)

- **Without `cssCountId`**: calls `elements.text()` which **concatenates text of
  ALL matched elements** into one string. This is the most common source of bugs.
- **With `cssCountId`**: picks the element at that index via `.eq(idx)`.
- **With `cssAttr` / `xmlAttr`**: returns the attribute value of the first match.

### Post-processing (`cleanUpString`)

Runs after text retrieval, before type coercion:

1. `splitTextCharacter` + `splitTextArrayId` -- split string, pick element at index
2. `stripString` -- remove first occurrence of exact substring

Note: `stripString` runs **after** split, so it operates on the already-split
fragment, not the full original string.

### Type Coercion (in `html-extractor.ts`)

For `floatFields`, after `retrieveTargetText` + `cleanUpString`:

1. `stripPunct` removes all `.` and `,` characters
2. `stripFirstChar` trims whitespace then removes the first character
3. `parseFloat(text.trim()) || 0`

For `intFields`: `parseInt(text.trim(), 10) || 0`

For `textFields`: `text.trim()`

---

## Diagnosing a Broken Scraper

### Step 1: Run the validation tests

```bash
cd astro-app
npx vitest run test/lib/scraper-validation.test.ts
```

Failed assertions show: `expected <actual> to deeply equal <expected>`.

To run a single scraper:

```bash
npx vitest run test/lib/scraper-validation.test.ts -t "zoopla"
```

### Step 2: Inspect the HTML fixture

Open `astro-app/test/fixtures/SCRAPER.html` and search for the DOM elements
the mapping is trying to target. Browser DevTools or `grep` both work.

### Step 3: Compare selector to actual DOM

The most common failure modes:

| Symptom | Likely cause |
|---|---|
| Field returns `0` or empty string | CSS selector doesn't match any element |
| Field returns concatenated garbage | Selector matches multiple elements, no `cssCountId` |
| Field is wrong type (string vs int) | Field defined in two sections, last one wins |
| `splitTextCharacter` produces wrong result | Cheerio normalizes `<br>` to `\n`, not `\r` |
| `scriptRegEx` returns empty | Pattern doesn't match any script tag content |
| `stripString` doesn't strip enough | It only removes one exact substring occurrence |

### Step 4: Fix the mapping JSON

Edit `config/scraper_mappings/SCRAPER.json`. Only change the specific fields
that are broken. Refer to the post-processing options table in `DESIGN.md`
for the full list of available keys.

### Step 5: Update expected values

Edit `astro-app/test/fixtures/manifest.ts`. Add or update the fields you
fixed in the scraper's `expected` object.

### Step 6: Re-run tests

```bash
npx vitest run test/lib/scraper-validation.test.ts -t "SCRAPER"
npx vitest run  # full suite, check for regressions
```

---

## Fixes Applied (Feb 2026)

The initial validation test run revealed 6 broken scrapers out of 16. All fixes
were JSON mapping changes only -- no extraction engine code was modified.

### realtor -- duplicate field definition

**Problem**: `count_bedrooms` was defined in both `intFields` and `textFields`.
The intFields selector correctly extracted integer `3`, but textFields ran later
and overwrote it with string `"3"`.

**Root cause**: Copy-paste during mapping creation left the field in two sections.

**Fix**: Removed `count_bedrooms` from `textFields`. The `intFields` definition
at `#ldp-property-meta li[data-label='property-meta-beds']` is the correct one.

**Lesson**: Always check that a field name appears in exactly one section. If the
same field appears in multiple sections, the last one wins by processing order.

### pisos -- CSS selector matches multiple elements

**Problem**: The `price_string` selector `.jsPrecioH1` matched 3 `<span>` elements
in the fixture (desktop price, tablet duplicate, and a different listing's price).
Without `cssCountId`, Cheerio concatenated all three: `"990.000 EUR990.000 EUR1.250.000 EUR"`.

**Root cause**: The selector was too broad and the mapping didn't specify which
element to pick.

**Fix**: Added `"cssCountId": "0"` to select only the first match.

**Lesson**: Whenever a CSS selector might match more than one element, always add
`cssCountId` to pick a specific one. Check fixtures for duplicate elements that
appear in responsive/mobile variants of the page.

### fotocasa -- copy-pasted from idealista with wrong selectors

**Problem**: The mapping was a verbatim copy of the idealista mapping. Some fields
worked by coincidence (fotocasa shared some CSS IDs with idealista), but:

- `price_float` used an idealista-specific deep `nth-child` path that didn't exist
- `reference` used a `scriptRegEx` for `propertyId:` that wasn't in any script tag

**Root cause**: New scraper created by duplicating an existing one without updating
all selectors.

**Fix**:
- `price_float`: Changed selector to `#priceContainer` (the actual element in
  fotocasa's HTML), kept `stripPunct` to handle `1.330.000`.
- `reference`: Changed from broken `scriptRegEx` to CSS `input#hid_PropertyId`
  with `cssAttr: "value"`, which extracts the property ID from a hidden form input.
- `latitude`/`longitude`: Left the (non-matching) scriptRegEx in place. The fixture
  has no lat/lon data at all, so these correctly extract `0`.

**Lesson**: When creating a new scraper by copying an existing one, systematically
verify every single selector against the new site's HTML. Fields that "seem to work"
might only work by coincidence.

### zoopla -- brittle nth-child selectors

**Problem**: CSS selectors used deeply-nested `nth-child` paths that depended on
exact DOM structure:
- `price_float` / `price_string`: `#listing-details > div:nth-child(1) > div > strong`
  didn't match because the actual price was at `.listing-details-price > strong`.
- `count_bedrooms`: Used an idealista selector that doesn't exist in zoopla at all.

Additionally, the price `<strong>` tag contains both the price and a per-sqft
annotation: `£875,000 (£397/sq. ft)`. The original split on space (`" "`) failed
because Cheerio's text output has leading whitespace -- splitting `"  £875,000 ..."`
on space gives empty string at index 0.

**Fix**:
- Changed selectors to class-based: `.listing-details-price > strong`, `span.num-beds`
- Changed `splitTextCharacter` from `" "` to `"("` so index 0 gives `"£875,000 "`
  which trims cleanly.

**Lesson**: Prefer class-based or ID-based selectors over `nth-child` chains.
The `nth-child` approach breaks whenever any sibling element is added or reordered.
When splitting text, be aware that Cheerio may produce leading/trailing whitespace
in multi-line elements.

### wyomingmls -- wrong selector path + split character mismatch

**Problem**: Three compounding issues:

1. **Selector missed target**: `#content > div:nth-child(2)` targeted `<div class="badge">`
   (the 2nd child div) instead of `<div class="propertymain">` (the 3rd child). CSS
   `div:nth-child(2)` means "the 2nd child element IF it's a div", which was the badge
   div containing no `<p>` elements.

2. **Split character mismatch**: The mapping used `splitTextCharacter: "\r"` but
   Cheerio converts `<br />` tags to `\n`. The text of the paragraph was
   `"MLS: 20176813\nPrice: $33,500\nType: Mobile/Manufactured"`. Splitting on `\r`
   matched nothing, so the full concatenated text was used and parseInt/parseFloat
   returned 0.

3. **Insufficient stripString**: After fixing the split, index 1 gives
   `"Price: $33,500"`. The existing `stripString: "$"` only removed the `$`, leaving
   the `"Price: "` prefix which caused `parseFloat` to return NaN (coerced to 0).

**Fix**:
- Changed selector to `.propertymain .left p` (class-based, robust)
- Changed `splitTextCharacter` from `"\r"` to `"\n"`
- Updated `stripString` for `price_float` to `"Price: $"`, for `price_string` to
  `"Price: "`, and added `stripString: "MLS: "` to `reference`

**Lesson**: Cheerio always normalizes `<br>` to `\n`, never `\r`. When text contains
labelled fields like `"Price: $33,500"`, the `stripString` must remove the full
prefix including the label, not just the currency symbol. Debug by tracing the exact
string through each processing step: retrieve -> split -> strip -> coerce.

### realestateindia -- entire mapping was for wrong website

**Problem**: The entire mapping was an exact copy of the idealista mapping. Every
selector was designed for idealista.es. The defaults were wrong too: `country: "Spain"`,
`currency: "EUR"`, `locale_code: "es"` for an Indian property portal.

The fixture HTML has a completely different structure with classes like `h1.xxxlarge`
for the title and `span.red` for the price.

**Fix**: Complete rewrite:
- Defaults: `country: "India"`, `currency: "INR"`, `area_unit: "sqyd"`, `locale_code: "en"`
- `title`: `h1.xxxlarge` with `cssCountId: "0"` (multiple elements have this class)
- `price_float`: `span.red` with `cssCountId: "0"` and `stripPunct`
- `price_string`: `span.red` with `cssCountId: "0"`
- `for_rent` / `for_sale`: boolean evaluators on the title text (contains "Rent")
- Removed fields with no clean selectors (reference, bedrooms, bathrooms)
- `latitude` / `longitude`: empty mappings (no data in fixture), extract as 0

**Lesson**: When a mapping is a wholesale copy of another site, it needs a full
audit. Spot-checking one or two fields is not enough -- every selector must be
verified against the actual HTML.

---

## Common Pitfalls Reference

| Pitfall | Details |
|---|---|
| Field in multiple sections | Last section wins. intFields + textFields = string. |
| Missing `cssCountId` | Cheerio concatenates ALL matched element texts. |
| `<br>` handling | Cheerio converts `<br>` to `\n`, never `\r`. |
| `defaultValues` types | Always produces strings, even `"true"` / `"false"`. |
| Processing order | defaults -> images -> features -> int -> float -> text -> boolean |
| `splitTextCharacter` with whitespace | Cheerio may add leading newlines/spaces in multi-line elements. Split on space can produce empty first elements. |
| `stripString` scope | Runs after split, operates on the split fragment only. Removes first occurrence only. |
| `stripPunct` scope | Only removes `.` and `,`. Does not remove currency symbols or other punctuation. |
| `parseFloat` / `parseInt` fallback | Returns `0` on NaN, not an error. Silent data loss. |
| Copy-pasted mappings | Must verify every selector, not just a few. Fields may "work" by coincidence. |
