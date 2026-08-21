# R2-R8 continuation evidence — 2026-08-21

This record covers the continuation run after the release verification at
`v0.1.179-qiu.2`. Runtime checks used an isolated PostgreSQL database
`sub2api_browser_continue_20260821`, Redis `127.0.0.1:56379`, backend
`127.0.0.1:18083`, Vite `127.0.0.1:3001`, and Chromium at the local Chrome
binary. The shared `sub2api_preview` database and Redis `6379` were not used.

Durable JSON summaries, gate results and fixture outputs are checked in under
`docs/frontend-rebuild/evidence/20260821/`; the temporary paths below identify
the original browser run directories.

The local automation gate summary is `evidence/20260821/gate-results.json`.
The scoped source review is `R2-R8-CODE-REVIEW-FOLLOWUP-20260821.md`.

## Protected-page browser matrices

### User routes

`/tmp/sub2api-browser-continue-20260821/user-matrix/matrix.json` is the output
of the corrected matrix runner (`user-matrix.mjs`). The runner now calls
`page.setViewportSize` for every case; the earlier run that only renamed files
was discarded as evidence.

| Check | Result |
| --- | ---: |
| Runs | 171 (19 routes × 3 viewports × 3 modes) |
| Actual viewport widths | 390, 900, 1440 |
| Horizontal overflow | 0 |
| Navigation errors | 0 |
| Console error/warning messages | 0 |
| Page errors | 0 |
| Failed requests | 0 |

Each run records eight Tab stops, an ARIA snapshot, reduced-motion media,
light/dark media, and a screenshot. The raw screenshots are in the same
temporary directory under `screenshots/`.

The `/orders` tablet/light evaluator briefly exceeded its per-evaluation
deadline while the page was still rendering. It was rerun independently at
the same `900×900` viewport (`orders-tablet-recheck.mjs`) and the corrected row
was merged into the durable matrix summary; the final matrix has no missing
viewport dimensions.

### Admin routes

`/tmp/sub2api-browser-continue-20260821/admin-matrix/matrix.json` covers all
24 admin route labels in the runner (`216` cases). The real public setting had
`risk_control_enabled=false`, so the 18 Risk Control / Prompt Audit cases were
correctly redirected to Settings. They were then rerun against a local
feature-enabled public-settings fixture; the actual-route output is
`/tmp/sub2api-browser-continue-20260821/risk-prompt-matrix/matrix.json`
(`18` cases, exact target URLs, zero overflow/console/pageerror/failed request).
The runner's historical `/admin/backups` label is not a production route and
correctly renders Page Not Found; Backup is an embedded Settings panel and is
covered by the mutation fixture below. Those nine 404-label cases are excluded
from the protected-route completion count.
The AppHeader fix described below was applied before both final runs.

| Check | Result |
| --- | ---: |
| Runs | 216 (24 routes × 3 viewports × 3 modes) |
| Actual viewport widths | 390, 900, 1440 |
| Horizontal overflow | 0 |
| Navigation errors | 0 |
| Console error/warning messages | 0 |
| Unexpected page errors | 0 |
| Failed requests | 0 |

The combined evidence therefore contains `189` real-enabled admin baseline
cases plus `18` feature-enabled Risk Control / Prompt Audit cases, with the
guard redirect and the obsolete Backup label retained separately as expected
navigation behavior.

The only raw page-error text is the expected browser security boundary from
the email-template preview iframe:

```text
SecurityError: Failed to read the 'localStorage' property from 'Window':
The document is sandboxed and lacks the 'allow-same-origin' flag.
```

There are `3537` occurrences across `/admin/settings`,
`/admin/risk-control`, and `/admin/prompt-audit`. These are retained in the
raw matrix as `expectedSandboxErrors`; they are not filtered out of the raw
console/page-error capture. The iframe remains sandboxed with scripts disabled;
the security boundary was not weakened to make the console artificially clean.

## Browser provider fixtures

The following are local provider fixtures, not claims of access to external
Stripe, WeChat, or Airwallex credentials. The environment had no provider
secret variables. They exercise the production browser contracts with
Playwright route interception:

### Playground

Evidence:

- `/tmp/sub2api-browser-continue-20260821/provider-fixtures/playground-fixture.json`
- `/tmp/sub2api-browser-continue-20260821/provider-fixtures/playground-fixture.png`
- `/tmp/sub2api-browser-continue-20260821/provider-fixtures/playground-storage-stop.json`

