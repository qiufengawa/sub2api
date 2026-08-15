# R22 Group Core Fields Acceptance

## Scope

- Rebuilt the duplicated create/edit core fields with shared compact text, textarea, select, and switch controls.
- Preserved group name, description, platform lock/change behavior, rate multiplier, RPM limit, exclusivity, status, tour attributes, required constraints, and numeric bounds.
- Field descriptions now use the shared form-message contract instead of legacy `input-hint` styling.

## Verification

- Groups core, reasoning, copy-account, and model-list regressions: 5 test files and 20 tests passed.
- `vue-tsc --noEmit`, targeted ESLint, and `git diff --check` passed.
