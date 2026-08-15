# R16 Admin User Forms Acceptance

## Scope

- Replaced User create/edit modal inputs, role selectors, numeric controls, password actions, notes, and footer actions with shared UI fields and buttons.
- Removed inline password SVG controls and old input/button classes from both forms.
- Preserved step-up authentication, random password generation, clipboard behavior, custom attribute updates, validation, and API payload semantics.

## Verification

- `vue-tsc --noEmit`: passed.
- ESLint for both modal files: passed.
- Users and bulk-user regression tests: 8 tests passed.
