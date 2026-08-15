# R42 Accounts Action Menu Acceptance

## Scope

- Replaced row action menu's legacy menu buttons with shared compact quiet buttons and Lucide icon slots.
- Preserved Teleport rendering, fixed-position coordinates, backdrop close, Escape handling, and all account-specific visibility guards.
- Preserved shadow-account restrictions, OAuth reauthorization/refresh rules, privacy support, recovery actions, quota reset, and emitted event names.

## Verification

- `vue-tsc --noEmit` and targeted ESLint passed.
- Accounts scheduler-score, select-all-results, priority-stepper, and Spark-shadow suites passed: 22 tests.
- No API, state-machine, or row-action payload changes were introduced.
