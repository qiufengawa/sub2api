# R60 Admin Channel Monitor History Acceptance

## Scope

- Route: `/admin/channels/monitor`
- History API transport: `frontend/src/api/admin/channelMonitor.ts`
- Main workspace: `frontend/src/views/admin/ChannelMonitorView.vue`
- Row actions: `frontend/src/components/admin/monitor/MonitorActionsCell.vue`
- History dialog: `frontend/src/components/admin/monitor/MonitorHistoryDialog.vue`
- Chinese and English channel-monitor labels
- Component and integration tests for the files above

## Implemented

- Adds a clock action to every legacy monitor row and opens history for the selected monitor.
- Displays check time, model, status, response latency, ping latency, and the check message in a dense comparison table.
- Supports all-model or per-model filtering and the latest 25, 50, or 100 results.
- Uses a table skeleton only during the first load; later refreshes retain current rows and expose a workspace refresh state.
- Distinguishes initial failure, empty history, and refresh failure with persistent retry or inline error states.
- Cancels superseded requests, ignores late responses, and aborts active history requests when the dialog closes or unmounts.
- Keeps the same horizontally scrollable data table on mobile instead of converting history rows into large cards.

## Preserved Contracts

- The history endpoint remains `GET /admin/channel-monitors/:id/history` with the existing `model` and `limit` query parameters.
- The API transport only adds an optional `AbortSignal`; response fields and existing callers are unchanged.
- Monitor create, edit, duplicate, delete, enable, manual run, filtering, pagination, and V1/V2 selection are unchanged.
- History is read-only and does not alter monitor configuration or runtime state.

## Automated Verification

Run on 2026-08-17:

```text
pnpm exec vitest run \
  src/components/admin/monitor/MonitorHistoryDialog.spec.ts \
  src/components/admin/monitor/MonitorActionsCell.spec.ts \
  src/views/admin/__tests__/ChannelMonitorView.duplicate.spec.ts
Result: 3 files, 22 tests passed

pnpm exec vitest run --reporter=dot
Result: 328 files, 2158 tests passed

pnpm exec vue-tsc --noEmit --pretty false
Result: passed

pnpm run lint:check
Result: passed

pnpm run build
Result: 3119 modules transformed; built in 42.63s

git diff --check
Result: passed
```

The build retains the existing Browserslist data-age, mixed static/dynamic import, large-chunk, Node `DEP0190`, and `lottie-web` `eval` warnings. No new production build error was introduced by this batch.

## Browser Acceptance

Pending. The local Edge preview does not currently contain an authenticated administrator session, so the protected monitor workspace cannot be truthfully accepted in-browser yet.

Required before final completion:

- `1440px`, `900px`, and `390px` captures for initial loading, populated history, empty history, initial error, refresh failure, and long values.
- Verify model and result-limit filters, refresh, close cancellation, horizontal table scrolling, and keyboard order.
- Verify light mode, dark mode, reduced motion, and browser console output with a real administrator session.

No browser storage, database account, password, fixture data, or route guard was changed to bypass authentication.

## Review Result And Remaining Risks

- Structured review found no blocking frontend defect in this batch.
- The frontend `HistoryItem` fields match the backend history response, including nullable latency fields.
- Backend runner cancellation, scheduler/manual-run mutual exclusion, and explicit `body_override: null` persistence remain outside this frontend-only objective and are tracked by R59.
- Browser acceptance remains the only open gate for this batch.
