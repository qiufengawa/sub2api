# R2-R8 continuation — 2026-08-22 accessibility and failure-state follow-up

This is a continuation checkpoint, not final R0-R9 approval. It records the
new source fixes and isolated Chromium evidence produced after the 2026-08-21
matrix. The single long-running R0-R9 task remains active.

## Findings fixed

- `frontend/src/views/admin/SettingsView.vue` now renders an explicit
  `role="alert"` error surface with a Retry action when the primary settings
  request fails. The editable form is not mounted while `loadFailed` is true,
  preventing subsection save buttons from submitting default/unloaded values.
  The retry path returns to the form after a successful response.
- Every SettingsView `Toggle` now supplies a semantic `label`; this removes the
  generic `切换` accessible name from the gateway, feature, security, payment,
  email, users and general tabs.
- `frontend/src/components/ui/UiCheckbox.vue` mirrors its visible `label` (or
  an incoming `aria-label`) to the native input. `UiTextArea.vue` now generates
  a stable per-instance id when needed and associates its `UiFormField` label
  and description with the textarea.
- `frontend/src/components/layout/AppSidebar.vue` tracks the mobile media
  query and applies `inert` plus `aria-hidden="true"` only while the off-canvas
  sidebar is closed on mobile. Desktop navigation remains available. The
  component removes the media listener on unmount. The mobile menu trigger now
  exposes `aria-expanded`/`aria-controls`; opening traps Tab focus in the
  sidebar, Escape closes it, and closing restores focus to the trigger. The
  workspace is inert while the mobile overlay is active.
- Repeated controls now carry context-specific accessible names without
  widening the compact payment layout: Claude system-block cache switches
  include their row number, quota-notification email switches include the
  email (or row number), and payment-provider switches expose a provider-
  qualified accessible label while retaining their compact visible caption.
  A successful Settings retry moves focus to the first tab after the form is
  remounted.
- `frontend/src/components/ui/AppPage.vue` now renders a neutral `div`; the
  surrounding `AppLayout` owns the single `main` landmark, removing the
  nested-main pattern present on most protected pages.

## Verification

Durable artifacts and SHA-256 entries are under
`evidence/20260822/`:

`SHA256SUMS.txt` currently covers 16 JSON artifacts listed below; earlier
checkpoint paragraphs that say 13, 14 or 15 refer to the artifact set at that
time.

- `batch-image-api-contract-20260822.json` records eight deterministic frontend
  route-contract tests for the Batch Image gateway surface. The fixture checks
  authenticated create/list/models/detail/items/cancel/download/content,
  paginated item options, deferred object-URL cleanup and the separate
  record/output delete routes, including encoded identifiers and structured
  error/request-id handling. It stubs `window.fetch`; it is not a live backend,
  provider, object-storage or external-settlement run.

- `protected-browser-matrix-20260822.json`: an isolated Chromium capture of
  all 19 user routes (171 runs) and 24 administrator labels (216 runs) at
  1440×1000, 900×900 and 390×844 in light, dark and reduced-motion modes.
  The sanitized per-run manifest records route, viewport, mode, geometry,
  console/page/request diagnostics, AX snapshot hashes and eight Tab samples.
  Both roles have zero overflow, navigation errors, failed requests and
  console error/warning entries. The administrator capture retains 3,537
  expected sandbox iframe `SecurityError` values and zero unexpected page
  errors; the user capture has zero page errors. This is authenticated local
  Chromium evidence, not native VoiceOver/NVDA or credentialed external
  provider evidence.

- `admin-settings-state-matrix.json`: six `/admin/settings` cases (empty,
  1.6-second slow response and 503 error at 1440×1000 and 390×844). All six
  main requests were intercepted; there was zero overflow, navigation error or
  failed request. The slow timings were approximately 1.65 seconds. Both error
  cases hid the form, exposed the alert and Retry control, and recovered to a
  mounted form after the retry response. Each case records one sandbox iframe
  `SecurityError` (six total) as the existing expected sandbox boundary; no
  unexpected page errors occurred.
- `settings-ax-tabs-summary.json`: every one of the nine Settings tabs across
  light and dark+reduced-motion at desktop and mobile (36 cases). Chrome's AX
  tree found zero unnamed interactive nodes, zero generic default switch names,
  zero overflow cases and exactly one main landmark per case.
- `ax-tree-summary.json`: eight representative protected routes across
  light/dark-reduced and desktop/mobile (32 cases). There are zero overflow,
  navigation errors, failed requests or unnamed interactive nodes. The
  aggregate has four expected sandbox iframe `SecurityError` page errors and
  zero unexpected page errors; `pageErrorClassification` records the exact
  message and the four `/admin/settings` mode/viewport cases. All cases have
  one main landmark. The 16 mobile closed-sidebar cases expose
  `inert=true` and `aria-hidden=true`; the first eight real Tab stops begin at
  the page header rather than off-canvas sidebar links.
- `gate-results-20260822.json`: focused Vitest and browser gate counts for this
  follow-up. Its early post-fix full frontend count (362 test files / 2,502 tests)
  is a historical checkpoint; the current local run is 363 test files / 2,531 tests.
  Static audit (14), typecheck, ESLint, production build (3,103 modules) and
  `git diff --check` also passed.
