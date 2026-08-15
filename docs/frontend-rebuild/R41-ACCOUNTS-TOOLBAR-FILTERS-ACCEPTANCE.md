# R41 Accounts Toolbar and Filters Acceptance

## Scope

- Replaced Accounts toolbar refresh/create controls with compact shared buttons and Lucide icons.
- Replaced the account filter bar's legacy search/select wrappers with `UiSearchInput` and `UiSelect`.
- Rebuilt the bulk-action banner with shared quiet/compact/primary/danger controls while preserving every event name and payload.
- Deliberately left the coordinate-based row action menu unchanged because its shadow-account guards and page-owned positioning require a dedicated migration.

## Verification

- `vue-tsc --noEmit` and targeted ESLint passed.
- Accounts scheduler-score, select-all-results, priority-stepper, and Spark-shadow suites passed: 22 tests.
- Existing service-side sorting, selection, priority rollback, and monitor-state behavior remain covered.
