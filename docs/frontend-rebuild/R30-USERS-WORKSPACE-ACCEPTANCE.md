# R30 Users Workspace Acceptance

## Scope

- Rebuilt the administrator user list with the shared page header, server-table workspace, data table, pagination, and destructive confirmation components.
- Replaced hand-positioned filter, column, usage-sort, and row-action menus with shared viewport-aware popovers and dropdowns.
- Removed the row-action Teleport DOM, manual viewport coordinate calculations, and inline SVG sort/withdraw icons.
- Preserved server sorting, current-page usage sorting, cross-page selection, column and filter persistence, lazy secondary-data loading, administrator delete protection, and all modal event chains.
- Kept the dense comparison table on narrow screens through the shared mobile table scroller contract.
- Migrated create, edit, bulk limits, platform quota, API key, allowed-group, balance, balance-history, and group-replacement dialogs away from `BaseDialog` and blocking `window.confirm` calls.
- Replaced the API-key selector's hand-positioned Teleport menu with `UiSelect`, added server pagination, and refreshes the parent user snapshot after automatic group grants.
- Added request identity protection to user API-key, allowed-group, and balance-history loading so an older user response cannot overwrite the active dialog.
- Allowed-group loading now reads a fresh user snapshot, blocks saving after load failure, and preserves allowed group IDs that are not visible in the active standard-group list.
- Platform quota editing now uses the shared data table and controlled destructive confirmation for clear/reset operations while retaining all five platforms and three quota windows.

## Verification

- Users-domain acceptance run: 7 test files and 42 tests passed.
- Verified server sort payloads, usage sort reset, cross-page selection, bulk-update refresh, API-key pagination, stale-response rejection, hidden group preservation, quota confirmation, and persisted column behavior.
- `vue-tsc --noEmit`, targeted ESLint, native-control and inline-SVG scans, and `git diff --check` passed.
