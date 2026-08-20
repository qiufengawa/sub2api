# R43 Accounts Workspace Acceptance

## Scope

- Rebuild the administrator account workspace with shared page, table, toolbar, pagination, selection, and compact control primitives.
- Rebuild account test, reauthorization, CRS sync, data import, temporary unschedulable status, and statistics dialogs with shared overlays and form controls.
- Rebuild the bulk-edit dialog with shared dialog, confirmation, alert, checkbox, switch, select, segmented, text-field, and button primitives; remove its legacy controls and inline SVG icons.
- Migrate the create/edit dialog shells, identity fields, footer actions, shared selects, and billing switches while retaining the provider-specific form branches for subsequent visual batches.
- Replace account capacity, group, usage, billing probe, and loading-state visual controls with shared UI components and Lucide icons.

## Preserved Contracts

- Server-side account sorting, virtualization, persisted sort order, column visibility, and scheduler-score request gating.
- Optimistic priority updates with rollback and post-save reload.
- ETag merge protection, monitor/stat request sequencing, automatic-refresh pause rules, and cross-page selection.
- Account test SSE payloads and output, OAuth method values, CRS preview/apply payloads, data-import payloads, and temporary-unschedulable reset behavior.
- Passive usage collection remains separate from explicit active usage and upstream billing probes.

## Verification

- Accounts workspace and account-domain tests: 27 files, 320 tests passed.
- `vue-tsc --noEmit`: passed.
- ESLint for all files in this batch: passed.
- `git diff --check`: passed.
- Browser QA at 1440px, 900px, and 390px viewports: passed.
- The 390px account list remains a dense table with internal horizontal scrolling (`324px` viewport region, `2344px` table content) and no document-level horizontal overflow.
- The 390px create, edit, and bulk-edit dialogs stay within the viewport with independently scrollable bodies, fixed visible footers, and no document-level horizontal overflow.
- At 1440x900 the create dialog measured `860x852px` with its footer at `875px`; at 900x800 the bulk dialog measured `852x752px` with its footer at `775px`; at 390x844 every dialog measured `390x844px` with its footer at the viewport bottom.

## Notes

- The account test spec now stubs the shared `UiDialog`, `UiSelect`, and `UiTextArea` component names. This keeps the existing SSE behavior assertion valid after removing the legacy component imports.
- Account view specs now stub `UiDataTable` directly; the compatibility clone was removed because it discarded runtime prop metadata and accidentally enabled mobile card rendering.
- `AccountServiceStatusCell` retains the `HelpTooltip` compatibility adapter because the adapter already delegates to `UiTooltip` and preserves its established trigger/content slot contract.
- Create/edit provider-specific credential and quota sections still contain legacy visual markup. They remain in the active R43 follow-up scope; this record does not count those sections as complete.

## 2026-08-18 Follow-up

- The account proxy-fallback revert action in `AccountsView.vue` now uses the
  shared compact `UiButton`; its existing row payload and `onRevertFallback`
  handler are unchanged.
- This follow-up does not close R43: provider-specific account fields,
  browser evidence, and the remaining R1/R7 control audit are still pending.

## 2026-08-18 Provider Field Follow-up

- `EditAccountModal.vue` upstream URL/API key, Vertex project ID, Bedrock
  credentials, API key and region now use `UiTextField`/`UiPasswordField`.
- Existing account type branches, secret-empty semantics, readonly project
  behavior, placeholders, descriptions and edit payload bindings are unchanged.
- This follow-up does not close R43; Bedrock mode checkbox, scheduling and
  controlled capability controls, provider selectors, and browser evidence
  remain pending.

## 2026-08-18 Create Field Follow-up

- `CreateAccountModal.vue` Antigravity project ID and Vertex project ID now use
  `UiTextField` while the native Vertex file input remains native for drag/drop
  and `FileReader` semantics.
- Create custom error-code input and Bedrock pool retry fields now use
  `UiTextField`, preserving numeric bounds, Enter handling, defaults and
  selected-code behavior.
- This follow-up does not close R43; provider card selectors, radio/checkbox
  groups, file-upload exception, and browser evidence remain pending.

## 2026-08-19 Mutation single-flight follow-up

- Account deletion and all bulk delete/reset/refresh/probe/schedulable mutations now use function-level pending guards; the bulk action bar disables selection and mutation controls together and exposes `aria-busy`.
- Single-row schedulable changes reject a second invocation until the current request and refresh complete. Confirmation dialogs expose pending state instead of relying only on click timing.
- Scheduled Tests create/edit/delete and enabled-toggle handlers now reuse their loading state as entry guards; enabled updates are isolated per plan ID and deletion uses confirm pending.
- Accounts/AccountBulkActionsBar focused coverage is 3 files / 17 tests; Scheduled Tests is 5 tests. Typecheck and targeted ESLint passed. Protected administrator browser verification remains pending.