- `coverage-manifest.json` makes the state-matrix denominator explicit: 18
  administrator routes × 3 states × 2 viewports = 108 cases, with 102
  page-specific interceptions and six `/admin/dashboard` guard cases. It also
  indexes the 24-label/216-run admin baseline, 171-run user baseline, the full
  protected-browser capture, Settings state cases and representative AX routes
  without implying that guard cases or browser AX replace native reader
  evidence. Its route inventory reconciles the 24 current router pages with
  the 23 production navigation pages, the historical `/admin/backups` label,
  and the four routes still missing page-specific state fixtures.
- `ops-system-log-mutation.json`: the Ops system-log cleanup and runtime-reset
  confirmations now retain their filter/config context after a failed request,
  reject duplicate confirmation while pending, and close only after success.
  The focused suite passes 7 tests using local API mocks; it is a unit fixture,
  not evidence of an external provider or production settlement.
- `payment-mutation-guards.json`: affiliate reset and payment-provider delete
  confirmations now retain their action after a rejected request and lock
  duplicate/cancel paths while pending. `AdminRefundDialog` disables its
  cancel/Escape/close paths during an in-flight refund, while
  `AdminOrdersView` guards the parent close callback and uses an internal
  completion path for successful/pending responses. The payment/refund subset
  adds four focused tests; the full mutation evidence file records 37 new tests
  across payment, destructive and administrator partial-result boundaries,
  including provider-toggle serialization, cascade-failure recovery, save fencing,
  out-of-order refresh, delete-refresh, cross-provider conflict and successful
  affiliate-transfer/local-quota refresh-failure fixtures. The
  existing Ops seven-test suite and all of these tests use local API mocks only.
- The same evidence now covers seven additional destructive confirmations:
  Batch Image deletion, affiliate quota transfer, Ollama session deletion,
  scheduled-test-plan deletion, OpenAI quota reset, platform quota reset and
  Accounts export. Each failed-mutation fixture keeps its target/action for a
  retry; successful paths close normally. Eight focused tests pass with
  local API mocks only.
- The Batch Image cancellation fixture also snapshots the batch and API-key
  identity at confirmation time, so changing the detail selection cannot make
  a pending cancel request target a different job.
- Additional administrator mutation boundaries now retain only failed/skipped
  IDs after partial Accounts/Proxies batch results, and clear successful Monitor
  Template/Risk Control targets before their best-effort status/list refresh.
  Eight focused tests cover these cases, including deriving failed Accounts
  reset/refresh IDs from per-account error details exposed by older API
  responses; this closes the confirmed duplicate-mutation findings while
  leaving broader untested per-page mutation coverage as an explicit open gate.
- The backend route package now includes a regression assertion that `GET
  /v1/images/batches/models` remains registered ahead of the dynamic
  `/v1/images/batches/:id` route. `go test ./internal/server/routes` passes with
  a temporary Go build cache; this does not claim a populated provider or
  download flow.
