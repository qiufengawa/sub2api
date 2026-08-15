# R16 Admin User Forms Acceptance

## Scope

- Replaced User create/edit modal inputs, role selectors, numeric controls, password actions, notes, and footer actions with shared UI fields and buttons.
- Removed inline password SVG controls and old input/button classes from both forms.
- Preserved step-up authentication, random password generation, clipboard behavior, custom attribute updates, validation, and API payload semantics.
- Rebuilt the bulk user limits form with shared switches, numeric fields, and footer actions while retaining its confirmation and batch payload contract.

## Verification

- `vue-tsc --noEmit`: passed.
- ESLint for both modal files: passed.
- Users and bulk-user regression tests: 8 tests passed.
- `UiTextField` now supports a stable `data-test` hook for form-level automation.
