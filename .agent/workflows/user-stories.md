---
description: how to manage and fulfill user stories
---

# User Story Workflow

Use this workflow to ensure that the project evolves according to user needs and that every feature is verified against its "Definition of Done".

## 1. Requirement Gathering
When a new feature is requested:
1. Open `docs/USER_STORIES.md`.
2. Add a new row to the **Future / Backlog** section using the standard format:
   `As a [persona], I want [feature] so that [benefit].`
3. Define at least 3 technical **Acceptance Criteria (AC)** for the story.

## 2. Implementation
When starting work on a story:
1. Move the story to **🟡 In Progress**.
2. Create a feature branch named `feature/story-id` (if using Git).
3. Implement the feature, ensuring all ACs are met.

## 3. Verification & "Putting to Use"
To close a story:
1. Run E2E tests to verify the logic.
2. Update the **🟢 Done** table in `docs/USER_STORIES.md` with:
   - The verified implementation details.
   - The primary file paths involved.
3. If the story adds a new UI element, ensure it's documented in the Lookbook or Admin UI.

## 4. Periodic Audit
Every 2 weeks, review the `docs/USER_STORIES.md` file to:
- Identify "Partial" stories that have stalled.
- Cleanup "Future" stories that are no longer relevant.
- Validate that "Done" stories still function as described.