- A direct `go test ./internal/payment/provider -count=1` run is intentionally
  recorded as **not green** rather than hidden: EasyPay query-status mapping
  subtests reported failures, and the parallel `httptest.NewServer` fixtures
  then hit the shell's denied loopback bind (`listen tcp6 [::1]:0: bind:
  operation not permitted`). The package needs a listener-capable rerun and
  follow-up on the mapping assertions before it can be promoted to a backend
  provider pass.
- The system-related backend checks also ran locally: the tagged admin system
  handler suite passed its update/rollback idempotency and client-disconnect
  cases, and the service suite passed system-operation lock lease/recovery plus
  Ops system-log checks. These are local unit checks and do not close the
  credentialed provider or protected-browser gates.
- The same read-only system audit found `GetVersion` currently discards the
  `CheckUpdate` error before dereferencing the returned info. Backend source is
  outside this frontend-owned change set, so this remains a follow-up review
  item rather than an untracked backend edit.
- `a11y-focus-contracts.json` indexes the source-level mobile focus, repeated
  switch naming and Settings retry-focus contracts. Its checks are Vitest/source
  evidence only, not native reader or fresh browser-matrix evidence.
- `native-reader-probe.json` records the local macOS AX/System Events probe:
  `osascript` is present but System Events returns `-10827`, VoiceOver queries
  report an invalid XPC connection, and NVDA is absent. This documents why the
  native reader gate remains open rather than treating the probe as a pass.
- `public-home-browser-20260822.json` is a fresh in-app Chromium smoke check of
  the unauthenticated `/home` route (1280×720): one main landmark, no horizontal
  overflow, and no error/warning console entries. A follow-up in-app probe also
  recorded 21 links, 3 buttons, one main landmark and exact 1272px layout width;
  it deliberately did not re-read console entries. This artifact is not counted
  as protected-page or authenticated evidence.
- Custom URL embeds on Home and Custom Page now use a restrictive sandbox
  (`allow-scripts allow-forms allow-popups allow-presentation`) with
  `referrerpolicy="no-referrer"`; component fixtures assert the boundary and
  retain the existing URL/class contract. The sandbox intentionally omits
  `allow-same-origin`, so pages that require same-origin storage may need an
  HTML-mode implementation instead. This is source/component evidence, not a
  live cross-origin iframe success matrix.
- `auth-guard-smoke-20260822.json` records an anonymous navigation to
  `/admin/dashboard` redirecting to `/login?redirect=/admin/dashboard` with one
  main landmark and no horizontal overflow. It verifies the route guard only;
  authentication was not attempted.
- The post-fix frontend gate is now **362 test files / 2,502 tests**; the
  SettingsView/layout focused count is 63, static audit remains 13, and the
  typecheck, lint, 3,103-module build and diff-check remain green.
- Provider field/type mutations now share a global queued task fence with per-provider duplicate guards. Disabling
  a payment type waits for any in-flight provider field/type update instead of
  skipping that provider, and payment-type buttons are locked while their
  cascade is running. A successful field/type mutation updates local state
  before the best-effort provider refresh, so a refresh failure cannot make a
  subsequent retry invert an already-successful server mutation. Nine focused
  SettingsView fixtures cover duplicate clicks, cross-control serialization,
  cascade recovery, save fencing, response ordering, delete-refresh cleanup,
  cross-provider conflict serialization and refresh failure; all calls remain
  local API mocks.

### Latest provider mutation fence (2026-08-22)

- The provider list now disables refresh/create/drag/card controls while any provider
  mutation or the main settings save is pending. Provider API mutations share one
  queue, while per-provider task IDs still reject duplicate clicks. Payment-type
  cascades wait for queued field updates, restore the type on a failed disable, and
  surface a retryable error.
- Provider list reads carry sequence/state-version guards. Older out-of-order responses
  are ignored, and a successful delete removes its local card before a best-effort
  refresh so a refresh failure cannot leave a second actionable delete target.
- Edit responses use only non-sensitive list fields for optimistic reconciliation;
  submitted provider `config` values (API keys/secrets) are never retained in the
  optimistic provider-card patch. The empty-list create action is also disabled
  while any provider mutation or settings save is pending.
- Eight additional SettingsView fixtures cover cascade rejection, save lock, out-of-order
  reads, eventual-consistency stale refresh protection, delete-plus-refresh failure, and
  cross-provider visible-method conflict serialization, sensitive-config optimistic
  patch exclusion, and imperative save-race fencing. The SettingsView suite is 58 tests; SettingsView plus layout is 63;
  full frontend is 362 files / 2,502 tests. These remain local Vitest API mocks and do
  not expand external payment or protected-browser evidence.

The AX tree and Tab traces are browser accessibility evidence, not native
VoiceOver/NVDA execution. The full protected-browser artifact is a verified
isolated capture from 2026-08-21; it does not retroactively prove the latest
source-level focus changes and its expected iframe sandbox errors remain
explicitly classified. The native reader gate, credentialed external
Stripe/WeChat/Airwallex settlement/refund, external return flow, complete
per-page slow/empty/error/late-response coverage, uncovered administrator
mutation edges, the backend-owned system version error-boundary review and
final severity-signed Code Review remain open.

### Latest local contract follow-up (2026-08-22)

- Added `frontend/src/api/__tests__/batchImage.spec.ts` and the durable
  `evidence/20260822/batch-image-api-contract-20260822.json`. Eight tests cover
  the Batch Image gateway request contract, encoded identifiers, paginated item
  options, binary download/preview responses, separate record/output deletion,
  deferred object-URL cleanup, and structured error/request-id handling. This
  remains a fetch-stub fixture, not a live backend/provider/object-storage run.
- Batch Image's generated agent instruction now lists item-content preview,
  record/output deletion and failed-item-only retry with `parent_batch_id`, and
  distinguishes the page's fixed 8-second refresh cadence from the server's
  `Retry-After`/SLA. The instruction is not evidence of a provider run.
- Home and Custom Page external URL embeds now use a restrictive sandbox and
  `referrerpolicy="no-referrer"`; component fixtures assert the attributes and
  document the intentional omission of `allow-same-origin`. This closes a
  source/component iframe isolation gap while leaving live cross-origin iframe
  success/error coverage open.
- Provider imperative handlers now apply the same save/mutation fence as the
  rendered controls. Provider edit optimistic reconciliation excludes sensitive
  `config` fields; the current SettingsView suite is 58 tests, SettingsView
  plus layout is 63, and the full frontend run is **362 files / 2,502 tests
  passed**. Additional pagination and affiliate-refresh fixtures are recorded
  below.
- The remaining gates are unchanged: fresh authenticated protected-browser
  capture after these source edits, missing administrator state/mutation and
  late-response cases, native VoiceOver/NVDA, credentialed external payment
  settlement/refund/return, listener-capable backend provider rerun, the
  backend-owned system version error boundary, and severity-signed final Code
  Review.

### Latest local Batch Image retry follow-up (2026-08-22)

- `listBatchImageItems` now accepts `status`/`limit`/`cursor` options while
  preserving the historical status-string call shape. `ensureItemsForRetry`
  walks every failed-item page (with an empty-page loop guard) before building
  the retry payload, so a batch with more than the backend's default 100-item
  page no longer silently omits later failures. The retry fixture resolves two
  pages and asserts all four prompts are submitted.
- `saveBlob` defers `URL.revokeObjectURL` until after the anchor click; the
  Batch Image API contract fixture now has 8 tests, and the view retry-pagination
  fixture adds 2 tests covering retry payloads and large-detail rendering. These
  are local Vitest/fetch mocks only and do not prove live provider, object-storage,
  ZIP, or external-payment behavior.
- The current local frontend run is **362 test files / 2,502 tests passed**;
  SettingsView plus layout is 63 tests, RiskControlView is 14, and
  BatchImageGuideView is 22. AffiliateView now also removes the successful
  transfer action locally before a failed detail refresh (7-suite fixture and
  two affiliate mutation cases in the local guard index).
  Typecheck, lint, 3,103-module build, static audit,
  and SHA-256 evidence verification remain green.
- Open gates remain unchanged: fresh authenticated protected-browser capture
  after source edits, complete administrator state/mutation and late-response
  coverage, native VoiceOver/NVDA, credentialed external Stripe/WeChat/Airwallex
  settlement/refund/return, listener-capable provider rerun, backend-owned
  system version error handling, live Batch Image provider/storage/download and
  destructive evidence, live iframe matrix, and severity-signed final Code
  Review.

### Latest local hardening checkpoint (2026-08-22)

- The current worktree frontend gate is **362 test files / 2,512 tests passed**.
  `pnpm run test:audit` remains 13/13, `vue-tsc`, ESLint, the 3,103-module
  production build and `git diff --check` are green. The 2,502-test count above
  is retained as the prior checkpoint; the current gate result is recorded in
  the 2026-08-22 evidence JSON and its checksum entry.
- `ChannelsView` status toggles now use an ID-scoped single-flight guard;
  Groups create/update/sort and Proxies create/update/batch-create handlers
  reject duplicate imperative submissions in addition to button-level loading
  states. Focused fixtures cover the function-boundary behavior.
- Batch Image now paginates active API keys, snapshots retry detail context,
  excludes already recovered retry-child items, fences late submit/retry
  responses from replacing a newly selected detail, and exposes a confirmed
  output-delete action. Successful output deletion invalidates the job cache,
  purges that batch's IndexedDB previews, and does not clear previews belonging
  to a detail selected while the request was pending. These remain local
  Vitest/API fixtures; they do not prove live provider, storage, ZIP or
  concurrency behavior.
- Retry-generated item IDs now include a per-item suffix, so distinct source
  IDs that sanitize to the same visible base cannot collide within one retry.
  The BatchImageGuideView focused suite is 29/29.
- `GET /api/v1/admin/system/version` now returns an error response when
  `CheckUpdate` fails or yields nil instead of dereferencing a nil update
  record. Tagged handler tests cover success and failure paths; this backend
  error-boundary item is no longer listed as an open gate.
- Remaining gates are unchanged otherwise: fresh authenticated protected
  Chromium after source edits (including current `/admin/ui-system` and the
  missing state routes), native VoiceOver/NVDA, listener-capable provider
  rerun/EasyPay mapping, credentialed external payment settlement/refund/return,
  live Batch provider/storage/download/destructive evidence, live iframe
  matrix, complete per-page state/late-response and mutation coverage, and
  severity-signed final Code Review.

### Latest Batch Image backend contract hardening (2026-08-22)

- Batch Image preview responses no longer call the ZIP-download marker. The
  `downloaded_at` field remains tied to a successful ZIP response, while item
  previews use `Cache-Control: private, no-store` so an output cleanup/expiry
  cannot be served from an intermediary cache.
- ZIP generation now selects success/failed/all item sets from the documented
  `status` query and assembles the archive in a private temporary file in the
  HTTP handler before committing response headers. Provider/JSONL/size errors
  consequently remain typed error responses instead of becoming a misleading
  HTTP 200 partial archive.
- The public queued alias now covers the complete `created`/`uploading`/
  `submitted` lifecycle through a repository `status IN (...)` filter. New
  custom IDs are restricted to route-safe ASCII segments (letters, digits,
  `-`, `_`, `.` and a 255-character limit), preventing an API-created item
  that can be listed or zipped but cannot be addressed by the Gin content
  route.
- Submit idempotency now has a partial unique owner/API-key index migration
  and a create-conflict recovery path. Concurrent callers that race the
  read-before-create lookup resolve to the existing matching request (or a
  conflict for a different request hash) rather than creating duplicate jobs
  and billing holds. A production rollout still needs duplicate-data preflight.
- Frontend bulk download/delete actions continue after per-row failures and
  retain failed IDs for retry; the UI reports completed/failed counts in both
  locales. These local controls do not claim live provider, object-storage,
  ZIP-byte, concurrency or destructive-flow evidence.
- Targeted local checks passed:
  `GOCACHE=/tmp/sub2api-gocache go test -tags=unit ./internal/service -run
  'TestBatchImagePublicService_(Submit|List)|TestBatchImageDownloadService|
  TestBatchImageDownloadAfterOutputDeleted|TestBatchImageCleanupService' -count=1`,
  `GOCACHE=/tmp/sub2api-gocache go test ./migrations -count=1`, and
  `GOCACHE=/tmp/sub2api-gocache go test ./internal/server/routes -count=1`.
  The full frontend gate remains **362 test files / 2,512 tests passed**;
  typecheck, lint, build and diff-check remain green.
