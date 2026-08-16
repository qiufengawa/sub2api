# R25 Audit Log Workspace Acceptance

## Scope

- Route: `/admin/audit-logs`
- View: `frontend/src/views/admin/AuditLogView.vue`
- Contract tests: `frontend/src/views/admin/__tests__/AuditLogView.spec.ts`

## Implemented

- Uses one compact `AppPage` and one `AppPageHeader` inside the authenticated application shell.
- Rebuilds search, result and time filters, advanced filters, server-side table, pagination, detail drawer, custom time range, clear confirmation, and TOTP prompt with shared `Ui/App` components.
- Keeps the comparison table on narrow screens instead of converting audit records into tall cards.
- Keeps detail data flat through `UiDescriptionList` and `UiCodeBlock`; no nested detail cards remain.
- Starts in a dimensionally stable loading state so the first paint reserves the final table workspace.

## Preserved Contracts

- Server-side query field names, pagination reset behavior, fixed time ordering, and local datetime to RFC3339 conversion.
- Separate empty and filtered-empty states, retryable list/detail failures, and stale list/detail response protection.
- TOTP availability check, confirmation sequence, six-digit clear payload, post-clear refresh, and success/error feedback.
- HTTP status semantics, monospaced request identifiers and IP values, and tabular latency values.

## Automated Verification

Run on 2026-08-16:

```text
pnpm exec vitest run src/views/admin/__tests__/AuditLogView.spec.ts
Result: 1 file, 9 tests passed

pnpm exec eslint \
  src/views/admin/AuditLogView.vue \
  src/views/admin/__tests__/AuditLogView.spec.ts
Result: passed

pnpm exec vue-tsc --noEmit
Result: passed

pnpm run test:run
Result: 321 files, 2112 tests passed

pnpm run build
Result: passed

git diff --check
Result: passed
```

The suite covers the initial loading reservation, stable query shape, invalid and valid custom time ranges, persistent list/detail errors, stale detail response protection, single-request page-size changes, and the TOTP clear chain.

## Browser Acceptance

Pending. The Edge session reached `http://127.0.0.1:4174/admin/audit-logs` and was correctly redirected to `/login?redirect=/admin/audit-logs` because that local preview currently has no authenticated administrator session.

Required before final completion:

- `1440px`, `900px`, and `390px` screenshots of loading, success, empty, error, and long-value states.
- Desktop and mobile horizontal-table checks, advanced-filter interaction, detail drawer, custom range dialog, keyboard order, dark mode, and reduced motion.
- Browser-console error/warning check.

No database user, password, browser storage, or route guard was modified to bypass authentication.
