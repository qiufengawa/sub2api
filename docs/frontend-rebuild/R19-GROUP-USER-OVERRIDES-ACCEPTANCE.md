# R19 Group User Overrides Acceptance

## Scope

- Rebuilt group rate-multiplier and RPM-override dialogs with shared compact fields, buttons, status badges, pagination, spinner, and unframed destructive actions.
- Preserved the separate rate and RPM endpoints so each workflow leaves the adjacent override field unchanged.
- Added request-generation guards when the visible group changes and removed stale global click listeners and debounce timers on unmount.
- Aligned rate validation with the backend requirement that a user multiplier must be greater than zero; RPM zero remains valid.

## Verification

- Added focused payload-isolation and listener-cleanup coverage: 3 tests passed.
- Groups workspace and duplicate-action regressions: 10 tests passed.
- Combined current batch: 8 test files and 41 tests passed.
- `vue-tsc --noEmit`, targeted ESLint, and `git diff --check` passed.