- These changes close local contract defects only. Live Batch Image
  provider/storage/download/concurrency/destructive evidence, fresh protected
  Chromium after source edits, native VoiceOver/NVDA, credentialed external
  payment settlement/refund/return, complete per-page state/late-response
  coverage and severity-signed final Code Review remain open.

### Latest local closure pass (2026-08-22)

- The latest local frontend gate is **362 test files / 2,515 tests passed**.
  `pnpm run test:audit` is 13/13; `vue-tsc --noEmit`, ESLint, the 3,103-module
  production build, and `git diff --check` also pass. The 2,515 count is the
  current evidence value in `gate-results-20260822.json`,
  `coverage-manifest.json`, and `a11y-focus-contracts.json`.
- Batch Image detail loading now discovers retry children outside the visible
  jobs page and merges them into root aggregation/detail item requests. The
  request sequence is invalidated on selection changes, so a late page-2
  response cannot contaminate a different detail. The focused
  `BatchImageGuideView.spec.ts` run is 30/30; this remains local fixture
  evidence rather than a live provider/storage/ZIP run.
- Stripe webhook routing now extracts `data.object.metadata.orderId` before
  provider lookup, allowing supported multi-instance Stripe configurations to
  bind the pinned instance. Provider lookup failures now distinguish an
  unconfigured-provider acknowledgement from ambiguous/transient lookup
  errors, which remain retryable HTTP failures. Handler contract tests cover
  Stripe metadata, malformed/missing IDs, and the lookup status boundary.
