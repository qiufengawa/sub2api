# R18 Admin User Modals Acceptance

## Scope

- Rebuilt API key, allowed-group, balance, balance-history, group-replacement, and custom-attribute dialogs with shared compact UI controls.
- Removed the remaining hand-drawn checkbox, radio, spinner, status badge, and form-control visuals in these workflows.
- Added stacked radio-group support for dense single-choice lists and native `pattern` forwarding for shared text fields.
- Preserved all existing props, emits, watchers, API calls, balance operations, group replacement, attribute CRUD, and API-key group assignment behavior.

## Verification

- Users view, bulk limit, and platform quota regression suites: 19 tests passed.
- Shared primitive and radio-group suites: 9 tests passed.
- `vue-tsc --noEmit`, targeted ESLint, and `git diff --check` passed.
