# R58 Admin Payment Plans Acceptance

## Status

- Workspace implementation and automated verification are complete.
- A real signed-in administrator browser pass remains required before strict completion.

## Scope

- Route: `/admin/orders/plans`
- View: `frontend/src/views/admin/orders/AdminPaymentPlansView.vue`
- Domain dialogs: `PlanEditDialog.vue`, `PlanImportDialog.vue`
- Shared workspace: `frontend/src/components/ui/UiServerTableWorkspace.vue`
- API extension: optional cancellation signal for the existing plan-list request.
- Contract tests: `frontend/src/views/admin/orders/__tests__/` and the shared workspace contract test.

## Implemented

- Uses one compact `AppPage` and `AppPageHeader`, a shared server-table workspace, and a horizontally scrollable comparison table at narrow widths.
- Keeps plan name, included routing groups and rate multipliers, five-hour/cycle/term quotas, price, validity, per-user purchase limit, sale status, sort order, and actions visible.
- Preserves create, edit, JSON file/paste import, portable template download, current-catalog export, refresh, sale toggle, and delete operations.
- Initial loading uses the table skeleton without a second workspace overlay.
- Local refresh retains current plan rows under `UiLoadingOverlay`; refresh failure keeps those rows and shows a persistent alert.
- Superseded plan-list requests are aborted, late responses cannot overwrite newer data, and unmount aborts the active request.
- Corrected `UiServerTableWorkspace` so its loading overlay wraps retained content instead of rendering inside a zero-height sibling host.
- Preserved the workspace flex-height contract used by virtualized account tables.
- Prevents duplicate sale-toggle and delete requests while their first request is pending; the delete dialog stays locked until deletion and table refresh finish.
- Uses the compact control scale consistently in the page header.

## Preserved Contracts

- API URLs and payloads for list, update, delete, import, and export are unchanged.
- Backend newline-delimited features continue to normalize into arrays.
- Included routing groups, group multipliers, quota zero-as-unlimited semantics, reset interval, currency, validity unit, and maximum subscription count remain unchanged.
- The v3 portable catalog still requires explicit group selection during import and cannot create virtual subscription groups; v2 metadata remains backward compatible.
- Failed toggles leave the local sale state unchanged, failed deletes keep the confirmation context, and all failures continue through the shared error translator.

## Automated Verification

Run on 2026-08-16:

```text
Targeted Vitest
Result: 6 files, 60 tests passed

Full Vitest JSON report
Result: 782 suites, 2132 tests passed; 0 failed or pending

pnpm run typecheck
Result: passed

pnpm run lint:check
Result: passed

pnpm run build
Result: passed; 3117 modules transformed

git diff --check
Result: passed
```

The production build retains the existing chunk-size, mixed static/dynamic import, Browserslist, and `lottie-web` warnings.

## Browser Acceptance

Pending with the same local authentication prerequisite recorded for the administrator audit workspace. The current Edge session is not authenticated against `http://127.0.0.1:4174`, and protected administrator routes redirect to login.

Required before final completion:

- `1440px`, `900px`, and `390px` screenshots of populated, loading, retained-row refresh, empty, error, long-name, and large-number states.
- Table horizontal scrolling, keyboard focus order, sale-toggle pending state, delete pending state, edit dialog, import file/paste modes, dark mode, reduced motion, and safe-area checks.
- Browser-console error/warning check.

No database, administrator credential, browser storage, or route guard was modified to bypass authentication.