- Migration 222's owner/API-key/idempotency unique-index preflight now reports
  actionable duplicate rows before attempting the index; clean and duplicate
  sqlmock fixtures pass. This is a rollout guard, not a substitute for a
  listener-capable production-like database rehearsal.
- Evidence JSON was refreshed for these local checks and all 13 entries in
  `evidence/20260822/SHA256SUMS.txt` verify successfully.
- Release gates remain open for a fresh authenticated protected-browser run
  after the latest source edits (including current `/admin/ui-system` and
  missing page-state routes), native VoiceOver/NVDA, credentialed external
  Stripe/WeChat/Airwallex settlement/refund/return, listener-capable provider
  reruns, complete administrator state/mutation/late-response coverage, live
  Batch provider/storage/download/destructive evidence, the live iframe
  cross-origin matrix, and the final severity-signed Code Review.

### Latest Batch aggregate-download hardening (2026-08-22)

- The Batch Image ZIP service now builds an owner-scoped source plan for a
  root job and its direct retry children. A failed/cancelled root is
  downloadable only when completed child output covers every root input item;
  pending, output-deleted, or foreign-key children are rejected rather than
  silently omitted. Each source resolves its own provider/account output and
  the archive merges images and manifest counts under the root batch ID.
- Aggregate item limits are checked before any provider output is opened.
  Manual root output deletion preflights active children and cleans eligible
  retry-child outputs through the same cleanup boundary, preventing a root
  delete from leaving child provider objects behind. Existing single-job and
  failed-only ZIP semantics remain covered.
- Targeted service/repository tests pass for aggregate ZIP output, pending and
  foreign-child isolation, aggregate limits, output cleanup, and migration
  preflight. These are local fakes/sqlmock; they do not close live provider,
  object-storage, network ZIP, or external destructive-flow gates.
- The frontend aggregate-download fixture now has a matching backend contract;
  any live acceptance still needs a real provider result for both root/child
  sources, a storage cleanup assertion, and a three-viewport authenticated
  browser capture.

### Latest local verification checkpoint (2026-08-22)

After the Prompt Audit criteria-generation fence, Batch retry-ID bound, detail-child cleanup, preview-cache invalidation generation, and failed-root output cleanup updates, the full frontend Vitest run completed **362 files / 2,516 tests passed**. `vue-tsc --noEmit`, ESLint, static audit (13 tests), and the focused Prompt Audit/Batch suites also pass. Evidence JSON test counters were updated to 2,516 and SHA256SUMS was regenerated. This remains a local fixture checkpoint; the protected authenticated browser rerun, native VoiceOver/NVDA, credentialed provider settlement/refund, and live Batch provider/storage/ZIP gates remain open.

### Durable Batch route-mock fixture (2026-08-22)

Added `evidence/20260822/batch-image-route-mock-20260822.json` and `frontend/src/api/__tests__/batchImage.route-mock.spec.ts`. The stateful, listener-free fetch dispatcher exercises the actual frontend Batch API functions across synthetic owner keys: models, submit/idempotency replay and conflict, list/detail/items pagination, owner isolation, pending-to-success item content, ZIP Blob/download state, cancel, output deletion, and record deletion. The fixture records route method/path/query/status/request-id/body-hash assertions and is explicitly marked fixture-only; it does not claim Gin, provider, object-storage, live ZIP, or external destructive-flow evidence.

### Evidence count reconciliation (2026-08-22)

Earlier continuation paragraphs retain 2,502/2,512/2,515 as historical checkpoints. The latest verified repository-wide frontend run is **362 files / 2,516 tests passed**; current evidence JSON counters and the latest checkpoint use 2,516. Earlier references to the system-version error boundary are historical: the handler fix and focused tests are now green.

### Latest route-mock regression count (2026-08-22)

