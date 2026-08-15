# R36 Groups Text Controls Acceptance

## Scope

- Migrated Messages Dispatch family mappings and exact-model mappings to compact shared text fields.
- Migrated model-routing patterns and keyed account search inputs to shared text fields.
- Applied monospace typography to model IDs and routing patterns.
- Preserved keyed debounce state, focus-triggered result loading, mapping row identity, account selection, and payload serialization.
- Deferred numeric inputs because their empty/null/clear semantics require a number-aware shared field.

## Verification

- Eight targeted suites passed with 43 tests covering Messages Dispatch, supported scopes, media pricing, profit control, columns, duplication, and Grok pricing contracts.
- `vue-tsc --noEmit`, targeted ESLint, text-input scans, and `git diff --check` passed.
