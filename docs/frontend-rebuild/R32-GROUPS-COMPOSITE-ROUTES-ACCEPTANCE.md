# R32 Groups Composite Routes Acceptance

## Scope

- Migrated all remaining legacy selects in the groups workspace to the shared select contract.
- Rebuilt the Composite Routes editor with shared compact text fields, selects, textarea, checkbox, buttons, icon buttons, and status badges.
- Replaced hand-styled refresh, edit, delete, preview, and form actions with Lucide-backed shared controls.
- Replaced the browser-native route deletion confirmation with `UiConfirmDialog`, including a pending state and close-state cleanup.
- Preserved route create/update payload conversion, priority normalization, edit reset behavior, deletion refresh, endpoint preview, and dialog close cleanup.

## Verification

- Groups column settings, duplicate-group, and Grok pricing contract suites: 12 tests passed.
- `vue-tsc --noEmit`, targeted ESLint, legacy-select and legacy-badge scans, and `git diff --check` passed.
- Confirmed the Composite Routes handlers still call the same administrator API methods and retain the existing success/error paths.
