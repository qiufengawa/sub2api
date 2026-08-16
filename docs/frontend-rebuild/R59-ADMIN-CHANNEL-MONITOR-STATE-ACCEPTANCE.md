# R59 Admin Channel Monitor State Acceptance

## Scope

- Route: `/admin/channels/monitor`
- Template API transport: `frontend/src/api/admin/channelMonitorTemplate.ts`
- Main workspace: `frontend/src/views/admin/ChannelMonitorView.vue`
- Filter bar: `frontend/src/components/admin/monitor/MonitorFiltersBar.vue`
- Run result dialog: `frontend/src/components/admin/monitor/MonitorRunResultDialog.vue`
- Template workspace: `frontend/src/components/admin/monitor/MonitorTemplateManagerDialog.vue`
- Chinese and English channel-monitor labels
- Contract, component, and structure tests for the files above

## Implemented

- Renders a stable disabled state and does not mount either monitor implementation when the public feature switch is off.
- Synchronizes the selected V1/V2 workspace when the resolved backend mode changes after public settings load.
- Uses table skeletons only for the initial legacy-list load; later refreshes preserve current rows under the workspace overlay.
- Preserves monitor and template rows after refresh failures and exposes persistent inline retry states instead of relying on toast messages alone.
- Cancels superseded template-list requests, ignores late responses, and aborts active requests when the template dialog closes or unmounts.
- Removes the redundant outer mobile table scroller; `UiDataTable` remains the single focusable horizontal table region with an accessible label.
- Resets server pagination when provider/status filters change, counts search as an active filter, and clears search/provider/status together.
- Prevents repeated enable, monitor-delete, template-delete, and existing duplicate actions while each request is in flight.
- Displays the latency unit only for numeric run-result latency values.
- Renames the inactive V1 tab from “history” to “legacy config” because the table contains editable monitor definitions rather than history records.

## Preserved Contracts

- V1/V2 mode selection, route permission, backend feature switch, list query names, pagination, provider/status/search filters, and abort handling.
- Monitor create/edit/duplicate/delete, enable state, manual V1 run, result display, request-template management, and API-key decrypt failure behavior.
- V1 manual run remains unavailable when V2 is active.
- Mobile retains the same comparison table rather than converting rows to cards.

## Automated Verification

Run on 2026-08-17:

```text
pnpm exec vitest run \
  src/views/admin/__tests__/ChannelMonitorView.duplicate.spec.ts \
  src/views/admin/__tests__/ChannelMonitorView.disabled.spec.ts \
  src/views/admin/__tests__/ChannelMonitorView.grok.spec.ts \
  src/components/admin/monitor/MonitorActionsCell.spec.ts \
  src/components/admin/monitor/MonitorFiltersBar.spec.ts \
  src/components/admin/monitor/MonitorRunResultDialog.spec.ts \
  src/components/admin/monitor/MonitorTemplateManagerDialog.spec.ts \
  src/features/channel-monitor-v2/__tests__/designSystem.structure.spec.ts
Result: 8 files, 32 tests passed

pnpm exec vitest run --reporter=dot
Result: 327 files, 2151 tests passed

pnpm exec vue-tsc --noEmit --pretty false
Result: passed

pnpm run lint:check
Result: passed

pnpm run build
Result: 3117 modules transformed; built in 40.93s

git diff --check
Result: passed
```

The build retains the existing Browserslist data-age, mixed static/dynamic import, large-chunk, Node `DEP0190`, and `lottie-web` `eval` warnings. No new production build error was introduced by this batch.

## Browser Acceptance

Pending. The local Edge preview does not currently contain an authenticated administrator session, so `/admin/channels/monitor` redirects to the login route.

Required before final completion:

- `1440px`, `900px`, and `390px` captures for V1 loading, success, empty, failure, long values, and pending row actions.
- V2 settings, V1 legacy configuration, template dialog, run result dialog, filters, table scrolling, keyboard order, dark mode, and reduced motion.
- Browser console error/warning check with a real administrator session.

No browser storage, database account, password, or route guard was changed to bypass authentication.

## Remaining Work And Risks

- The admin history endpoint is still not exposed as a dedicated history view. The inactive V1 tab now accurately identifies its current content as legacy configuration.
- Backend runner cancellation, scheduler/manual-run mutual exclusion, and explicit `body_override: null` persistence require backend changes and remain outside this frontend-only objective.
- These remaining items prevent treating the whole channel-monitor domain as finally accepted; this batch closes the frontend state and interaction defects listed above.
