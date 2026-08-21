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
  component removes the media listener on unmount.
- `frontend/src/components/ui/AppPage.vue` now renders a neutral `div`; the
  surrounding `AppLayout` owns the single `main` landmark, removing the
  nested-main pattern present on most protected pages.

## Verification

Durable artifacts and SHA-256 entries are under
`evidence/20260822/`:

- `admin-settings-state-matrix.json`: six `/admin/settings` cases (empty,
  1.6-second slow response and 503 error at 1440×1000 and 390×844). All six
  main requests were intercepted; there was zero overflow, navigation error or
  failed request. The slow timings were approximately 1.65 seconds. Both error
  cases hid the form, exposed the alert and Retry control, and recovered to a
  mounted form after the retry response. The four sandbox iframe
  `SecurityError` values are classified as the existing expected sandbox
  boundary; no unexpected page errors occurred.
- `settings-ax-tabs-summary.json`: every one of the nine Settings tabs across
  light and dark+reduced-motion at desktop and mobile (36 cases). Chrome's AX
  tree found zero unnamed interactive nodes, zero generic default switch names,
  zero overflow cases and exactly one main landmark per case.
- `ax-tree-summary.json`: eight representative protected routes across
  light/dark-reduced and desktop/mobile (32 cases). There are zero overflow,
  navigation errors, failed requests or unnamed interactive nodes. All cases
  have one main landmark. The 16 mobile closed-sidebar cases expose
  `inert=true` and `aria-hidden=true`; the first eight real Tab stops begin at
  the page header rather than off-canvas sidebar links.
- `gate-results-20260822.json`: focused Vitest and browser gate counts for this
  follow-up. The full frontend run is 360 test files / 2,438 tests; static
  audit (13), typecheck, ESLint, production build (3,103 modules) and
  `git diff --check` also passed.

The AX tree and Tab traces are browser accessibility evidence, not native
VoiceOver/NVDA execution. The native reader gate, credentialed external
Stripe/WeChat/Airwallex settlement/refund, external return flow, complete
per-page slow/empty/error/late-response coverage, remaining administrator
mutation edges and final severity-signed Code Review remain open.
