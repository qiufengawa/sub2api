# R25 Audit Log Workspace Acceptance

## Scope

- Route: `/admin/audit-logs`
- API transport: `frontend/src/api/admin/audit.ts`
- View: `frontend/src/views/admin/AuditLogView.vue`
- Contract tests: `frontend/src/views/admin/__tests__/AuditLogView.spec.ts`

## Implemented

- Uses one compact `AppPage` and one `AppPageHeader` inside the authenticated application shell.
- Rebuilds search, result and time filters, advanced filters, server-side table, pagination, detail drawer, custom time range, clear confirmation, and TOTP prompt with shared `Ui/App` components.
- Keeps the comparison table on narrow screens instead of converting audit records into tall cards.
- Keeps detail data flat through `UiDescriptionList` and `UiCodeBlock`; no nested detail cards remain.
- Starts in a dimensionally stable loading state so the first paint reserves the final table workspace.
- Keeps current rows visible under the workspace refresh overlay and leaves an inline retryable error when a refresh fails.
- Cancels superseded list and detail requests, ignores late responses by request generation, and aborts active requests when the drawer closes or the page unmounts.

## Preserved Contracts

- Server-side query field names, pagination reset behavior, fixed time ordering, and local datetime to RFC3339 conversion.
- Separate empty and filtered-empty states, retryable list/detail failures, and stale list/detail response protection.
- TOTP availability check, confirmation sequence, six-digit clear payload, post-clear refresh, and success/error feedback.
- HTTP status semantics, monospaced request identifiers and IP values, and tabular latency values.

## Automated Verification

Run on 2026-08-16:

```text
pnpm exec vitest run src/views/admin/__tests__/AuditLogView.spec.ts
Result: 1 file, 14 tests passed

pnpm exec eslint \
  src/api/admin/audit.ts \
  src/views/admin/AuditLogView.vue \
  src/views/admin/__tests__/AuditLogView.spec.ts
Result: passed

pnpm exec vue-tsc --noEmit
Result: passed

pnpm run test:run
Result: 323 files, 2137 tests passed

pnpm run lint:check
Result: passed

pnpm run build
Result: 3117 modules transformed; built in 26.18s

git diff --check -- \
  frontend/src/api/admin/audit.ts \
  frontend/src/views/admin/AuditLogView.vue \
  frontend/src/views/admin/__tests__/AuditLogView.spec.ts
Result: passed
```

The suite covers the initial loading reservation, stable query shape, refresh data retention, persistent list/detail errors, list and detail cancellation, late responses after selection changes or drawer closure, invalid and valid custom time ranges, single-request page-size changes, unmount cleanup, and the TOTP clear chain.

The build retains the existing large-chunk, mixed static/dynamic import, Browserslist data-age, and `lottie-web` `eval` warnings; this batch introduced no new build error.

## Browser Acceptance

Pending. The Edge session reached `http://127.0.0.1:4174/admin/audit-logs` and was correctly redirected to `/login?redirect=/admin/audit-logs` because that local preview currently has no authenticated administrator session.

Required before final completion:

- `1440px`, `900px`, and `390px` screenshots of loading, success, empty, error, and long-value states.
- Desktop and mobile horizontal-table checks, advanced-filter interaction, detail drawer, custom range dialog, keyboard order, dark mode, and reduced motion.
- Browser-console error/warning check.

No database user, password, browser storage, or route guard was modified to bypass authentication.
