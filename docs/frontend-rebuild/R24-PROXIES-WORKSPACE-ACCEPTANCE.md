# R24 Proxies Workspace Acceptance

## Scope

- Rebuilt the proxy toolbar, server-side table, selection controls, pagination, dialogs, and create/edit/import forms with shared UI primitives.
- Preserved search debounce, request cancellation, server-side sorting and filtering, persisted page size, cross-row selection, CRUD payloads, batch operations, quality checks, exports, and expiry-date semantics.
- Replaced native status, protocol, latency, quality, and expiry treatments with shared semantic badges.
- Replaced the quality-report and linked-account native tables with shared mobile-scrollable data tables and removed the unrelated external promotion from the create dialog.
- Added a monospace mode to the shared textarea for structured proxy imports and localized accessible row-selection labels.

## Verification

- Proxy workspace and shared primitive suites: 2 test files and 12 tests passed.
- Verified selection-to-batch-action state, 300 ms server search, and the create API payload contract.
- `vue-tsc --noEmit`, targeted ESLint, and `git diff --check` passed.
