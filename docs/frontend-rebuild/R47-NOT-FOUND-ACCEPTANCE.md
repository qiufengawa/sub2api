# R47 Not Found Acceptance

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

## Automated Verification

- `pnpm exec vitest run src/views/__tests__/NotFoundView.spec.ts`: 3 tests passed.
- `pnpm run typecheck`: passed.
- `pnpm exec eslint src/views/NotFoundView.vue src/views/__tests__/NotFoundView.spec.ts`: passed.
- Legacy source scan: no `.btn`, `.input`, `.card`, `:deep()`, `!important`, `dark:`, or page palette classes.
- `git diff --check`: passed.

## Final Browser Gate

The cross-page browser pass must verify this route at `1440x1000`, `900x900`, and `390x844`, including anonymous/authenticated destinations, long contact text, dark theme, keyboard focus, reduced motion, and zero document-level horizontal overflow.
