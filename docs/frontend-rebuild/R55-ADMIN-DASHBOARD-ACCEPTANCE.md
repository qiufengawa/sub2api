# R55 Admin Dashboard Acceptance

## Scope

R55 closes the administrator dashboard's missing snapshot-error state while preserving its existing metrics, chart requests, quick actions, date range, granularity, rankings, and stale-response protection.

## Fixed Behavior

- An initial snapshot failure now renders a persistent `UiErrorState` instead of leaving a title-only blank page.
- The error state exposes a localized retry action that reloads the complete dashboard request group.
- A refresh failure after statistics already exist keeps the previous metrics and charts visible.
- That non-destructive refresh failure is shown inline through `UiAlert`; it is no longer represented only by a transient toast.
- Starting a newer dashboard request invalidates an older request. A stale failure cannot replace a newer successful snapshot or turn its state into an error.
- A malformed initial snapshot without statistics follows the same explicit error path.

## Preserved Contracts

- The default query remains the previous 24 hours in local calendar dates with hourly granularity.
- Date-range changes still select hourly granularity for one day and daily granularity for longer ranges.
- Snapshot, user trend, and spending ranking requests remain parallel.
- Existing statistics remain visible during local refresh.
- Ranking navigation continues to deep-link to `/admin/usage` with user and date query parameters.
- Batch Image visibility continues to use `useBatchImageAccess`.
- No API, type, route, permission, storage, or backend behavior changed.

## Automated Verification

Executed from `frontend/`:

```bash
pnpm exec vitest run src/views/admin/__tests__/DashboardView.spec.ts
pnpm exec vue-tsc --noEmit
pnpm exec eslint \
  src/views/admin/DashboardView.vue \
  src/views/admin/__tests__/DashboardView.spec.ts
git diff --check -- \
  frontend/src/views/admin/DashboardView.vue \
  frontend/src/views/admin/__tests__/DashboardView.spec.ts
```

Results:

- Vitest: 1 file passed, 4 tests passed.
- TypeScript: passed.
- ESLint: passed.
- Diff whitespace check: passed.
- Expected error logging is captured and asserted; the test run has no unexpected stderr.

The tests cover the default range and navigation, initial failure and retry, stale-data preservation on refresh failure, and stale failure suppression after a newer success.

## Browser Gate

Status: pending.

The local preview correctly requires administrator authentication. The database and administrator password were not modified for this visual-only goal. Before R55 is counted as fully accepted, a signed-in session must verify:

- `1440x900`, `900x900`, and `390x844` layouts.
- Stable eight-metric skeleton geometry during initial loading.
- Initial error, retry recovery, inline refresh error, empty charts, and slow refresh.
- Date range and granularity alignment, chart containment, long translated text, and large numeric values.
- Dark mode, reduced motion, keyboard order, accessible names, and zero page-level horizontal overflow.
- No newly introduced browser console errors or warnings.

This record proves the automated behavior fix but does not substitute it for the outstanding signed-in browser evidence.
