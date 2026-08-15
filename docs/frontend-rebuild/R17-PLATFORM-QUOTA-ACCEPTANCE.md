# R17 Platform Quota Editor Acceptance

## Scope

- Replaced platform quota numeric inputs, reset controls, clear action, and modal footer with shared compact fields, icon buttons, and buttons.
- Preserved all five platform rows, daily/weekly/monthly quota semantics, NaN validation, reset confirmation, clear-all confirmation, usage display, and API payload shape.
- Extended `UiIconButton` to render a declared icon together with an optional accessible slot label.

## Verification

- `UserPlatformQuotaModal.spec.ts`: 11 tests passed.
- Existing quota reset, clear, save, subscription warning, and invalid-number coverage remains green.
