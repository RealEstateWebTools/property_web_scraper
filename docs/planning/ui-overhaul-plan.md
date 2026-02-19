# UI Overhaul Plan (Astro App)

**Project:** PropertyWebScraper (Astro app)  
**Team:** PropertyWebBuilder ecosystem  
**Date:** 2026-02-19  
**Status:** Draft for team review

---

## 1) Why this overhaul

The current UI works functionally but reads as an internal tool in several places, with inconsistent hierarchy, mixed UX patterns across public/admin views, and limited guidance in critical workflows.

Primary goals:
- Make the app look modern and trustworthy
- Reduce user confusion in extraction flows
- Improve clarity of quality/diagnostics messaging
- Create a scalable design system for future features

---

## 2) Current-state audit summary

### High-impact issues observed

1. **Navigation architecture drift risk**
- Base layout duplicates desktop and mobile nav markup in `astro-app/src/layouts/BaseLayout.astro`.
- This increases maintenance burden and drift risk.

2. **Workflow fragmentation in extraction UX**
- Extraction is split across separate pages:
  - `astro-app/src/pages/extract/url.astro`
  - `astro-app/src/pages/extract/html.astro`
  - `astro-app/src/pages/extract/upload.astro`
- These pages share a lot of repeated structure and differ mostly by input mode.

3. **Inconsistent information hierarchy**
- Listing/haul cards can present values without enough label context (grade/rate/price semantics).
- Example surface: `astro-app/src/pages/haul/[id].astro`.

4. **Public vs admin visual mismatch**
- Public surfaces and admin surfaces feel like two separate products.
- Example: `astro-app/src/pages/index.astro` vs `astro-app/src/pages/admin/index.astro`.

5. **Design token underuse**
- Visual styling uses page-level class decisions with minimal global tokens.
- Current global style setup in `astro-app/src/styles/global.css` is very light.

6. **Accessibility hardening needed**
- Some icon-forward interactions and disclosure sections need stronger a11y conventions (`aria-expanded`, label clarity, keyboard/focus consistency).

7. **Tooling leak prevention should be explicit**
- Add explicit policy for non-user-facing dev overlays/toolbars in production.

---

## 3) Overhaul options (decision menu)

## Option A — Clean SaaS Refresh

**Timeline:** 2–3 weeks  
**Risk:** Low  
**Impact:** Medium-high visual polish

### Scope
- Unify spacing/typography/labels
- Improve nav shell and card hierarchy
- Standardize status chips and callouts
- Clarify quality, price, and extraction-rate language

### Pros
- Fast, low disruption
- No major route/model changes

### Cons
- Keeps current IA and flow limitations

### Best for
- Immediate quality uplift before larger roadmap work

---

## Option B — Workflow-First Redesign

**Timeline:** 3–5 weeks  
**Risk:** Medium  
**Impact:** High usability gain

### Scope
- Consolidate extraction into one guided workspace (URL / Paste HTML / Upload)
- Rework result page into summary-first + progressive diagnostics
- Clarify success states (full / partial / blocked / failed)
- Improve next actions (re-extract, export, inspect)

### Pros
- Largest user-experience improvement quickly
- Reduces confusion and support burden

### Cons
- Requires moderate page/component refactor

### Best for
- Product maturity and conversion improvement

---

## Option C — Dashboard Product Upgrade

**Timeline:** 4–7 weeks  
**Risk:** Medium-high  
**Impact:** Very high for team/power users

### Scope
- Option B + richer admin insights
- Portal health trends and quality baselines
- Better haul/listings bulk actions and observability

### Pros
- Strong ops visibility and enterprise-readiness

### Cons
- Larger implementation and QA footprint

### Best for
- Teams operating scraper quality at scale

---

## Option D — Full Replatformed UX/Brand

**Timeline:** 6–10 weeks  
**Risk:** High  
**Impact:** Maximum

### Scope
- Full visual identity refresh
- Full IA rewrite and shell redesign
- Full a11y/performance UX hardening

### Pros
- Transformational product perception

### Cons
- Highest cost and delivery risk

### Best for
- Major relaunch

---

## 4) Recommended direction

**Recommended:** Option B + selected Option C elements

Reason:
- Best balance of outcome vs delivery risk
- Addresses core user confusion now
- Builds a foundation for advanced admin/quality features later

---

## 5) Proposed architecture changes

### 5.1 App shell and navigation

- Refactor base nav into a single source-of-truth link config
- Render desktop/mobile from shared model to avoid duplication drift
- Add active-state consistency and better focus states

### 5.2 Design system layer

