# R49 Custom Page Acceptance

## Scope

- Route: `/custom/:id`
- View: `frontend/src/views/user/CustomPageView.vue`
- Test: `frontend/src/views/user/__tests__/CustomPageView.spec.ts`

## Preserved Behavior

- Public menu items remain the primary source; administrators retain the admin-menu fallback.
- `page_slug` and `md:` still select Markdown mode; other valid HTTP(S) URLs remain iframe mode.
- Embedded URLs retain user, token, theme, locale, host, and source-page query context.
- Markdown remains sanitized through DOMPurify, rewrites safe relative images, builds heading IDs and TOC entries, wraps tables in keyboard-scroll regions, and injects copy actions.
- Theme/locale synchronization, desktop/mobile TOC behavior, Escape handling, open-in-new-tab safety attributes, and all four content states remain.

## Rebuild Result

- Replaced the legacy bordered page surface, raw controls, duplicated empty/error markup, and page palette with `AppPage`, `AppPageHeader`, `UiLink`, `UiEmptyState`, `UiErrorState`, `UiDrawer`, and slim shared actions.
- Desktop Markdown uses an unframed TOC rail; mobile uses the shared modal drawer with focus/escape lifecycle.
- Rebuilt Markdown typography, tables, code, images, links, and copy actions entirely on UI tokens.
- Iframe mode is a full remaining-space workspace rather than a decorative card.
- Added request sequencing and `AbortController` cleanup so an old Markdown response cannot overwrite a newer route and unmounted views cannot receive late writes.
- Cancels a pending scroll RAF during unmount.

## Automated Verification

- `pnpm exec vitest run src/views/user/__tests__/CustomPageView.spec.ts`: 4 tests passed.
- `pnpm run typecheck`: passed.
- Targeted ESLint and `git diff --check`: passed.
- Source contract test rejects legacy `.btn/.input/.card`, `dark:`, `@apply`, `:deep()`, and `!important` residue.

## Browser Verification

- Verified the configured not-found state in local `sub2api_preview` at `1440x1000`, `900x900`, and `390x844`.
- At every viewport, each main shell's `scrollWidth` equaled its `clientWidth`; document/body width stayed within the viewport.
- Mobile screenshot confirmed centered state content, readable typography, and no overlap with the application header.
- The preview database has no custom-menu fixture, so successful iframe/Markdown states remain covered by the component tests rather than a live browser fixture in this pass.
- The temporary preview administrator password hash was restored byte-for-byte after verification.
