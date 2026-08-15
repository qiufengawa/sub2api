# R15 Admin Usage Tabs Acceptance

## Scope

- Replaced the page-local Usage detail tab buttons with the shared `UiTabs` component.
- Added a stable per-tab test/accessibility hook to `UiTabs` without changing its keyboard navigation contract.
- Preserved lazy ranking mounting, error-tab loading, user drill-down, filters, exports, and usage table behavior.

## Verification

- `UsageView.spec.ts`: 12 tests passed.
- ESLint for `UsageView.vue` and `UiTabs.vue`: passed.
- Existing `UiTabs` keyboard and state semantics remain covered by the UI component test suite.
