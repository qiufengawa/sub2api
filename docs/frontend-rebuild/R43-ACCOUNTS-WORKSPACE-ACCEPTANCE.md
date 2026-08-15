# R43 Accounts Workspace Acceptance

## Scope

- Rebuild the administrator account workspace with shared page, table, toolbar, pagination, selection, and compact control primitives.
- Rebuild account test, reauthorization, CRS sync, data import, temporary unschedulable status, and statistics dialogs with shared overlays and form controls.
- Replace account capacity, group, usage, billing probe, and loading-state visual controls with shared UI components and Lucide icons.

## Preserved Contracts

- Server-side account sorting, virtualization, persisted sort order, column visibility, and scheduler-score request gating.
- Optimistic priority updates with rollback and post-save reload.
- ETag merge protection, monitor/stat request sequencing, automatic-refresh pause rules, and cross-page selection.
- Account test SSE payloads and output, OAuth method values, CRS preview/apply payloads, data-import payloads, and temporary-unschedulable reset behavior.
- Passive usage collection remains separate from explicit active usage and upstream billing probes.

## Verification

- Accounts workspace and account-domain tests: 87 passed.
- `vue-tsc --noEmit`: passed.
- ESLint for all files in this batch: passed.
- `git diff --check`: passed.

## Notes

- The account test spec now stubs the shared `UiDialog`, `UiSelect`, and `UiTextArea` component names. This keeps the existing SSE behavior assertion valid after removing the legacy component imports.
- `AccountServiceStatusCell` retains the `HelpTooltip` compatibility adapter because the adapter already delegates to `UiTooltip` and preserves its established trigger/content slot contract.
