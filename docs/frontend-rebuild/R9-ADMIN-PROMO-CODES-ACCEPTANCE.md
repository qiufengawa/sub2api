# R9 Admin Promo Codes Acceptance

## Scope

- Route: `/admin/promo-codes`
- View: `frontend/src/views/admin/PromoCodesView.vue`
- Contract tests: `frontend/src/views/admin/__tests__/PromoCodesView.spec.ts`

## Implemented

- Uses one compact `AppPage` and `AppPageHeader`, shared filter/table workspaces, dense controls, and horizontally scrollable desktop/mobile tables.
- Keeps search, status filtering, server-side sorting, pagination, refresh, code and registration-link copy, create, edit, usage records, and delete operations.
- Keeps amount, use-count, active/disabled/expired/max-used status, expiration, creation time, and row actions visible.
- Starts with a dimensionally stable list loading state.
- Shows a retryable error when the first load fails and a persistent alert while existing rows remain visible after a refresh failure.
- Locks delete confirmation until deletion and the following list refresh finish.
- Clears copy-feedback timers and invalidates in-flight usage-detail responses when the page unmounts.
- Removes expected request failures from browser-console error output while keeping visible shared error feedback.

## Preserved Contracts

- List requests still carry page, page size, `status`, `search`, `sort_by`, `sort_order`, and `AbortSignal`.
- Search, status, sorting, and page-size changes reset the page as before.
- Create keeps omitted code auto-generation, optional notes/expiry, amount, and zero-as-unlimited use count.
- Update continues to send a cleared expiry as `0`; delete continues to send the selected promo-code ID.
- Status derivation still distinguishes active, disabled, expired, and maximum-use states.
- Usage pagination remains server-side and stale responses cannot replace a newer selected code.

## Automated Verification

Run on 2026-08-16:

```text
pnpm exec vitest run src/views/admin/__tests__/PromoCodesView.spec.ts
Result: 1 file, 9 tests passed

pnpm exec eslint \
  src/views/admin/PromoCodesView.vue \
  src/views/admin/__tests__/PromoCodesView.spec.ts
Result: passed

pnpm exec vue-tsc --noEmit
Result: passed

pnpm run test:run
Result: 321 files, 2119 tests passed

pnpm run build
Result: passed

git diff --check
Result: passed
```

The suite covers initial loading, default server sort, search/status reset, server sorting, initial and refresh failures, create/update timestamp payloads, delete single-flight behavior, usage pagination, and stale usage responses.

## Browser Acceptance

Pending with the protected administrator-route prerequisite. The current Edge session is not authenticated against `http://127.0.0.1:4174`.

Required before final completion:

- `1440px`, `900px`, and `390px` screenshots for loading, populated, empty, error, long-code, and large-number states.
- Narrow-table scrolling, filters, copy feedback, create/edit dialogs, usage dialog, delete pending state, keyboard order, dark mode, reduced motion, and safe-area checks.
- Browser-console error/warning check.

No database, administrator credential, browser storage, or route guard was modified to bypass authentication.
