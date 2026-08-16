# R63 Key Usage And Redeem Failure States Acceptance

## Scope

- Public Key Usage workspace: `frontend/src/views/KeyUsageView.vue`
- User redemption workspace: `frontend/src/views/user/RedeemView.vue`
- Shared public/compact header: `frontend/src/components/home/HomeSiteHeader.vue`
- Page behavior tests and Chinese/English validation messages
- Key Usage viewport evidence under `docs/frontend-rebuild/screenshots/r63-key-usage/`

## Implemented

- Requires both custom range boundaries before Key Usage sends a request.
- Rejects a custom start date later than the end date and associates the message with the affected field.
- Shows validation only after the user applies an invalid custom range; the initial form remains quiet.
- Preserves the existing `start_date`, `end_date`, `days`, `timezone`, and bearer-key request contract.
- Rebuilds redemption history loading with dimensionally stable rows instead of collapsing the workspace.
- Separates an initial history failure from a valid empty history and provides an inline retry.
- Preserves existing history during a failed refresh, reports the failure, and allows retry without leaving the page.
- Prevents duplicate redemption submissions with a runtime guard in addition to the disabled submit control.
- Makes the shared public header consume the global light/dark design tokens instead of a page-private dark class and preserves a readable horizontal logo at mobile width.
- Keeps balance, concurrency, subscription redemption, user refresh, subscription refresh, history refresh, and success/error feedback behavior intact.

## Automated Verification

Run on 2026-08-17:

```text
pnpm exec vitest run \
  src/components/home/__tests__/HomeSiteHeader.spec.ts \
  src/views/__tests__/KeyUsageView.spec.ts \
  src/views/user/__tests__/RedeemView.spec.ts \
  src/i18n/__tests__/localesMessageCompile.spec.ts \
  src/i18n/__tests__/localesNoKeyCollision.spec.ts
Result: 5 files, 26 tests passed

pnpm run test:run
Result: 329 files, 2167 tests passed

pnpm run typecheck
Result: passed

pnpm run lint:check
Result: passed

pnpm run build
Result: 3118 modules transformed; built in 25.77s
```

The full test run retains existing intentional error-path stderr and unresolved `router-link` warnings in the Settings test fixture. The build retains existing Browserslist data-age, mixed static/dynamic import, large-chunk, Node `DEP0190`, and `lottie-web` `eval` warnings. This batch introduced no test, type, lint, or build failure.

## Browser Acceptance

Public Key Usage was verified in the local Edge preview at `http://127.0.0.1:4173/key-usage`.

| Evidence | Result |
| --- | --- |
| `1440px` light | Page width stable; query controls remain 32px; no page overflow |
| `900px` light | `scrollWidth === clientWidth === 900`; query row remains aligned |
| `390px` light | `scrollWidth === clientWidth === 390`; input and query action stack without clipping |
| `390px` dark | Theme tokens resolve to dark background/text values; no overflow |
| Reduced motion | `(prefers-reduced-motion: reduce)` matches; layout and controls remain stable |
| Keyboard | Brand, locale, theme, home, key field, reveal, query, and GitHub follow a logical focus order with visible focus |
| Console | No error or warning entries |

Screenshot index:

- `screenshots/r63-key-usage/key-usage-1440-light.png`
- `screenshots/r63-key-usage/key-usage-900-light.png`
- `screenshots/r63-key-usage/key-usage-390-light.png`
- `screenshots/r63-key-usage/key-usage-390-dark.png`
- `screenshots/r63-key-usage/key-usage-390-dark-reduced.png`

No real API key was entered or persisted. Custom-range errors and request suppression are proven by mounted integration tests rather than by transmitting a credential.

Redeem browser acceptance remains pending because the available browser session has no authenticated user fixture. The route guard, browser storage, and database were not bypassed. Its loading, empty, initial-error, retained-data refresh error, retry, duplicate-submit, and successful subscription paths are covered by mounted tests.

## Review Result

- Independent Key Usage review found no P0-P2 defect and confirmed the public route and request contract remain unchanged.
- Independent Redeem review found a duplicate-submit risk; the handler now rejects re-entry and the regression test proves one request is issued while pending.
- The subscription redemption fixture now uses the real `plan_name` contract and verifies the plan name is rendered.
- No backend, database, API contract, version, tag, release, or deployment metadata changed.
