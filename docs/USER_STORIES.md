# User Stories & Feature Tracking

This document maps user stories to technical implementation status. Use this to prioritize work and verify that business requirements are met.

## 🟢 Done / Implemented

### 🛡️ Administrative Curation
| User Story | Implementation | Files |
| :--- | :--- | :--- |
| **Curation Dashboard**: As an admin, I want to monitor extractions with confidence scores so I can delete spam. | **Dashboard Table**: Admin view with confidence bars and delete buttons. | `admin/extractions.astro`, `api/listings.ts` |
| **Manual Overrides**: As a moderator, I want to manually change a listing’s status to correct automated scoring. | **Visibility Toggle**: POST endpoint to update status with `manual_override` protection. | `listing-store.ts`, `api/listings.ts` |
| **Override Protection**: As an admin, I want curated statuses to be "locked" from automated re-updates. | **Override Logic**: Logic in the retriever checks for the `manual_override` flag. | `listing-retriever.ts`, `listing.ts` |

### 🏠 Direct User (Frictionless Extraction)
| User Story | Implementation | Files |
| :--- | :--- | :--- |
| **HTML Extraction**: As a user, I want to paste page source to bypass standard URL blocking. | **HTML Paste UI**: Multi-line paste area with post-extraction redirect. | `extract/html.astro`, `extraction-runner.ts` |
| **Result Persistence**: As a returning visitor, I want to see a history of my recent property hauls. | **Local History**: LocalStorage-backed history list. | `storage-consent.ts`, `haul-store.ts` |
| **Visual Validation**: As a user, I want to see a core summary (image/price) to verify extraction. | **Results Header**: Summary card showing main image, price, and bed/bath counts. | `extract/results/[id].astro` |

### 📦 Haul Management
| User Story | Implementation | Files |
| :--- | :--- | :--- |
| **Bulk Export**: As a user, I want to export my haul as CSV/JSON/GeoJSON for use in spreadsheets or GIS tools. | **Export Endpoint + UI**: `GET /ext/v1/hauls/:id/export?format=csv\|json\|geojson` with dropdown on haul page. | `haul-export-adapter.ts`, `export.ts`, `haul/[id].astro` |
| **Haul Summary**: As a user, I want to see aggregate stats (price range, avg price, grades, sources) at a glance. | **Summary Card**: Computed from enriched scrape data, shown above the scrape grid. | `haul-summary.ts`, `haul/[id].astro` |
| **Comparison Table**: As a user, I want to compare properties side-by-side in a table with beds/baths/area/city. | **Table View**: Sortable table view toggled from grid/table/map segmented control. | `haul/[id].astro` |
| **Map View**: As a user, I want to see my scraped properties on a map. | **Leaflet Map**: Lazy-loaded map with markers and popups, auto-fit bounds. | `haul/[id].astro` |
| **Remove Scrape**: As a user, I want to remove bad scrapes from a haul. | **Delete Endpoint + UI**: `DELETE /ext/v1/hauls/:id/scrapes/:resultId` with confirm-to-remove trash icon. | `scrapes/[resultId].ts`, `haul-store.ts`, `haul/[id].astro` |
| **Name & Notes**: As a user, I want to name my haul and add notes so I can remember its purpose. | **PATCH Endpoint + UI**: Inline editable title and collapsible notes textarea. | `hauls/[id].ts`, `haul-store.ts`, `haul/[id].astro` |
| **My Hauls List**: As a returning user, I want to find my previous hauls without bookmarking URLs. | **My Hauls Page**: Client-rendered page reading from localStorage, linked in nav. | `hauls.astro`, `storage-consent.ts`, `nav-data.ts` |
| **Enriched Scrape Data**: As a system, I want haul scrapes to store comparison-useful fields so data survives the 1-hour listing TTL. | **Enriched HaulScrape**: 17 optional fields populated at scrape-add time. | `haul-store.ts`, `scrapes.ts` |

### ⚖️ Privacy & Compliance
| User Story | Implementation | Files |
| :--- | :--- | :--- |
| **Consent Control**: As a user, I want to choose whether the site stores my history. | **GDPR Banner**: Consent manager with Necessary vs. Functional storage. | `ConsentBanner.astro`, `storage-consent.ts` |
| **Right to be Forgotten**: As a user, I want a "Delete All My Data" button. | **Privacy Tools**: "Clear All" button in settings/privacy page. | `privacy.astro` |

---

## 🟡 In Progress / Partial

### 🛠️ Developer & API
| User Story | Status | Tech Goal |
| :--- | :--- | :--- |
| **Quality Grading**: As an API consumer, I want A-F grades and confidence scores in the JSON. | **Partial**: Scoring exists; need to ensure it's in all PWB format responses. | `quality-scorer.ts`, `public_api/v1/listings.ts` |
| **Diagnostic Tools**: As a dev, I want to view "Field Traces" to debug scraper failures. | **Partial**: Logic exists in diagnostics; need a dedicated "Dev Mode" UI panel. | `html-extractor.ts`, `extract/results/[id].astro` |

---

## 🔴 Future / Backlog

### 🛠️ Advanced Operations
| User Story | Priority | Target Milestone |
| :--- | :--- | :--- |
| **Real-time Alerts**: As a platform owner, I want a webhook notification when extraction completes. | High | Phase 5 |
| **Site Health**: As a reliability engineer, I want a public health dashboard for all portals. | Medium | Phase 5 |

### 🧩 Browser Integration
| User Story | Priority | Target Milestone |
| :--- | :--- | :--- |
| **Instant Capture**: One-click capture via Chrome Extension. | High | Extension V2 |
| **Background Sync**: Sync extension results to the web dashboard account. | Low | User Accounts |

## How to use this document
1. **Adding Features**: Create a new User Story here *first* to define the "Definition of Done".
2. **Reviewing Code**: Ensure every pull request maps back to at least one ID'd requirement here.
3. **Auditing Quality**: Check the "Implementation" column periodically to ensure logic hasn't regressed.
