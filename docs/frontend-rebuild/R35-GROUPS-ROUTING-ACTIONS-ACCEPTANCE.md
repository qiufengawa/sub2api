# R35 Groups Routing Actions Acceptance

## Scope

- Migrated Messages Dispatch mapping actions to shared compact buttons and Lucide-backed icon buttons.
- Migrated model-routing add, remove-rule, and remove-account actions to the shared control system.
- Kept the two account-search result rows as native menu options pending the dedicated async-entity-picker migration.
- Preserved mapping row identity, account selection/removal, routing rule mutations, conditional visibility, and create/edit serialization.

## Verification

- Eight targeted suites passed with 43 tests covering Messages Dispatch, supported scopes, media pricing, profit control, columns, duplication, and Grok pricing contracts.
- `vue-tsc --noEmit`, targeted ESLint, native-action scans, and `git diff --check` passed.