The repository-wide Vitest rerun after adding the listener-free Batch Image
route-mock fixture completed **363 test files / 2,519 tests passed**. Typecheck,
ESLint, the 13-test static audit, the 3,103-module production build, and
`git diff --check` also pass. The evidence directory now contains **14 JSON
artifacts** (the route-mock artifact is the newly added fixture); the complete
set is indexed and verified by `SHA256SUMS.txt`. This remains fixture-only
evidence and does not close the protected-browser, native-reader, external
payment, or live Batch/provider/storage gates.

The same rerun includes the RiskControl `loadAll` generation fence and the
current admin-route metadata contract (UI system, promo codes, risk/prompt
audit, and payment order pages). These are local Vitest/source contracts; the
authenticated three-viewport state and AX captures remain open.

The same rerun includes the new RiskControl `loadAll` generation fence: a
slower initial page load cannot overwrite a newer load's config, groups, proxy
list, or logs, while a manual runtime-status refresh retains ownership of the
newest status snapshot. The regression is recorded as a local Vitest fixture;
the missing authenticated three-viewport state matrix remains open.

### Latest listener-free provider/storage regression (2026-08-22)

- The uncached local payment-provider package now passes in both default and
  `unit` builds. EasyPay and Airwallex HTTP fixtures use an in-process
  `http.RoundTripper`/`httptest.ResponseRecorder` instead of opening loopback
  listeners; existing Stripe backends and WeChat SDK stubs remain local.
  Commands were `go test ./internal/payment/provider -count=1` and
  `go test -tags=unit ./internal/payment/provider -count=1` with the isolated
  cache path.
- The S3 backup upload fixture likewise injects an AWS SDK HTTP client and
  passes without a socket (`go test -tags=unit ./internal/repository -run
  TestS3BackupStore_UploadFile -count=1`). These checks establish local
  request/response contracts only; they do not prove credentialed Stripe,
  WeChat, Airwallex, S3, or object-storage acceptance.
- The provider listener-bind item is removed from the active local-test gate.
  Remaining external gates are credentialed payment settlement/refund/return,
  live storage and Batch flows, fresh protected browser/AX state, native
  VoiceOver/NVDA, complete per-page state/mutation coverage, iframe matrix,
  and the severity-signed final Code Review.

### Latest frontend/admin regression count (2026-08-22)

- Adding the Payment Dashboard late-rejection fixture brought the latest full
  frontend run to **363 test files / 2,520 tests passed**. `vue-tsc`, ESLint,
  the 13-test static audit, the 3,103-module production build, and
  `git diff --check` remain green.
- The new fixture proves that an older dashboard request rejected after a newer
  day-range request succeeds cannot replace the newer stats or surface stale
  error feedback. It is a local Vitest contract; authenticated browser state,
  AX snapshots, and native reader evidence remain separate open gates.

- The image-result uploader URL fixture now also uses an in-process HTTP
  recorder, so the targeted image-storage suite runs without a local listener.
  It remains a fake-storage/fixture contract and does not close the live S3 or
  external object-storage gate.

### Latest administrator mutation hardening checkpoint (2026-08-22)

- The latest repository-wide frontend run completed **363 test files / 2,528
  tests passed**. `vue-tsc --noEmit`, ESLint, the 14-test static audit, the
  3,103-module production build, and `git diff --check` also pass.
- Six additional local contracts now fence Backup configuration/connection and
  download actions, AuditLog TOTP clearing, Usage stale log rejections, Admin
  Orders detail failures, and Email Template save/preview generations. These
  are function-level/Vitest contracts only; they do not replace authenticated
  browser state, AX/native-reader evidence, or live admin API mutations.
- The evidence counters and SHA-256 index were refreshed for this checkpoint.
  Open gates remain the fresh protected-browser matrix (including current
  admin routes and state cases), native VoiceOver/NVDA, credentialed external
  payment settlement/refund/return, live Batch/provider/storage/ZIP and
  destructive flows, the cross-origin iframe matrix, complete per-page state
  coverage, and severity-signed final Code Review.

### Latest fresh public/guard browser smoke (2026-08-22)

- `evidence/20260822/fresh-public-guard-matrix-20260822.json` records a fresh
  in-app-browser smoke at 1440×1000, 900×900 and 390×844 for public `/home`,
  `/login`, and the anonymous `/admin/dashboard` guard. The nine runs have one
  main landmark, no horizontal overflow, no console error/warning entries, and
  named login controls; `/admin/dashboard` redirects to the login route.
- A light/dark `/home` check also recorded stable backgrounds and no overflow.
  The browser had no authenticated fixture session, the Tab trace is explicitly
  not claimed, and no token/cookie/storage was inspected. This is supplemental
  public/guard evidence only and does not close the fresh protected-browser,
  AX, native-reader, or per-page state gates. `SHA256SUMS.txt` now verifies all
  16 JSON artifacts.

### Full tagged backend run boundary (2026-08-22)

- The uncached `go test -tags=unit ./...` run reached all packages, with the
  focused handler/service/repository/provider/route suites green. A small set
  of legacy listener-backed tests in `internal/pkg/antigravity`,
  `internal/pkg/httputil`, `internal/pkg/redissession`, `internal/pkg/websearch`,
  `internal/securityaudit`, `internal/server` and
  `internal/server/middleware` were blocked by the managed sandbox's
  `listen ... operation not permitted` restriction. The exact boundary and
  package list are recorded in `gate-results-20260822.json`; no listener test
  is represented as passed.

