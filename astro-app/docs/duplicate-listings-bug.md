# Duplicate Listings in Admin Extractions — Root Cause Analysis

**Status:** Active production bug
**Affected page:** `/admin/extractions`
**Symptom:** Multiple rows for the same property URL (observed: 4× for `168908774`, 2× for `172085585`)

---

## How the data flow works (summary)

```
Chrome extension / web UI / API
        │
        ▼
scrape-handler.ts
  1. findExistingScrapeByUrl()  — haul-level dedup (this haul only)
  2. getListingByUrl()           — cross-app dedup (in-memory urlIndex → KV)
  3. runExtraction()
        │
        ▼
extraction-runner.ts
  • getListingByUrl()  — same check, again
  • generateStableId(url) → 12-char SHA-256 hex
  • storeListing(id, listing) → memory + KV
  • listing.save()  → Firestore (async, awaited but error-swallowed)
```

```
Admin page load (/admin/extractions)
        │
        ▼
getRecentExtractions()
  Tier 1: Listing.collectionRef().get()  ← direct Firestore query
  Tier 2: getAllListings()
              └─ Listing.collectionRef().get()  ← SECOND Firestore query
              └─ in-memory store entries not already seen
  Dedup: by document ID only (seenIds Set)
  Sort: by timestamp descending
  Return: slice(0, limit)
```

---

## Root causes (in order of likelihood)

### Cause 1 — Multiple Firestore documents with different IDs for the same URL *(primary)*

`getRecentExtractions()` deduplicates only by **Firestore document ID** (`seenIds`). It has no URL-level deduplication. If Firestore holds more than one document that maps to the same property URL, every one of them appears as a separate row.

**How multiple docs get created:**

#### 1a. Historical dynamic IDs (most likely cause of existing duplicates)
The stable-ID scheme (`generateStableId(url)`) may not have been in place for all earlier extractions. Any listing stored before stable IDs were introduced used `generateId()` — a timestamp + counter value that is **unique per call**. Those old documents are still in Firestore with their original dynamic IDs. A later extraction of the same URL creates a *second* document under the new stable ID. Both survive indefinitely.

`getRecentExtractions()` returns all of them.

