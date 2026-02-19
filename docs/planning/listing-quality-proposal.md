# PROPOSAL: Scraping Quality Control & Spam Prevention

## 1. Problem Statement
Current public listings show all scraped data, including "partial" or "failed" extractions, causing the index to appear cluttered with junk/spam. There is also no way for admins to manually curate or delete unwanted entries.

## 2. Confidence & Quality Scoring
We will implement a `ConfidenceScore` (0.0 to 1.0) for every extraction.

### Proposed Weighting
| Component | Weight | Logic |
| :--- | :--- | :--- |
| **Quality Grade** | 50% | A=1.0, B=0.8, C=0.4, F=0.0 |
| **Critical Data** | 30% | Title + Price + (Image or Location) |
| **Spam Check** | 20% | Heuristics on description length, repetition, and domain trust |

### Thresholds
*   **>= 0.70**: High Confidence (Auto-published if from trusted source).
*   **0.40 - 0.69**: Medium Confidence (Pending review).
*   **< 0.40**: Low Confidence (Marked as spam/junk, hidden by default).

## 3. Storage Schema Updates
The KV store for `listing:{id}` will include:
*   `visibility`: `"published" | "pending" | "hidden" | "spam" | "deleted"`
*   `confidence_score`: `number` (0–1)
*   `manual_override`: `boolean` (True if admin intervened)

## 4. Admin Management Features
### New Controls in `/admin/extractions`
*   **Bulk Visibility Actions**: Select multiple and move to `hidden` or `published`.
*   **Delete/Purge**: Permanently remove listings from KV.
*   **Automated Cleanup**: A scheduled task (Cloudflare Cron Trigger) to delete any listing with `visibility: spam` older than 24 hours.

## 5. Public-Facing Changes
*   **Filtered Indexing**: The `listings/index.astro` and `public_api/v1/listings` will only return listings where `visibility == 'published'`.
*   **Fallback Management**: If a user tries to access a `hidden` listing directly by ID, they receive a "Pending Review" or "Access Denied" page instead of the data.

## 6. Implementation Steps
1.  **Refactor `listing-store.ts`**: Update the store method to handle the new metadata.
2.  **Enhance `quality-scorer.ts`**: Add the confidence score calculation logic.
3.  **Update `admin/extractions.astro`**: Add checkboxes and bulk action buttons.
4.  **Create `/admin/api/listings/[id]/visibility` endpoint**: Handle the AJAX requests from the admin UI.
