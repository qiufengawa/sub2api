# R20 Group Models List Editor Acceptance

## Scope

- Replaced the duplicated create/edit model-list template with one domain editor built from shared switch, checkbox, button, icon-button, and spinner primitives.
- Preserved enablement, saved model IDs, candidate hydration, select-all, invert, row selection, ordering, loading, and empty-state behavior.
- Kept request generation and stale-response protection in `GroupsView`; the editor only emits cloned form state and does not mutate props.
- Added localized accessible labels for model ordering actions.

## Verification

- Domain editor and model-list helper suites: 13 tests passed.
- Groups workspace regressions: 10 tests passed.
- `vue-tsc --noEmit`, targeted ESLint, and `git diff --check` passed.