### Current local hardening verification (2026-08-22)

- The latest repository-wide frontend run is **363 test files / 2,531 tests
  passed** (`pnpm run test:run -- --reporter=dot`). `vue-tsc --noEmit`, ESLint,
  the 3,103-module production build, and `git diff --check` are green. The
  three durable evidence counters (`gate-results-20260822.json`,
  `coverage-manifest.json`, and `a11y-focus-contracts.json`) now use 2,531.
- Backend compile coverage is green with
  `GOCACHE=/tmp/sub2api-gocache go test -tags=unit ./... -run '^$'`. Uncached
  default and `unit` payment-provider packages, the S3 upload fixture, Batch
  Image service/repository hardening suites, and image-storage URL suites also
  pass using in-process transports/fakes.
- New local regressions cover failed/cancelled output retention and preview,
  active retry-child TTL deferral, retryable child-first cleanup after partial
  failure, idempotency unique-conflict re-enqueue, canceled download-permit
  release, deterministic ZIP filename collision suffixing, and private or
  redirect-to-private image URL rejection. These are fixture-only checks and
  do not close live provider, object-storage, external payment, or destructive
  Batch gates.
- The remaining stop conditions are unchanged: fresh authenticated protected
  Chromium across all routes/state cases, native VoiceOver/NVDA, credentialed
  external payment settlement/refund/return, live Batch/provider/storage/ZIP
  and destructive evidence, the cross-origin iframe matrix, complete
  per-page state/late-response coverage, and severity-signed final Code Review.

### Current payment/Batch boundary additions (2026-08-22)

- Stripe webhook lookup now returns all enabled Stripe candidates when an event
  has no `metadata.orderId` and multiple instances are configured; each candidate
  can verify its own signature, so authentic non-payment events are not trapped
  in an ambiguity/retry loop. The single-instance registry fallback and external
  credential boundary remain unchanged.
- Batch record deletion now refuses a settling root or any active retry child,
  and soft-deletes terminal direct retry children before the root. Local service
  fakes cover both refusal and cascade behavior; this is not a live destructive
  route run.

### Current provider/storage boundary additions (2026-08-22)

- Vertex `Get` and `OpenResult` now validate provider/DB output prefixes against
  the managed batch/job prefix before persisting, listing, or reading objects;
  an unexpected `gs://` path is rejected. The regression uses a fake object store
  and does not claim live GCS/S3 access.

### Current Batch authentication boundary (2026-08-22)

- API-key middleware now treats only GET `/images/batches...` routes as
  read-only result access: quota-exhausted/expired keys can list, preview, and
  download their owner-scoped existing jobs, while POST/cancel/delete mutations
  remain billing/status protected. The contract is covered by a Gin middleware
  fixture; it is not an authenticated live route capture.

### Protected browser runner and latest storage/race hardening (2026-08-22)

- 新增 `tools/protected-browser-matrix.mjs`：在具备 Playwright 的环境中可用合成
  auth/API route interception 跑当前 router 的 user/admin 全路由，三视口、三主题/动效
  模式与 success/empty/slow/error/late 状态，并采集 overflow、console/page errors、
  failed requests、CDP AX 摘要和 Tab/Escape 轨迹。运行结果明确标记
  `fixture_only`，不冒充真实账号、native reader 或 live provider 证据。
- 当前沙箱执行该 runner 时在启动前被结构化标记为 blocked：仓库未安装 Playwright；
  进一步使用外部缓存模块仍在 Chromium 启动阶段遇到 MachPortRendezvous
  `Permission denied (1100)`，shell 预览服务也受权限限制；阻塞证据写入
  `evidence/20260822/protected-browser-runner-20260822.json`。
- ImageResultUploader 增加可选对象删除补偿：多图上传后续失败会按逆序删除已写入
  对象；内置 S3 适配器实现 Delete，新增 fake/in-process 回归。Batch processor 的
  provider output ref 更新改为非终态条件写，取消与 provider 轮询并发时丢弃迟到引用。
  两项均为本地 fixture，live storage/provider gate 仍开放。

### Latest tagged-backend rerun correction (2026-08-22)

- 在 listener-free fixture 与受限环境显式 skip 逻辑落地后，重新执行
  `GOCACHE=/tmp/sub2api-gocache go test -tags=unit ./... -count=1`，所有 tagged
  backend packages 退出码为 0。此前本节所述的 listener-bind blocker 是历史
  checkpoint，不再代表该命令的当前结果。
- `go test -v` 核对到 42 个测试因当前沙箱拒绝本地 listener/miniredis 而显式
  `SKIP`（antigravity 31、redissession 1、xai 1、securityaudit 9）；其余
  listener-free/进程内测试实际执行并通过。需要 listener-capable 环境才能把
  这 42 个 skipped cases 升级为执行证据。
- `gate-results-20260822.json` 与 `coverage-manifest.json` 已记录本次命令、退出码、
  skip 边界与历史 blocker。该本地 tagged 结果仍不替代 credentialed external
  payment、live storage/Batch/ZIP/destructive、fresh protected browser、native
  VoiceOver/NVDA 或 cross-origin iframe 门禁。
- 因此当前 open-gates 列表新增“listener-capable execution of 42 sandbox-skipped
  backend cases”；这些 cases 不被计入外部或真实环境验收的已执行数量。

