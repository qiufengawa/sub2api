# R51 Batch Image Acceptance

## Scope

- Route: `/batch-image` with `/docs/batch-image` alias retained.
- View: authenticated batch image job workspace.
- Shared contracts: page header, server table workspace, toolbar, filters, compact controls, data table, bulk actions, dialogs, confirmation, upload, image preview, status badges, metrics, alerts and code block.
- Business behavior retained: eligible Gemini key filtering, per-key concurrent job loading, parent/retry aggregation, fixed 1K submission, prompt and reference-image limits, retry/download/delete gates, ZIP downloads, eight-second job polling and IndexedDB thumbnail caching.

## Implementation

- Replaced `TablePageLayout`, legacy `DataTable`, `BaseDialog`, `Select` and `SearchInput` with imports from `@/components/ui`.
- Rebuilt the list as one dense responsive table surface with compact search, filters, bulk actions and has-more pagination.
- Kept mobile data in the same table hierarchy with internal horizontal scrolling instead of converting rows into cards.
- Rebuilt task details with semantic metrics, failure alerts, an internally scrolling item table and lazy thumbnail actions.
- Rebuilt the create flow with slim shared fields, model-aware reference upload, prompt rows and fixed output summaries.
- Replaced browser confirmation prompts with `UiConfirmDialog` for cancellation, single deletion and bulk deletion.
- Replaced the custom image dialog with `UiImagePreview` and the guide textarea with `UiCodeBlock`.
- Added request sequencing so stale list, selected-job and item responses cannot overwrite newer state.
- Added preview-session invalidation so late cache or image responses cannot retain object URLs after closing or switching details.
- Revalidated reference-image capacity after asynchronous file reads so a model switch cannot exceed the new model limit.
- Added accessible labels for refresh, selection, row actions, filters and mobile table regions.

## Automated Verification

- Focused Vitest: 5 page-level tests passed.
- Covered per-key concurrent merge/sort, stale list responses, stale detail/item responses, fixed 1K and idempotency payloads, reference-image base64 binding and shared deletion confirmation.
- `pnpm run typecheck`: passed.
- ESLint for the changed page, tests and locale files: passed.
- `pnpm run build`: passed.
- `git diff --check`: passed.

## Browser Verification

Verified against the local preview at `http://127.0.0.1:4174/batch-image` with the local `sub2api_preview` database only.

- 1440 x 900: header actions, filter workspace and empty state align without clipping or page overflow.
- 1440 x 900 create dialog: two-column form uses stable slim controls, prompt work area and a fixed footer without nested card chrome.
- 900 x 900: collapsed application navigation leaves the table workspace at full usable width with no horizontal document overflow.
- 390 x 844: header actions wrap cleanly, filters stack, and the document remains exactly 390px wide.
- 390 x 844 create dialog: the dialog becomes a mobile bottom surface, its body scrolls internally, and the footer remains reachable without page overflow.
- Dark mode: surfaces, borders, form controls, empty states and primary actions remain legible.

## Environment Note

The local preview database did not contain an eligible Gemini API key or batch job, so the browser pass verified the real empty, loading and create-flow surfaces. Populated rows, concurrency, payload and destructive-action behavior are covered by the focused component tests with deterministic API fixtures.

## Restoration

- Restored the local administrator password hash after browser verification.
- Reset the temporary browser viewport override and returned the preview to light mode.
- Left the existing backend and Vite preview processes running.
