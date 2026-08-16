# R54 Admin Affiliate Records Acceptance

## Scope

This batch covers the three administrator affiliate record routes backed by the shared `AdminAffiliateRecordsTable` workspace:

- `/admin/affiliates/invites`
- `/admin/affiliates/rebates`
- `/admin/affiliates/transfers`

## Implementation Audit

The production implementation already uses the current UI contracts and does not retain a page-local legacy visual layer:

- `AppPage` and one `AppPageHeader` define the page hierarchy.
- `UiServerTableWorkspace`, `UiTableToolbar`, `UiFilterBar`, `UiSearchInput`, and `UiPagination` define the server-list workflow.
- `UiDataTable` keeps desktop and mobile list semantics through `mobile-table`.
- `UiDataCell`, numeric formatting, and time formatting preserve scan and comparison behavior.
- `UiDialog`, `UiSkeleton`, `UiErrorState`, and `UiDescriptionList` implement the user overview flow.
- List and overview requests use monotonically increasing request IDs so stale responses cannot replace current state.
- Search, date range, pagination, page size, server sort, timezone, and persisted sort contracts remain intact.

No production template or style change was required in this batch.

## Automated Verification

Executed from `frontend/`:

```bash
pnpm exec vitest run src/views/admin/affiliates/__tests__/AdminAffiliateRecordsTable.spec.ts
pnpm exec vue-tsc --noEmit
pnpm exec eslint \
  src/views/admin/affiliates/AdminAffiliateRecordsTable.vue \
  src/views/admin/affiliates/AdminAffiliateInvitesView.vue \
  src/views/admin/affiliates/AdminAffiliateRebatesView.vue \
  src/views/admin/affiliates/AdminAffiliateTransfersView.vue \
  src/views/admin/affiliates/__tests__/AdminAffiliateRecordsTable.spec.ts
git diff --check -- frontend/src/views/admin/affiliates
```

Results:

- Vitest: 1 file passed, 10 tests passed.
- TypeScript: passed.
- ESLint: passed.
- Diff whitespace check: passed.

The suite covers all three record types, valid persisted server sort, invalid date boundaries, stale list response protection, list error retry, overview error retry, overview close/late-response protection, page-size reset, and server sorting.

## Browser Gate

Status: pending.

The local preview is available at `http://127.0.0.1:4174`, but it correctly redirects the three administrator routes to login. The real local PostgreSQL administrator is `admin@admin.com`; the repository example password does not authenticate. The database was not modified and no temporary password or authentication bypass was introduced.

The following evidence is still required before this batch can be counted complete:

- Signed-in renders at `1440x900`, `900x900`, and `390x844`.
- Invites, rebates, and transfers tables retain comparison columns and controlled horizontal overflow.
- Search, date validation, sorting, pagination, refresh, empty, error, and overview dialog states.
- Dark mode, reduced motion, keyboard focus order, accessible names, and zero page-level horizontal overflow.
- Browser console contains no newly introduced errors or warnings.

Until those items are recorded, R54 improves the automated contract but does not close the R6 browser acceptance gate.
