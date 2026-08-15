# R40 Groups Async Account Picker Acceptance

## Scope

- Added focused async-picker capabilities for search-on-focus, empty-query results, loading text, and clear-after-select workflows.
- Replaced both Groups model-routing account search implementations with `UiAsyncEntityPicker`.
- Removed page-owned account dropdown visibility, absolute positioning, outside-click handling, and native option buttons.
- Preserved per-rule keyed debounce, AbortSignal cancellation, account filtering, duplicate prevention, selected-account removal, and create/edit routing payloads.
- Kept the shared text-field event type backward-compatible while retaining runtime `.number` coercion.

## Verification

- Fourteen Groups/UI suites passed with 66 tests.
- `vue-tsc --noEmit`, targeted ESLint, native-control/overlay scans, and `git diff --check` passed.
- Added dedicated async-picker coverage for focus search, empty-query suggestions, and clear-after-select behavior.
