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

## 2026-08-19 API-key loading boundary addendum

- `loadApiKeys` now uses a single-flight promise, so opening the create dialog while the initial page load is pending does not issue a duplicate `/keys` request.
- The request passes an `AbortSignal`; unmount invalidates the request sequence and aborts the controller. Abort-shaped failures (`AbortError`, `CanceledError`, and `ERR_CANCELED`) do not produce a user-facing error, and late responses cannot mutate page state.
- `BatchImageGuideView.spec.ts` now covers pending-load deduplication and unmount cancellation. The focused suite is 7 tests passing.
- This is a local async-boundary regression proof only; populated rows, eligible-key data, and the authenticated browser matrix remain subject to the existing R51 evidence and final protected-page gate.

## 2026-08-19 multi-key pagination continuity addendum

- The list now keeps a per-key cached prefix (`rows`, raw offset, exhausted state) within one cache generation, expands every key to the global page boundary plus one row, then performs a stable global merge before slicing the requested page.
- Filters, page size, explicit refresh and list mutations invalidate the generation. Returning to an already loaded page reuses the cached prefixes, and child rows whose parent falls outside the current raw page remain visible as child rows instead of disappearing.
- `BatchImageGuideView.spec.ts` now has 8 tests, including the concrete two-key/25-rows-each counterexample across three pages and a no-extra-request assertion when navigating back to a cached page. Typecheck, targeted ESLint and diff check passed.
- The upstream contract still exposes only per-key OFFSET plus `has_more`, without a snapshot token. The frontend now guarantees continuity for a static dataset within one cache generation; strong consistency while records are inserted/deleted concurrently requires a future backend pagination contract and is not claimed here.

## 2026-08-19 list failure-state addendum

- API-key discovery failure and job-list failure now have separate persistent messages and a shared retry action. Neither failure is rendered as the genuine empty-job state.
- If rows already exist, refresh failures preserve those rows and show an inline danger alert; successful retries clear only the corresponding error domain.
- `BatchImageGuideView.spec.ts` now has 10 tests, including API-key failure/retry and job-list failure/retry. Typecheck and targeted ESLint passed. Eligible-key populated browser data and destructive-action browser verification remain pending.

## 2026-08-20 retry input contract addendum

- The item API exposes only `prompt_preview`; the backend DTO, persistence schema and repository have no complete prompt field. Normal new submissions are validated against the same `max_prompt_chars` limit before this preview is stored, but historical records and configuration changes do not provide a replay guarantee.
- Failed-item retry also cannot recover reference images, output count or aspect ratio from the item API. The frontend therefore cannot claim that its current retry payload is equivalent to the original request without a backend retry endpoint or protected complete-input DTO.
- This task does not change backend business contracts. The limitation remains an explicit follow-up boundary; existing failure discovery, aggregation/download gating and unmount race fixes remain covered by the local suites.

## 2026-08-20 localization and cancel-race addendum

- Detail item table headers now use localized `customId` and `prompt` keys instead of hard-coded English labels, keeping the table language and screen-reader column names aligned in both English and Chinese.
- Cancellation captures the selected batch id and detail request sequence. A late response or error is ignored after switching jobs or closing the detail dialog, so it cannot replace the current job or emit a stale toast.
- `BatchImageGuideView.spec.ts` now covers localized detail headers and the pending-cancel-then-switch race; the focused suite is 15 tests passing.
- This remains component-level evidence. Populated authenticated browser cancellation, provider sandbox, complete retry input and destructive-action browser verification remain pending.
