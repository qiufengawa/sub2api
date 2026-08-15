# R21 Group Copy Accounts Picker Acceptance

## Scope

- Replaced duplicate create/edit account-copy tags, custom tooltip, and native select with one shared domain picker.
- Preserved platform-filtered source groups, multi-selection, edit-mode exclusions, immutable add/remove behavior, and existing create/update payload fields.
- Uses shared field help, badge, select, and Lucide close icon with compact density and accessible removal labels.

## Verification

- Picker contract: 2 tests passed.
- Groups workspace regression suites: 10 tests passed.
- Current component batch: 4 test files and 14 tests passed.
- `vue-tsc --noEmit`, targeted ESLint, and `git diff --check` passed.
