# R45 Admin Prompt Audit Acceptance

## Scope

- Rebuild the administrator Prompt Audit workspace with the shared page, section, tab, filter, table, dialog, form, status, metric, and save-bar contracts.
- Preserve the existing configuration, runtime, group-scope, endpoint probe, event filtering, event detail, pagination, selection, and deletion APIs.
- Replace legacy `BaseDialog`, raw form controls, page-local buttons, native confirmation prompts, and Tailwind color treatments.
- Keep the mobile event workspace as a horizontally scrollable list rather than converting it to cards.

## Preserved Contracts

- Configuration, runtime, group, event list, and event detail requests use independent latest-request-wins sequences.
- A stale event request or detail request cannot overwrite the latest response.
- Delete previews remain bound to their dialog session, request sequence, and normalized filter fingerprint.
- Changing filters or closing the dialog invalidates old confirmation tokens; zero-match previews never execute deletion.
- Saving a configuration cannot overwrite edits made while the request is pending. A submitted plaintext endpoint token is cleared after success, while a different token typed during the request is retained.
- Endpoint credentials retain the blank-secret keep, explicit clear, invalid-secret re-entry, and replacement semantics.
- Selected group IDs remain sorted; scanner IDs remain in the fixed catalog order. Worker and queue bounds remain `1..32` and `1..100000`.
- Filter deletion defaults to the seven-day preset unless the list already contains an explicit valid time range.
- Event identity fields, full-prompt fallback, normalized Guard return, technical facts, pagination, and all eleven list filters remain available.

## Shared UI Migration

- Page shell: `AppPage`, `AppPageHeader`, `AppSection`, `UiTabs`, `UiSaveBar`.
- Runtime: `UiSkeleton`, `UiStatusBadge`, `UiStatMetric`, `UiAlert`.
- Endpoint pool: `UiSwitch`, `UiBadge`, `UiStatusBadge`, `UiDialog`, `UiConfirmDialog`, `UiTextField`, `UiPasswordField`, `UiCheckbox`, `UiButton`.
- Policy: `UiRadioGroup`, `UiSearchInput`, `UiCheckbox`, `UiNumberStepper`, `UiEmptyState`.
- Events: `UiFilterBar`, `UiSelect`, `UiTextField`, `UiMobileTableScroller`, `UiCheckbox`, `UiCopyButton`, `UiBadge`, `UiPagination`.
- Details and deletion: `UiDialog`, `UiTabs`, `UiCodeBlock`, `UiDescriptionList`, `UiAccordion`, `UiAlert`, `UiEmptyState`.

## Verification

- Prompt Audit and related shared UI tests: 6 files, 35 tests passed.
- `vue-tsc --noEmit`: passed.
- ESLint for every file in this batch: passed.
- Production build: passed (`3111` modules transformed, built in `31.03s`).
- `git diff --check`: passed.
- Source scan found no remaining legacy `BaseDialog`, raw page buttons/inputs/selects, `window.confirm`, `:deep()`, or `!important` inside Prompt Audit production components.
- Browser QA passed at 1440x1000, 900x900, and 390x844.
- Document-level horizontal overflow was absent at all three widths. At 900px and 390px, the event table keeps its `1120px` workspace inside the labeled horizontal scroller.
- The 390px section action buttons each render at 160x28px after the shared mobile section-header correction.
- The filter-delete dialog fills the 390x844 viewport, scrolls internally, and keeps all three footer actions visible.
- The endpoint editor remains within the 390px viewport, exposes all seven fields, and keeps Cancel/Save visible.
- Dark mode reports the neutral black body surface with no document overflow.
- Reduced-motion emulation reports `prefers-reduced-motion: reduce`; sampled shared motion controls have no animation and `0s` transitions.

## Screenshots

- `screenshots/admin-prompt-audit-1440.png`: desktop event workspace.
- `screenshots/admin-prompt-audit-config-1440.png`: desktop runtime, endpoint, and policy workspace.
- `screenshots/admin-prompt-audit-900.png`: medium-width event workspace.
- `screenshots/admin-prompt-audit-390.png`: mobile list and filter layout.
- `screenshots/admin-prompt-audit-delete-390.png`: mobile filter-delete dialog.
- `screenshots/admin-prompt-audit-endpoint-390.png`: mobile endpoint editor.
- `screenshots/admin-prompt-audit-dark.png`: dark-mode configuration workspace.

## Environment Notes

- Browser preview used only the local `sub2api_preview` PostgreSQL database and local preview service. No production database was connected or migrated.
- Risk Control was enabled only for the browser acceptance session and restored to `false` afterward.
- The local administrator password hash was restored exactly after browser acceptance.
- The local preview binary's existing subscription-schema warning is unrelated to this frontend batch.
