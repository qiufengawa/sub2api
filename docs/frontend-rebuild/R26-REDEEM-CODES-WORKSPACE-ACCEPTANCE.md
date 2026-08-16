# R26 Redeem Codes Workspace Acceptance

## Scope

- Route: `/admin/redeem`
- View: `frontend/src/views/admin/RedeemView.vue`
- Contract tests: `frontend/src/views/admin/__tests__/RedeemView.batchUpdate.spec.ts`

## Implemented

- Uses one compact `AppPage` and `AppPageHeader`, a shared server-table workspace, compact filters/actions, and a horizontally scrollable comparison table.
- Keeps type, value, status, user, use time, expiry, copy, selection, sort, pagination, export, generation, batch update, single delete, and delete-all-unused workflows.
- Keeps balance, concurrency, subscription, and invitation generation types; subscription options expose their covered routing groups.
- Starts in a dimensionally stable loading state and preserves existing rows under a persistent refresh-failure alert.
- Uses retryable initial error and explicit empty states rather than showing a failed request as an empty collection.
- Locks export, single delete, and delete-all-unused actions while their request is pending; generation and batch update retain their existing pending guards.
- Clears copy-feedback/search timers and aborts the active list request during unmount.
- Reports subscription-plan dependency failures through shared user feedback and removes expected API failures from browser-console error output.

## Preserved Contracts

- List and export filters, persisted page size, server sorting, AbortSignal, and out-of-range page correction remain unchanged.
- Selected code type metadata persists across server pages so plan reassignment remains available only when every selection is a subscription code.
- Generation preserves plan ID, validity, expiry presets/custom days, zero invitation value, and generated-code copy/download behavior.
- Batch update continues to omit unchecked fields and supports status, expiry clearing/custom time, notes, and subscription plan.
- Delete-all-unused still scans every server page and deletes IDs in bounded batches of 1,000.

## Automated Verification

Run on 2026-08-16:

```text
pnpm exec vitest run src/views/admin/__tests__/RedeemView.batchUpdate.spec.ts
Result: 1 file, 8 tests passed

pnpm exec eslint <R26 source, test, and locale files>
Result: passed

pnpm exec vue-tsc --noEmit
Result: passed

pnpm run test:run
Result: 321 files, 2122 tests passed

pnpm run build
Result: passed

git diff --check
Result: passed
```

The suite covers initial loading, refresh failure with retained rows, shared shell and selection, checked-field payload omission, filter page reset, cross-page subscription selection, complete unused-code pagination, and single-delete request deduplication.

## Browser Acceptance

Pending with the protected administrator-route prerequisite. The current Edge session is not authenticated against `http://127.0.0.1:4174`.

Required before final completion:

- `1440px`, `900px`, and `390px` screenshots for loading, populated, empty, error, long-code, large-value, and selected-row states.
- Narrow-table scrolling, filters, export, generated-code result, batch editor, both delete pending states, keyboard order, dark mode, reduced motion, and mobile safe-area checks.
- Browser-console error/warning check.

No database, administrator credential, browser storage, or route guard was modified to bypass authentication.