Verified in a real Chromium page:

- SSE success (`stream:true`, request/response IDs and usage);
- clean finish-reason EOF and interrupted EOF with
  `Streaming response ended before completion`;
- provider HTTP error with the assistant error retained;
- image JSON/base64 success (`data:image/png;base64,...`) and image-provider
  error;
- pending request cancellation and `Stopped` state;
- storage denial warning (`This browser cannot save the session...`), while
  auth storage remains usable.

The fixture intentionally records the expected resource errors for the mocked
502/403 responses rather than calling them console-clean.

### Batch Image

Evidence:

- `/tmp/sub2api-browser-continue-20260821/batch-fixtures/batch-fixture.json`
- `/tmp/sub2api-browser-continue-20260821/batch-fixtures/batch-fixture.png`
- Durable live-route check: `evidence/20260821/batch-live-route.json` (isolated
  eligible fixture key; secret omitted).

Verified with a real page and route-backed job state:

- model list endpoint returns HTTP 200 at `/v1/images/batches/models`;
- create payload preserves task name, model, and prompt;
- running-job cancel has a confirmation gate (zero cancel requests before
  confirmation);
- failed-item retry loads the saved `prompt_preview` and submits only the
  failed item with `parent_batch_id`;
- completed-record delete has a confirmation gate (zero DELETE before
  confirmation);
- dark/reduced-motion/mobile table semantics were exercised by the page.

The backend route is already ordered with the static `models` route before the
`:id` route in `backend/internal/server/routes/gateway.go:249-258`; Gin's
static-child precedence was independently checked. The earlier 404s were the
intentional default `batch_image.enabled=false` configuration, not route
shadowing. With the feature enabled and a local eligible Gemini account
mapping, the live isolated endpoint returned HTTP 200 and two models; the
response is preserved in `batch-live-route.json`.

### Payment browser flows

Evidence:

- `/tmp/sub2api-browser-continue-20260821/payment-fixtures/payment-fixtures.json`
- `/tmp/sub2api-browser-continue-20260821/payment-fixtures/*.png`

The route fixture covers all three visible methods:

- WeChat/EasyPay QR: create payload, QR canvas, pending state, polling, and
  signed result navigation;
- Stripe: create payload with `client_secret`, local Stripe.js stub,
  Payment Element ready state, and successful `Pay Now` transition;
- Airwallex: create payload whose URL omits the secret, local SDK-controller
  fixture, `redirectToCheckout`, and successful signed result navigation;
- failed signed result state;
- Airwallex recovery-storage denial, which correctly renders
  `Missing Airwallex payment parameters` because the secret is intentionally
  not placed in the URL.

## Isolated backend payment mutations

Signed local callback payloads were sent to the running isolated backend and
verified by querying the same database afterward:

| Fixture | Callback result | Database result |
| --- | --- | --- |
| EasyPay-backed WeChat (`/payment/webhook/easypay`) | `200 success` | order `88`: `PENDING → COMPLETED`, trade number and timestamps persisted |
| Stripe (`/payment/webhook/stripe`) | `200` empty body | order `83`: `PENDING → COMPLETED`, `pi_fixture_83` persisted |
| Airwallex (`/payment/webhook/airwallex`) | `200` empty body | order `93`: `PENDING → COMPLETED`, `pi_fixture_93` persisted |

Bad EasyPay and Stripe signatures both returned `400 verify failed` and left
the completed order unchanged. The isolated mutation checks also covered:

- user refund request: order `93` became `REFUND_REQUESTED` with the reason;
- repeated refund request: rejected with `INVALID_STATUS`;
- admin offline refund (`payment_trade_no=''`): order `81` became `REFUNDED`
  with the requested amount and reason.

These are local signed/provider fixtures. A live external gateway settlement,
real card/QR account, and provider-side asynchronous refund query still need
credentialed sandbox access and are not represented as completed here.

## Source fixes found during the matrix

- `frontend/src/components/layout/AppHeader.vue`: the identity column now uses
  `flex: 1 1 0`, allowing long admin titles/descriptions to yield space to
  account actions. Before the fix `/admin/audit-logs` had a 1556px document at
  1440px and 1107px at 900px; after the fix all 216 admin cases have zero
  document overflow.
