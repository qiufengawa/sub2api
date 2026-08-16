# R46 Admin Risk Control Acceptance

## Scope

- Rebuild the administrator Risk Control workspace with the shared page, metric, filter, table, dialog, form, status, feedback, and loading contracts.
- Preserve content-moderation configuration, runtime status, group and model scope, API-key health, moderation testing, risk thresholds, flagged-hash operations, audit filtering, pagination, detail inspection, and user unban behavior.
- Remove the legacy page cards, page-local color palette, handmade progress bars, mobile record cards, and old Tailwind dark-mode treatments.
- Keep every audit-record column on mobile inside an intentional horizontal scroller.

## Preserved Contracts

- Initial configuration, groups, status, proxies, and audit records retain their existing request order and error behavior; proxy loading still degrades to an empty list.
- Runtime status retains the 15-second refresh interval, and unmount still cancels the timer and invalidates pending log requests.
- `pre_block` renders synchronous moderation and API-key load data; `observe` renders worker queue and pool data. The two runtime surfaces remain mutually exclusive.
- Saving retains append/replace/clear API-key semantics, stored-key hash deletion, direct-proxy normalization, model-filter validation, threshold conversion, and the existing update payload.
- Audit filtering retains all six filters. Clearing filters resets result, group, endpoint, search, start time, end time, and pagination before requesting page one.
- Only auto-banned disabled users remain eligible for unban. Flagged-hash deletion retains the 64-character hexadecimal check, and full clearing remains behind the danger confirmation dialog.
- Moderation test prompt, image paste/upload, image count and size limits, stored/input API-key testing, and result categories remain unchanged.

## Shared UI Migration

- Page shell and rhythm: `AppPage`, `AppPageHeader`, `AppStack`, `AppGrid`, `AppSection`.
- Overview and runtime: `UiSkeleton`, `UiStatMetric`, `UiBadge`, `UiStatusBadge`, `UiProgressBar`, `UiEmptyState`.
- Records: `UiFilterBar`, `UiSelect`, `UiSearchInput`, `UiTextField`, `UiMobileTableScroller`, `UiDataTable`, `UiPagination`.
- Settings: `UiDialog`, `UiTabs`, `UiSwitch`, `UiFormField`, `UiSegmentedControl`, `UiTextArea`, `UiFileUpload`, `UiRadioGroup`, `UiAlert`, `UiConfirmDialog`.
- Details: `UiStatusBadge`, `UiDescriptionList`, `UiCodeBlock`.
- `UiProgressBar` now supports a non-visible accessible name and disables width motion when reduced motion is requested.

## Verification

- Risk Control and shared progress tests: 2 files, 20 tests passed.
- Full frontend suite: 315 files and 2059 tests passed. Five unrelated `KeyUsageView.spec.ts` assertions fail against the independently modified Key Usage page in the existing dirty worktree.
- `vue-tsc --noEmit`: passed.
- ESLint for every file in this batch: passed.
- Production build: passed (`3112` modules transformed, built in `29.63s`).
- `git diff --check`: passed.
- Source scan found no remaining legacy card classes, page-local blue/dark Tailwind palette, handmade progress bars, raw inputs/selects, `window.confirm`, `:deep()`, or `!important` in `RiskControlView.vue`.
- Browser QA passed at 1440x1000, 900x900, and 390x844 in the local Edge preview.
- At 390px, document width equals viewport width. The audit table keeps its `1180px` comparison surface inside a `326px` labeled keyboard-scrollable region.
- The 390px settings dialog fits the viewport, scrolls internally, and keeps its footer actions visible. The tab list scrolls internally without widening the dialog.
- Dark mode preserves the neutral surface hierarchy and readable status colors.
- Reduced-motion support is present for the shared progress bar and existing skeleton animation.

## Environment Notes

- Browser acceptance used only the local `sub2api_preview` PostgreSQL database and the already-running local preview services. No production database was connected or migrated.
- The backend remained running throughout acceptance.
- Risk Control was enabled only for the browser acceptance session and restored to `false` afterward.
- The local administrator password hash was restored exactly after browser acceptance.