#### 1b. Cloudflare KV eventual consistency (concurrent requests)
Cloudflare KV is **eventually consistent**. Writes may take seconds to minutes to become visible across Worker isolates. Two or more concurrent requests for the same URL can each fail the `getListingByUrl()` KV check simultaneously (the first request's write is not yet visible), each call `generateStableId(url)` → identical stable ID, and each call `listing.save()` with `this.id = stableId`.

Because `listing.save()` calls `col.doc(this.id).set(data)`, **each concurrent save writes to the same Firestore document** (overwrite semantics). This path should NOT produce multiple Firestore docs — but during the inconsistency window, in-memory state and Firestore can temporarily show the listing at different stages, and the admin page may briefly show two entries sourced from those two tiers.

#### 1c. URL canonicalization gap — trailing slash
`deduplicationKey()` preserves trailing slashes:

```typescript
// url-canonicalizer.ts
return parsed.hostname.toLowerCase() + parsed.pathname;
// "www.rightmove.co.uk/properties/168908774"   → stable ID A
// "www.rightmove.co.uk/properties/168908774/"  → stable ID B  ← different!
```

If the same property is submitted with and without a trailing slash across different sessions, two different stable IDs are produced, creating two independent Firestore documents.

---

### Cause 2 — `getRecentExtractions` makes two Firestore queries *(architectural redundancy)*

```typescript
// extraction-stats.ts — getRecentExtractions()

// Query 1: direct
const snapshot = await Listing.collectionRef().get();
for (const doc of snapshot.docs) { ... seenIds.add(doc.id); }

// Query 2: via getAllListings() which ALSO calls collectionRef().get()
const listings = await getAllListings();
```

Every page load of `/admin/extractions` hits Firestore **twice** for the same collection. The `seenIds` set prevents most duplicates: a doc found in Query 1 has its ID in `seenIds`, so when the same doc appears again from `getAllListings()`, it is skipped.

**However**, this dedup relies on both queries returning consistent snapshots. Under concurrent Firestore writes this is not guaranteed. A document written between Query 1 and Query 2 will not be in `seenIds` (missed by Query 1) but will appear in Query 2's result — correct behaviour. Conversely, a document deleted between queries will appear in `seenIds` but not in the listings results — also handled. The double-query pattern is wasteful and fragile.

---

### Cause 3 — `listing.id` not restored on KV rehydration *(latent, does not currently cause duplicates but is error-prone)*

`rehydrateListing()` calls `listing.assignAttributes(data)`, which only sets fields declared in `_attributeDefinitions`. The `id` field is defined on `BaseModel` as a plain class property — **not in `_attributeDefinitions`** — so it is not restored when loading from KV JSON.

```typescript
function rehydrateListing(data: Record<string, unknown>): Listing {
  const listing = new Listing();   // listing.id === ''
  listing.assignAttributes(data);  // 'id' skipped — not in _attributeDefinitions
  return listing;                  // listing.id still ''
}
```

The bug is masked in `extraction-runner.ts` because `listing.id = resultId` is explicitly set before `listing.save()`. But any code that calls `save()` on a KV-rehydrated listing *without* first setting `listing.id` would call `col.doc()` with no argument — auto-generating a new Firestore document ID and creating a duplicate.

---

### Cause 4 — `getListingByUrl` does not check Firestore

The cross-application dedup check in `scrape-handler.ts` and `extraction-runner.ts` queries:

1. In-memory `urlIndex` (empty in every new Worker isolate)
2. KV at key `listing:{stableId}` (correct, but only if KV was populated)

**It never queries Firestore.** If a listing exists in Firestore but not in KV (e.g., KV entry expired after 24 h, or the original write predated the stable-ID scheme), `getListingByUrl()` returns `undefined` and a new extraction runs. The new listing is saved to Firestore under its own stable ID — or, for historical dynamic-ID listings, under a *different* stable ID — adding a new document alongside the old one.

---

### Cause 5 — `listing.save()` errors are silently swallowed

```typescript
// extraction-runner.ts
try { await listing.save(); } catch (err) {
  logActivity({ level: 'error', ... });  // logged, but execution continues
}
```

If the Firestore write fails, the listing exists only in KV. The admin page's Tier 1 Firestore query misses it. The `getAllListings()` in-memory fallback also misses it (different Worker isolate = fresh memory). The listing becomes invisible in the admin page until the next successful Firestore write — or appears and disappears depending on which isolate handles the request.

---

## What the fix should be

The cleanest solution is to add URL-level deduplication to `getRecentExtractions()` as a **last-mile safety net** after all summaries are collected from both Firestore and in-memory:

```typescript
// After collecting all summaries from Firestore + in-memory:
const seenUrls = new Map<string, ExtractionSummary>(); // canonical URL → most-recent
for (const s of summaries) {
  const key = deduplicationKey(s.sourceUrl);
  if (!key) continue;
  const existing = seenUrls.get(key);
  if (!existing || s.timestamp > existing.timestamp) {
    seenUrls.set(key, s);
  }
}
return Array.from(seenUrls.values())
  .sort((a, b) => b.timestamp - a.timestamp)
  .slice(0, limit);
```

This ensures the admin page shows at most one row per canonical URL regardless of how many Firestore documents exist for it, without requiring a Firestore migration or data cleanup.

The secondary fixes are:
- Remove the redundant Tier 1 Firestore query in `getRecentExtractions()` (let `getAllListings()` do the only Firestore read)
- Restore `id` from KV data in `rehydrateListing()` or via a dedicated path
- Strip trailing slashes in `deduplicationKey()` (or in portal config `stripTrailingSlash`)

---

## Impact on tests

The following existing test must be updated because it asserts the old "skip listings without diagnostics" behaviour that was **intentionally removed** when the requirement changed to "show everything":

```
astro-app/test/lib/extraction-stats.test.ts
  → "skips listings without diagnostics"  — now FAILS (expected 0, gets 1)
```

New tests covering the duplicate scenarios are in:
```
astro-app/test/lib/admin-extractions-dedup.test.ts
```
