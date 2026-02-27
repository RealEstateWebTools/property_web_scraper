# Removing Google Maps Dependency (Astro App)

This document defines the migration strategy and rollout path for removing Google Maps as a runtime dependency in the active Astro app.

## Scope

Applies to:
- `astro-app` (primary app)

Out of scope (legacy/history):
- `app/assets/.../google_map_controller.js` (legacy Rails surface)
- archived fixtures and docs snapshots that contain third-party page HTML

## Why this migration

- Remove runtime coupling to Google Maps JS SDK
- Eliminate map API key management in Astro runtime
- Reduce privacy/compliance surface (no map SDK injection)
- Keep location utility through external provider links

## Strategy

### 1) Remove runtime SDK usage
- Delete dynamic Google Maps script loading from listing detail page
- Remove inline map container that depends on `GOOGLE_MAPS_API_KEY`

### 2) Replace with provider-neutral UX
- Keep location section visible when coordinates exist
- Provide external map links:
  - OpenStreetMap directions (primary)
  - Generic external map app link (Google Maps search URL as plain external destination)

### 3) Remove config references
- Remove `GOOGLE_MAPS_API_KEY` from:
  - `astro-app/.env`
  - `astro-app/.env.example`
  - `astro-app/src/lib/services/env-validator.ts`
  - `astro-app/README.md`

### 4) Keep legacy isolated
- Rails-era map controller may remain until legacy Rails cleanup is explicitly scheduled.
- It is not used by Astro routes.

## Completed changes

- `astro-app/src/pages/listings/[id].astro`
  - Removed Google Maps API key usage
  - Removed Google Maps script bootstrap in inline script
  - Replaced embedded map with external location links
- `astro-app/src/lib/services/env-validator.ts`
  - Removed `GOOGLE_MAPS_API_KEY` from environment status inventory
- `astro-app/.env`
  - Removed `GOOGLE_MAPS_API_KEY`
- `astro-app/.env.example`
  - Removed `GOOGLE_MAPS_API_KEY`
- `astro-app/README.md`
  - Removed map key from environment table
- `docs/archive/QUICK_WINS_CHECKLIST.md` (archived)
  - Removed env-validator example warning about missing maps key

## Rollout plan

### Phase A (now)
- Remove active dependency and config references in Astro
- Verify listing page renders and location links appear for geo-coded listings

### Phase B (optional)
- Add optional self-hosted Leaflet/OpenStreetMap embed (no paid provider dependency)
- Gate behind explicit feature flag if embedded map returns

### Phase C (legacy cleanup)
- If legacy Rails components are officially retired, remove `google_map_controller.js` and related assets

## Validation checklist

- [ ] `npm run build` succeeds in `astro-app`
- [ ] Listing page works without `GOOGLE_MAPS_API_KEY`
- [ ] Location section displays external links when `latitude/longitude` exist
- [ ] No user-facing docs instruct setting Google Maps key for Astro app

## Notes

- Archived fixtures may still contain Google Maps markup inside third-party source HTML. This is expected and not a runtime dependency.
