# R23 Group Exclusivity Field Acceptance

## Scope

- Replaced duplicate create/edit exclusivity tooltips and switch layouts with one domain field.
- Preserved the exclusive/public boolean, labels, full explanation, example text, and onboarding tour attribute.
- Uses shared field help and switch primitives without page-local overlay or color rules.

## Verification

- Exclusivity field contract: 2 tests passed.
- Current Groups domain and workspace regressions: 5 test files and 16 tests passed.
- `vue-tsc --noEmit`, targeted ESLint, and `git diff --check` passed.
