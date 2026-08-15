# R30 Users Workspace Acceptance

## Scope

- Rebuilt the administrator user list with the shared page header, server-table workspace, data table, pagination, and destructive confirmation components.
- Replaced hand-positioned filter, column, usage-sort, and row-action menus with shared viewport-aware popovers and dropdowns.
- Removed the row-action Teleport DOM, manual viewport coordinate calculations, and inline SVG sort/withdraw icons.
- Preserved server sorting, current-page usage sorting, cross-page selection, column and filter persistence, lazy secondary-data loading, administrator delete protection, and all modal event chains.
- Kept the dense comparison table on narrow screens through the shared mobile table scroller contract.

## Verification

- Existing Users workspace suite: 3 tests passed.
- Verified server sort payloads, usage sort reset, cross-page selection, bulk-update refresh, and persisted column behavior.
- `vue-tsc --noEmit`, targeted ESLint, native-control and inline-SVG scans, and `git diff --check` passed.