- `frontend/src/views/admin/ChannelsView.vue`: imported the missing `UiTabs`
  contract; the real `/admin/channels/pricing` page now has zero console
  warnings/errors.
- English and Chinese admin account locales now include the `expired` status
  key, removing the real missing-message warning.

## Browser mutation evidence currently captured

`/tmp/sub2api-browser-continue-20260821/admin-fixtures/audit-clear.json` and
`audit-clear-dark-reduced.png` verify the real audit-log overlay sequence:

1. TOTP status is enabled;
2. confirmation text appears;
3. no clear request is sent before confirmation;
4. the six-digit TOTP dialog appears;
5. `POST /admin/audit-logs/clear` receives `{totp_code:"123456"}` and the
   success toast is shown;
6. console capture is empty.

Additional local browser mutation fixtures:

- `admin-fixtures/redeem-plans.json`: redeem single-delete confirmation,
  generated-code payload, payment-plan delete confirmation, and the `for_sale`
  update; all four mutations passed with empty console capture.
- `admin-fixtures/prompt-audit-mutation.json`: blocking-mode warning/confirm,
  versioned config save, filter-delete preview, and delete-by-filter with the
  exact `confirmation_token`; all passed with empty console capture.
- `admin-fixtures/channel-monitor-mutation.json`: manual run, server-side
  duplicate with a non-empty `Idempotency-Key`, enabled-state update, and
  delete confirmation; all passed with empty console capture.
- `admin-fixtures/backup-mutation.json`: embedded Settings/Backup view,
  `STEP_UP_REQUIRED` challenge, six-cell TOTP verification, transparent retry,
  asynchronous backup creation, and delete confirmation. The sole console
  resource error is the expected mocked 403 step-up challenge.
- `admin-fixtures/risk-control-mutation.json`: feature-enabled Risk Control
  settings, Runtime tab, clear-all hash confirmation, and exact DELETE gate;
  console capture is empty.
- `admin-fixtures/ops-alert-rule-mutation.json`: Alert Rules modal and
  destructive delete confirmation; console capture is empty.
- `admin-fixtures/subscription-mutation.json`: quota reset (all three windows),
  revoke, restore, and validity adjustment; confirmation gates and payloads all
  passed with empty console capture.
- `payment-fixtures/user-order-mutation.json`: user refund-request dialog and
  pending-order cancellation, including exact reason payload; empty console.
- `admin-fixtures/admin-order-mutation.json`: admin refund warning followed by
  explicit force resubmission, pending-refund query, pending-order cancel, and
  failed-order retry; all payload/state transitions passed with empty console.

### Slow, empty and error-state continuation

`evidence/20260821/admin-state-matrix-summary.json` records 48 local Chromium
fixture cases for eight previously high-priority administrator routes at
1440×1000 and 390×844. Each route exercised an empty response, a 1.6-second
delay and a page-specific HTTP 503. All 48 target requests were intercepted;
overflow, navigation errors and failed requests were zero. All 16 slow
route/viewport cases exposed loading signals, and the primary list errors
rendered visible error text on the audit, redeem, plans, monitor, subscriptions
and proxies pages. Ops deliberately falls back from the failed snapshot to its
split endpoints, so its expected console error is a resilience signal rather
than a blank page. Accounts now catches the initial table rejection and shows
the localized error toast without an unhandled page error; the focused
`AccountsView.schedulerScore.spec.ts` regression and the post-fix account
recheck recorded in the summary cover that boundary. The
fixture's 24 expected resource/console errors and two pre-fix account page
errors remain counted in the durable summary rather than being called
console-clean.

Remaining administrator work is the deeper mutation/error matrix (for example
failed retries, Ops log cleanup, provider refund query, and concurrent/late
responses), rather than the primary mutation entry points above. Their
exact API and confirmation contracts are listed in the static audit returned
by the continuation run and in the corresponding R25/R26/R58-R60 acceptance
records.

## Evidence boundary still open

This continuation materially closes the full protected-page geometry/console
matrix and local provider fixtures, but it does **not** close the overall R0-R9
goal yet. A native screen reader run (VoiceOver/NVDA-equivalent) is still not
available in this environment; ARIA snapshots and keyboard traces are retained
as supporting evidence, not substituted for a screen-reader claim. The
remaining admin mutation routes, full per-page slow/empty/error state matrix,
external credentialed sandbox settlement/refund, and final Code Review gate
must still be executed and recorded before marking the long task complete.
