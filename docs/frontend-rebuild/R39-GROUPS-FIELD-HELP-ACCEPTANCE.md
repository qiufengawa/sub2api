# R39 Groups Field Help Acceptance

## Scope

- Replaced all eight hand-positioned group form tooltips with shared `UiFieldHelp` overlays.
- Covered supported model scopes, MCP XML injection, Claude Code restriction, and model routing in both create and edit workflows.
- Removed page-owned tooltip positioning, z-index, arrow blocks, hover opacity, and dark-mode color overrides.
- Preserved all existing i18n content and field associations.

## Verification

- Thirteen Groups and shared-field suites passed with 64 tests.
- `vue-tsc --noEmit`, targeted ESLint, manual-tooltip scans, and `git diff --check` passed.
