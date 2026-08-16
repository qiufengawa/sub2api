# R47 Not Found Acceptance

## Status

- Anonymous browser verification is complete.
- The authenticated `/dashboard` destination still requires a real signed-in browser session.
- R47 therefore remains open under the strict page Definition of Done until that shared authenticated-browser pass is recorded.

## Scope

- Route: `/:pathMatch(.*)*`
- View: `frontend/src/views/NotFoundView.vue`
- Test: `frontend/src/views/__tests__/NotFoundView.spec.ts`

## Preserved Behavior

- Anonymous visitors return to `/home`; authenticated visitors return to `/dashboard`.
- The secondary action continues to call `router.back()`.
- Public settings are fetched only when they have not already loaded.
- Contact information remains optional and is trimmed before display.
- Route metadata and backend-mode route guard behavior are unchanged.

## Rebuild Result

- Replaced the legacy full-page Tailwind surface with `AppPage` and `UiEmptyState`.
- Replaced raw `.btn` controls with `UiButton` and internal navigation with `UiLink`.
- Removed the oversized decorative `404`, local color palette, dark-mode utilities, and icon container.
- Kept placement-only page CSS on shared design tokens.
- Browser QA found that the shared `UiLink` dynamic component rendered internal destinations without an `href`. `UiLink` now uses an explicit `RouterLink` branch, restoring native link semantics, keyboard focus, and route hrefs for every internal consumer.

## Automated Verification

- `pnpm exec vitest run src/components/ui/__tests__/UiExtendedComponents.spec.ts src/views/__tests__/NotFoundView.spec.ts src/views/public/__tests__/LegalDocumentView.spec.ts src/components/auth/__tests__/AuthFormComponents.spec.ts`: 4 files and 24 tests passed.
- `pnpm run typecheck`: passed.
- `pnpm exec eslint src/components/ui/UiLink.vue src/components/ui/__tests__/UiExtendedComponents.spec.ts src/views/NotFoundView.vue src/views/__tests__/NotFoundView.spec.ts`: passed.
- Legacy source scan: no `.btn`, `.input`, `.card`, `:deep()`, `!important`, `dark:`, or page palette classes.
- `git diff --check`: passed.

## Browser Verification

Verified against `http://127.0.0.1:4174/does-not-exist-acceptance` in a real browser:

| State | Evidence |
| --- | --- |
| `1440x1000` light | `innerWidth/clientWidth/scrollWidth = 1440`; no document overflow; heading and both actions visible |
| `900x900` light | `innerWidth/clientWidth/scrollWidth = 900`; no document overflow |
| `390x844` light | `innerWidth/clientWidth/scrollWidth = 390`; no document overflow; actions stay aligned |
| `390x844` dark + reduced motion | dark tokens resolve to `rgb(10, 10, 10)` background; reduced-motion media matches; no overflow |
| Long unbroken contact | deterministic browser fixture wraps inside `366px`; contact and document scroll widths remain within `390px` |
| Keyboard | first Tab focuses `not-found-back`; second Tab focuses the `/home` anchor; both resolve a solid focus outline |
| Console | no `Log.entryAdded` or `Runtime.exceptionThrown` events during the final route load |

The long-contact fixture and dark class were applied temporarily through the browser development protocol and removed before browser cleanup. No local storage, database, API response, or production state was changed.

Anonymous navigation resolves to a native `/home` anchor in the browser. The authenticated `/dashboard` branch is covered by the production component test without fabricating a browser session; a real authenticated-browser pass remains part of the later cross-page console session.

## Screenshot Index

- `docs/frontend-rebuild/screenshots/r47-not-found/not-found-1440-light.jpg`
- `docs/frontend-rebuild/screenshots/r47-not-found/not-found-900-light.jpg`
- `docs/frontend-rebuild/screenshots/r47-not-found/not-found-390-light.jpg`
- `docs/frontend-rebuild/screenshots/r47-not-found/not-found-390-dark-reduced.jpg`
- `docs/frontend-rebuild/screenshots/r47-not-found/not-found-390-long-contact.jpg`
