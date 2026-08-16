# R58 Admin Payment Plans Acceptance

## Scope

- Route: `/admin/orders/plans`
- View: `frontend/src/views/admin/orders/AdminPaymentPlansView.vue`
- Domain dialogs: `PlanEditDialog.vue`, `PlanImportDialog.vue`
- Contract tests: `frontend/src/views/admin/orders/__tests__/`

## Implemented

- Uses one compact `AppPage` and `AppPageHeader`, a shared server-table workspace, and a horizontally scrollable comparison table at narrow widths.
- Keeps plan name, included routing groups and rate multipliers, five-hour/cycle/term quotas, price, validity, per-user purchase limit, sale status, sort order, and actions visible.
- Preserves create, edit, JSON file/paste import, portable template download, current-catalog export, refresh, sale toggle, and delete operations.
- Starts with the final table workspace reserved in loading state.
- Adds a persistent retryable load failure when no data is available and a persistent alert when a refresh fails while existing rows remain visible.
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
pnpm exec vitest run \
  src/views/admin/orders/__tests__/AdminPaymentPlansView.spec.ts \
  src/views/admin/orders/__tests__/PlanEditDialog.spec.ts \
  src/views/admin/orders/__tests__/PlanImportDialog.spec.ts
Result: 3 files, 38 tests passed

pnpm exec eslint <R58 source and locale files>
Result: passed

pnpm exec vue-tsc --noEmit
Result: passed

pnpm run test:run
Result: 321 files, 2116 tests passed

pnpm run build
Result: passed

git diff --check
Result: passed
```

## Browser Acceptance

Pending with the same local authentication prerequisite recorded for the administrator audit workspace. The current Edge session is not authenticated against `http://127.0.0.1:4174`, and protected administrator routes redirect to login.

Required before final completion:

- `1440px`, `900px`, and `390px` screenshots of populated, loading, empty, error, long-name, and large-number states.
- Table horizontal scrolling, keyboard focus order, sale-toggle pending state, delete pending state, edit dialog, import file/paste modes, dark mode, reduced motion, and safe-area checks.
- Browser-console error/warning check.

No database, administrator credential, browser storage, or route guard was modified to bypass authentication.
