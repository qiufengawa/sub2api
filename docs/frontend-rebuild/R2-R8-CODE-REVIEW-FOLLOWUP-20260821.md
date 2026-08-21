# R2-R8 continuation code-review follow-up — 2026-08-21

This is a scoped continuation review, not the final R0-R9 approval. It records
the source changes and verification performed in this run without absorbing
the pre-existing ignored final-review working file.

## Reviewed source changes

- `frontend/src/components/layout/AppHeader.vue`: the identity column now uses
  `flex: 1 1 0` with `min-width: 0`, allowing long route titles/descriptions to
  yield space to account actions. Chromium recheck removed the observed
  `/admin/audit-logs` overflow at desktop and tablet widths.
- `frontend/src/views/admin/ChannelsView.vue`: added the missing `UiTabs`
  runtime import used by the pricing tabs. Chromium recheck has no unresolved
  component warning on `/admin/channels/pricing`.
- `frontend/src/i18n/locales/en/admin/accounts.ts` and
  `frontend/src/i18n/locales/zh/admin/accounts.ts`: added the `expired` status
  message used by the account table.
- `frontend/src/views/admin/AccountsView.vue`: initial table-load rejection is
  now caught and surfaced through the localized error toast instead of becoming
  an unhandled page error; the first-load `lite` parameter is cleaned on
  rejection and overlapping loads are fenced by a sequence token.
- `frontend/src/composables/useTableLoader.ts`: pagination and page-size actions
  now return the underlying load promise, allowing Accounts to surface those
  failures instead of leaving detached requests.
- `frontend/src/components/ui/__tests__/UiConsumerInventory.spec.ts` and
  `UI.MD`: synchronized the runtime consumer reference gate to 1,884 after the
  real `UiTabs` import was restored.

No backend, version, release, deployment, or shared database source was
changed in this continuation.

## Verification

The durable gate record is
`evidence/20260821/gate-results.json`; the protected-page and fixture report is
`R2-R8-CONTINUATION-20260821.md`. Highlights:

- 171 user and 216 administrator route-label Chromium cases at actual
  1440/900/390 widths, light/dark/reduced-motion, ARIA snapshots, keyboard
  traces, request failures and console capture.
- User matrix: zero overflow, navigation errors, console/page errors and
  failed requests. Administrator matrix: zero overflow, navigation errors,
  unexpected page errors and failed requests. The 3,537 email-preview iframe
  `SecurityError` values remain explicitly classified as expected sandbox
  boundary evidence.
- Local provider fixtures cover Playground SSE/image/abort/storage denial,
  Batch Image create/cancel/retry/delete, and WeChat/Stripe/Airwallex browser
  contracts. Isolated signed callbacks and refund mutations are recorded as
  local fixtures, not external settlement claims.
- Frontend Vitest (`359` files / `2,431` tests), static audit (`13` tests),
  typecheck, ESLint, production build (3,103 modules), `git diff --check`, and
  backend routes/service/repository tests passed.
- The focused Accounts scheduler/error-recovery suite passed 8 tests; the
  local error fixture now has zero page errors after the catch boundary.
- The composable plus six Accounts suites passed 59 focused tests after the
  pagination promise and stale-response boundaries were added.
- `keyboard-overlay-summary.json` records ten real Chromium Enter/Space/Escape
  overlay checks with 10/10 focus restoration and zero console/page errors.
- `payment-double-tab.json` verifies scoped recovery cleanup across two pages in
  one BrowserContext; tab A succeeds without removing tab B's recovery state.
- `admin-state-remaining-summary.json` adds 54 page-specific empty/slow/error
  probes across ten more administrator routes, with six dashboard guard cases
  explicitly kept separate.

## Open findings

The final gate remains open for native screen-reader execution, credentialed
external provider settlement/refund and two-tab return, a complete per-page
slow/empty/error/late-response matrix, and severity-signed review of all
exception pages. The single R0-R9 task remains active.