Create reusable primitives:
- `AppShell`
- `PageHeader`
- `StatusBadge`
- `MetricCard`
- `InfoCallout`
- `SectionPanel`
- `DataTable`
- `EmptyState`

And define semantic tokens:
- `success`, `warning`, `error`, `info`, `neutral`
- type scale + spacing scale + interaction states

### 5.3 Extraction workflow consolidation

Single page flow:
1. Choose input mode
2. Submit extraction
3. View summary-first result
4. Expand advanced diagnostics only when needed

### 5.4 Result and haul clarity

- Standard card schema:
  - Title
  - Price (formatted)
  - Grade (labeled)
  - Extraction completeness (labeled)
  - Actions
- Add explanatory tooltips/help text for scoring semantics

### 5.5 Accessibility baseline

- Ensure every icon-only action has accessible name
- Add semantic disclosure state (`aria-expanded`)
- Validate keyboard order/focus-visible styles
- Ensure color is never sole status indicator

---

## 6) Screen-level redesign blueprint

### Home (`src/pages/index.astro`)
- One dominant CTA: Paste rendered HTML
- Secondary CTA: URL mode (with lower-accuracy warning)
- concise 3-step process + trust indicators

### Extract workspace (`src/pages/extract/*`)
- Replace three-page split with one mode-switching workspace
- Right-side guidance panel based on selected mode
- Inline portal-specific hints (e.g., JS-heavy warning)

### Results (`src/pages/extract/results/[id].astro`)
- Top: status + quality summary
- Mid: property summary card + actions
- Bottom: diagnostics and metadata as progressive disclosure

### Haul (`src/pages/haul/[id].astro`)
- Header with capacity and expiry clarity
- Better card labels and sorting/filtering
- Bulk actions (export all, show partial/failed first)

### Listings (`src/pages/listings/index.astro`, `src/pages/listings/[id].astro`)
- Better filtering/sorting chips
- Stronger metadata hierarchy
- Consistent action rail and value formatting

### Admin (`src/pages/admin/*`)
- Keep power-functionality
- Normalize visual language with public UI tokens
- Prioritize KPI readability and drill-down patterns

---

## 7) Implementation plan (phased)

## Phase 0 — Alignment (2–3 days)
- Confirm chosen option (A/B/C/D)
- Approve UI principles and token set
- Define acceptance criteria and KPIs

Deliverables:
- Approved scope
- UI principle sheet
- Risk register

## Phase 1 — Foundation (1 week)
- App shell/nav refactor
- Design tokens and shared UI primitives
- Accessibility baseline pass on shell components

Deliverables:
- New shell + shared components
- Tokenized style baseline

## Phase 2 — Core workflow (1 week)
- Unified extraction workspace
- Results page summary-first redesign
- Standardized status language and labels

Deliverables:
- End-to-end extraction UX v2

## Phase 3 — Secondary surfaces (1 week)
- Haul redesign and card consistency
- Listings index/detail modernization
- Improved empty/error states

Deliverables:
- Cohesive public surface

## Phase 4 — Admin and polish (1 week)
- Admin visual harmonization
- Final accessibility and responsive QA
- Docs and design system usage guide

Deliverables:
- Unified public/admin experience
- Final release candidate

---

## 8) Risks and mitigations

1. **Scope creep**
- Mitigation: phase gates and strict acceptance criteria

2. **Visual change without behavior clarity**
- Mitigation: UX copy pass and task-based usability checks

3. **Regression risk in extraction flow**
- Mitigation: route-level testing + fixture-based smoke checks

4. **Inconsistent component adoption**
- Mitigation: enforce shared primitives and deprecate one-off UI blocks

---

## 9) Success metrics (what to track)

Product metrics:
- Time to first successful extraction
- Extraction-to-export conversion rate
- Retry success rate after partial/failed extraction
- Haul completion rate

Quality metrics:
- Reduction in UI-related support questions
- Reduced bounce on extraction pages
- Improved task completion in usability checks

Engineering metrics:
- Fewer duplicated UI blocks
- Shared component adoption rate
- Accessibility issues found per release

---

## 10) Team review checklist

- [ ] Choose target option (A/B/C/D)
- [ ] Approve phase plan and timeline
- [ ] Approve design token direction
- [ ] Approve a11y baseline standards
- [ ] Confirm launch KPI targets
- [ ] Confirm rollout strategy (big bang vs phased)

---

## 11) Suggested immediate next step

Run a 60-minute design review and decide between:
- **Option A** if speed is priority
- **Option B+C** if product usability and long-term maintainability are priority

If approved, convert this document into implementation tickets per phase.
