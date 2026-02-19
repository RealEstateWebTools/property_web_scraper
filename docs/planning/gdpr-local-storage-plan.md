# GDPR-First Local Storage Plan (Main UI)

## Purpose
Enable “smart” client-side persistence in the main UI while staying aligned with GDPR principles: data minimization, purpose limitation, storage limitation, transparency, and user control.

> Note: This is a technical implementation plan, not legal advice. Final wording and lawful-basis choices should be approved by legal/privacy counsel.

## 1) Product Goals

1. Reduce user friction by preserving in-progress extraction work.
2. Keep non-essential persistence opt-in by default.
3. Avoid storing sensitive or unnecessary personal data in browser storage.
4. Provide clear controls to view, export, and delete local data.
5. Keep behavior consistent across UI flows (extract, results, haul, listing views).

## 2) Data Classification (What may be stored)

### A. Strictly Necessary (can persist without marketing consent)
- UI preferences required for usability:
  - theme (`light`/`dark`)
  - language/locale choice
  - compact vs detailed view mode
- Session continuity metadata:
  - last visited app section
  - draft form state for active extraction flow

### B. Functional but Non-Essential (require explicit opt-in)
- Recent extraction history shortcuts (IDs, URLs masked/truncated)
- Draft haul membership lists
- Saved portal filters/search presets

### C. Disallowed in localStorage/sessionStorage
- Full raw HTML payloads (risk + size + potential personal data)
- API keys, admin keys, auth secrets
- Full unredacted addresses tied to user identity profile
- Any data not clearly needed for current UX value

## 3) Consent Model

## Consent categories
- `necessary` (always on, no toggle)
- `functional` (toggle, default off in GDPR regions)

## UX rules
1. Show a consent banner on first load in EEA/UK contexts (or globally for simplicity).
2. Explain exactly what “functional storage” enables.
3. If user declines, app works normally with only strict-necessary storage.
4. No retroactive writes to non-essential keys before consent.

## Consent record
Store a minimal consent record in first-party cookie (preferred) or local storage fallback:
- `version` (policy text version)
- `timestamp`
- `region_mode` (gdpr/non-gdpr)
- `functional` (`granted`/`denied`)

## 4) Storage Architecture

## Key strategy
Use namespaced keys with versioning:
- `pws:v1:consent`
- `pws:v1:ui:theme`
- `pws:v1:ui:extract-draft`
- `pws:v1:ui:recent-items`

## TTL strategy
Every non-essential value should include `expiresAt`.
Recommended defaults:
- extract draft: 24 hours
- recent items: 7 days
- filter presets: 30 days

## Storage wrapper (single entry point)
Create a client utility (`storage-consent.ts`) that:
1. Checks consent category before read/write.
2. Enforces max payload size and key allowlist.
3. Adds TTL metadata.
4. Applies safe serialization/parsing.
5. Supports global `purgeAll()` and `purgeCategory()`.

No component should access browser storage directly.

## 5) GDPR Compliance Controls

## Transparency
- Privacy notice section: “What we store in your browser”.
- Per-key purpose table (key, purpose, retention).

## User rights support
Provide UI actions in settings/privacy panel:
- “Download my local UI data” (JSON)
- “Delete all locally stored UI data”
- “Reset consent choices”

## Minimization + limitation
- Keep only IDs/summary metadata where possible.
- Auto-delete expired keys at app start and after successful flows.

## 6) Security and Abuse Guardrails

1. Never store secrets in browser storage.
2. Validate URLs before persisting to recent history.
3. Strip query params with potential tokens before storing.
4. Apply length limits (e.g., URL max 500 chars in local history).
5. Sanitize rendered values from storage before injecting into UI.

## 7) Implementation Phases

## Phase 0 — Foundation (1–2 days)
- Add storage policy doc and consent category definitions.
- Add shared storage wrapper with allowlist + TTL.
- Add unit tests for consent gating, TTL expiry, and schema version migration.

## Phase 1 — Consent + Settings (2–3 days)
- Build consent banner + preferences modal.
- Add settings/privacy page controls (export/delete/reset).
- Add analytics event hooks for consent changes (anonymized).

## Phase 2 — Smart Persistence (2–4 days)
- Persist extract draft (necessary or functional based on exact payload).
- Persist recent successful extraction IDs (functional only).
- Persist non-sensitive UI preferences.

## Phase 3 — Hardening (1–2 days)
- Add stale-key cleanup job on app bootstrap.
- Add e2e checks for deny/allow flows.
- Add docs for contributors (“do not write directly to localStorage”).

## 8) Acceptance Criteria

1. With functional consent denied, non-essential keys are never written.
2. Expired keys are ignored and purged automatically.
3. User can export/delete/reset local data from UI settings.
4. No secret or raw HTML content appears in browser storage.
5. All storage access routes through wrapper utility.
6. Privacy notice and in-product copy match actual behavior.

## 9) Suggested Copy (MVP)

### Banner title
"Help us remember your workflow"

### Banner text
"We use essential browser storage for core functionality. With your permission, we also store functional preferences and recent extraction shortcuts to speed up your workflow."

### Buttons
- "Allow functional storage"
- "Use essential only"
- "Manage preferences"

## 10) Team Decisions Needed

1. Region strategy: GDPR-only banner vs global banner.
2. Which fields in extract draft are ‘necessary’ vs ‘functional’.
3. Retention windows (24h/7d/30d defaults).
4. Where consent record is stored (cookie-first recommended).
5. Final legal wording for privacy notice and banner text.

## 11) Immediate Next Tasks (ticket-ready)

- Create `astro-app/src/lib/client/storage-consent.ts` wrapper.
- Create `astro-app/src/lib/client/consent-state.ts` manager.
- Add consent banner component in base layout.
- Add privacy/settings page controls for export/delete/reset.
- Add tests for deny path, allow path, and TTL expiry behavior.
