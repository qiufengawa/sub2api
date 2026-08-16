# R62 Application Shell Acceptance

## Scope

- Authenticated layout: `frontend/src/components/layout/AppLayout.vue`
- Header: `frontend/src/components/layout/AppHeader.vue`
- Sidebar: `frontend/src/components/layout/AppSidebar.vue`
- Shared locale switcher: `frontend/src/components/common/LocaleSwitcher.vue`
- Shared dropdown trigger contract: `frontend/src/components/ui/UiDropdownMenu.vue`
- Layout, interaction, URL-sanitization, and shared overlay tests

## Implemented

- Rebuilds the authenticated shell around a stable `240px` desktop sidebar, `64px` collapsed rail, `54px` header, and responsive workspace offsets.
- Uses the shared token system for surfaces, boundaries, text, spacing, control density, and reduced-motion behavior.
- Centers the configured horizontal site logo and retains the site-name fallback without restoring a square favicon in the sidebar.
- Routes all navigation icons through the shared Lucide registry. Custom menu entries retain their label, URL, visibility, and order and use the standard Lucide link icon.
- Preserves user/admin menu ordering, feature switches, simple mode, model-plaza embedding query, grouped administrator navigation, theme persistence, onboarding targets, mobile close behavior, and sidebar scroll restoration.
- Removes the hidden brand link from the collapsed keyboard order.
- Rebuilds the header with compact page identity, documentation, announcements, locale, balance, subscription, profile, support, onboarding, and logout actions.
- Migrates the balance panel and user menu from page-owned positioning/listeners to `UiPopover`, including viewport positioning, outside dismissal, Escape, focus restoration, and reduced motion.
- Rebuilds `LocaleSwitcher` with `UiDropdownMenu`, `UiIconButton`, and `UiButton`; no page-local field, menu, positioning, or animation CSS remains.
- Extends `UiDropdownMenu` so trigger consumers receive the open state and can expose accurate `aria-expanded` semantics.

## Preserved Contracts

- Route destinations, query parameters, feature-flag fallback semantics, permissions, admin/simple mode, and dynamic menu visibility remain unchanged.
- Theme continues to use the existing `theme` local-storage key.
- Sidebar scroll position continues to use the existing app-store field.
- Logout still completes the store action before navigating to `/login`.
- Documentation URLs continue through `sanitizeUrl` and external links retain safe `rel` attributes.
- No API, store payload, backend, database, version, or release behavior changed.

## Automated Verification

Run on 2026-08-17:

```text
pnpm exec vitest run \
  src/components/layout/__tests__/AppHeader.spec.ts \
  src/components/common/__tests__/LocaleSwitcher.spec.ts \
  src/components/layout/__tests__/AppSidebar.spec.ts \
  src/components/layout/__tests__/TablePageLayout.spec.ts \
  src/components/layout/__tests__/docUrlSanitization.spec.ts \
  src/components/ui/__tests__/UiPopover.spec.ts \
  src/components/ui/__tests__/UiExtendedComponents.spec.ts
Result: 7 files, 41 tests passed

pnpm run test:run -- --reporter=dot
Result: 329 files, 2162 tests passed

pnpm exec vue-tsc --noEmit --pretty false
Result: passed

pnpm run lint:check
Result: passed

pnpm run build
Result: 3118 modules transformed; built in 34.56s

git diff --check
Result: passed
```

The full test run retains existing intentional error-path stderr and unresolved `router-link` warnings in the Settings test fixture. The build retains existing Browserslist data-age, mixed static/dynamic import, large-chunk, Node `DEP0190`, and `lottie-web` `eval` warnings. This batch introduced no test, type, lint, or build failure.

## Browser Acceptance

Pending. The local Edge session does not currently contain an authenticated user or administrator session, so the protected application shell cannot be truthfully accepted in-browser.

Required before final completion:

- Capture user and administrator shells at `1440px`, `900px`, and `390px`.
- Verify expanded/collapsed desktop navigation, grouped menus, active states, dynamic menus, simple mode, and the mobile backdrop/Escape path.
- Verify balance, user, language, announcement, version, and support overlays near every viewport edge.
- Verify keyboard order, focus restoration, dark mode, reduced motion, long site names, long menu labels, large balances, and browser console output.

No browser storage, database account, password, fixture data, or route guard was changed to bypass authentication.

## Review Result And Remaining Risks

- Structured review found no blocking defect after the shared-popover and collapsed-brand fixes.
- `UiPopover` behavior is covered directly and through mounted header/locale consumers; the mounted header test verifies Escape focus restoration and logout navigation.
- Real authenticated browser evidence remains the only acceptance gate for this shell batch.