### Latest auth/compliance session fencing and processor retention (2026-08-22)

- 前端认证 store 现在为 checkAuth/login/register/OAuth/logout、用户刷新和主动
  token refresh 使用 session generation fence；旧请求在登出或切换账号后不会写回
  `user`、token 或 `auth_user`。`authAPI.logout` 也只在快照仍匹配时清理持久化会话。
  新增 auth/session race 与 admin-compliance stale fetch/accept 回归，相关局部
  Vitest 共 9 tests passed。
- Admin compliance fetch/accept 使用 request generation，reset 或新请求会使旧响应
  失效；App watcher 同时观察认证状态、token 与用户 ID，避免同一 tick 的换号漏掉
  reset。上述为本地 fixture 证据，不替代真实浏览器会话矩阵。
- Batch processor 在索引失败且 provider output ref 已存在时设置 terminal output
  expiry，使后台 cleanup 能回收该输出；provider 轮询在有/无 output ref 的迟到
  取消场景都由定向 service regression 覆盖。
- 随后再次执行 `GOCACHE=/tmp/sub2api-gocache go test -tags=unit ./... -count=1`，
  全部 tagged backend packages 退出码仍为 0；42 个受限 listener/miniredis 用例
  保持显式 skip 边界。
- 最新前端全量 Vitest 为 **365 test files / 2,540 tests passed**；typecheck、lint、
  build、static audit 与 evidence SHA-256 均已同步。fresh authenticated protected
  browser、native VoiceOver/NVDA、credentialed external payment、live Batch/storage/
  destructive/iframe 与 listener-capable 42 skipped cases 仍保持开放。

### 2026-08-22：当前工作树增量回归（最新）

- 前端全量 Vitest 最新结果为 **365 test files / 2,543 tests passed**；Axios 401
  （旧请求与 auth endpoint）会话保护、RiskControl `loadAll` stale-rejection
  fence 均有回归覆盖。`vue-tsc`、ESLint、3,103-module build 与
  `git diff --check` 继续通过。
- Wxpay webhook lookup 仅把 `ErrProviderNotFound` 映射为 200；数据库/配置瞬时
  错误返回 500 触发重试，签名/请求格式错误仍在后续验证阶段返回 400。
  ImageResultUploader 在宿主替换 `http.DefaultTransport` 为自定义 RoundTripper
  时不再因强制类型断言崩溃，私网与重定向私网拦截保持有效。
- `tools/protected-browser-matrix.mjs` 已修正主请求匹配（不再用 `/` 或
  `/admin/` 广泛命中所有 API）、按 role 返回 `/auth/me` fixture，并记录主请求
  HTTP 状态、expected/unexpected page errors 与 in-flight loading 观测。它仍是
  credential-free fixture runner；当前环境没有可用 Playwright/认证浏览器，不能
  关闭 fresh protected-browser、native reader 或真实 provider/storage 门禁。

### 2026-08-22：最新认证/支付与管理员异步边界复验

- refresh-token 用户/family 索引写入失败现在删除主 token 并失败关闭；当
  refresh-token cache 已配置时，handler 不再把 cache 故障降级为不可追踪的
  stateless access JWT。相关 service/handler fixture 通过。
- Payment provider reload 先完整构建候选集合再原子替换 registry，失败 reload
  保留原 registry 且初始化可重试；退款扣款/网关失败会恢复最初的
  `REFUND_PENDING` 或 `REFUND_FAILED`，不会误回 `COMPLETED`。
- Users、Groups、Admin Orders 的旧异步拒绝及弹窗代际已加 fence；多个导出路径
  延迟回收 Blob URL。定向前端 4 files / 41 tests 通过。
- 最新全量前端回归为 **365 test files / 2,544 tests passed**，`vue-tsc`、ESLint、
  3,103-module build 和 `git diff --check` 通过；最新 tagged backend 全包命令退出码
  为 0，42 个 listener/miniredis 测试仍是显式 sandbox skip。三份计数证据与
  `SHA256SUMS.txt` 已同步。
- 这些结果不关闭 fresh authenticated protected Chromium、native VoiceOver/NVDA、
  listener-capable skipped cases、credentialed external payment、live Batch/
  provider/storage/destructive、cross-origin iframe、完整逐页状态/late-response 或
  severity-signed final Code Review 门禁。

### 2026-08-22：最后一轮后端会话与调度硬化

- 新增 `users.revocation_version` 迁移与原子 repository bump；新 JWT/refresh 数据
  携带 `rv`，middleware/admin/OAuth 绑定统一校验，代际为 0 时兼容旧 token，首次
  revoke-all bump 后旧 access/refresh token 失效。local service/repository/handler
  contracts 通过。
- DingTalk OAuth 的 identity 与 compat-email 查询错误现在失败关闭；scheduled-test
  结果读取上限为 500，失败运行会推进下一次执行时间，单进程重叠 tick 被跳过。
- backend tagged 全量退出码 0（42 个 listener/miniredis 用例保持显式 sandbox skip）；
  frontend 全量为 **365 files / 2,544 tests passed**，三份计数证据及 SHA-256 已更新。
- 以上仍不关闭 protected Chromium、native reader、真实支付/存储/Batch/iframe、逐页
  状态与最终 Code Review 门禁。
