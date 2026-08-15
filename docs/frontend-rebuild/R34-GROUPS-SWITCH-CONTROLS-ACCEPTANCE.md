# R34 Groups Switch Controls Acceptance

## Scope

- Replaced every hand-built boolean switch in the groups create and edit workflows with `UiSwitch`.
- Covered MCP XML injection, Claude Code restriction, OpenAI Live, Messages Dispatch, OAuth-only accounts, privacy-set accounts, and model routing.
- Preserved the OpenAI Live compatibility confirmation by keeping `toggleLive()` as the switch update handler.
- Preserved all platform visibility guards, enabled/disabled labels, reset logic, and serialized group settings.

## Verification

- Eight targeted suites passed with 43 tests covering Messages Dispatch, supported scopes, image/video pricing, profit control, columns, duplication, and Grok pricing contracts.
- `vue-tsc --noEmit`, targeted ESLint, hand-built switch scans, and `git diff --check` passed.
