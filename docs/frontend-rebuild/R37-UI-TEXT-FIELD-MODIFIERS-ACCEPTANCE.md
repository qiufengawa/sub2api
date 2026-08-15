# R37 UI Text Field Modifiers Acceptance

## Scope

- Added Vue `v-model.number` and `v-model.trim` modifier support to `UiTextField`.
- Applied the same normalization to update and change events.
- Preserved an empty numeric input as an empty string so nullable and clearable billing forms can retain their existing submission semantics.
- Fixed the type path used by already-migrated group multiplier and RPM fields.

## Verification

- Added three component tests for numeric values, empty numeric values, and trimmed text.
- Five targeted suites passed with 30 tests, including image/video pricing, profit control, and Messages Dispatch contracts.
- `vue-tsc --noEmit`, targeted ESLint, and `git diff --check` passed.
