# R48 Available Channels Acceptance

## Status

- Implementation and automated verification are complete.
- A real signed-in browser pass with deterministic live rows and the local refresh overlay is still required.
- R48 remains open under the strict page Definition of Done until that browser evidence is recorded.

## Scope

- Route: `/available-channels`
- View: `frontend/src/views/user/AvailableChannelsView.vue`
- Domain table: `frontend/src/components/channels/AvailableChannelsTable.vue`

## Preserved Behavior

- Channel and user-specific group-rate requests still run concurrently.
- A first-load rate request failure degrades to default rates without blocking the channel list; a refresh failure preserves the last known user rates.
- A local refresh retains the existing rows; a failed refresh keeps those rows and exposes an inline error.
- Consecutive loads cancel the superseded request, ignore late results, and abort on page unmount.
- Channel name or description matches retain every platform section.
- Platform, group, or model matches retain only matching platform sections.
- Group/model counts, exclusive/public grouping, custom-rate comparison, peak-rate windows, pricing popovers, and expandable details remain available.
- Authentication, feature visibility, API endpoints, and payloads are unchanged.

## Rebuild Result

- Replaced `TablePageLayout`, raw input/button controls, and the local result badge with shared page and toolbar contracts.
- Added a persistent inline retry state while retaining the existing error toast.
- Split initial loading from local refresh: only the first load uses table skeletons, while refresh uses `UiLoadingOverlay` over the current rows.
- Consolidated the former desktop table and mobile cards into one keyboard-scrollable dense table.
- Mobile retains every field through internal horizontal scrolling and expandable detail rows.
- Removed legacy palette classes, `dark:` utilities, `.btn/.input/.card`, `!important`, and the old table scroll hook.
- Detail sections are unframed and separated by rules; there is no card-inside-card composition.

## Automated Verification

- Table/view Vitest: 2 files, 13 tests passed.
- Full Vitest: 780 suites and 2127 tests passed.
- `pnpm run typecheck`: passed.
- Targeted and full ESLint: passed.
- `pnpm run build`: passed; 3117 modules transformed. Existing chunk-size, mixed import, Browserslist, and `lottie-web` warnings remain unchanged.
- Legacy source scan and `git diff --check`: passed.

## Browser Verification

- Local frontend: `http://127.0.0.1:4174/available-channels`.
- Local backend: `http://127.0.0.1:18083` using database `sub2api_preview` only.
- Verified `1440x1000`: document/body width `1440`, both main shells remained within their client width.
- Verified `900x900`: document/body width `900`; toolbar and error state remained within the `828px` content region.
- Verified `390x844`: document/body width `390`; toolbar and error state remained within the `334px` content region.
- Search, result count, refresh, error, and retry controls were visible and non-overlapping at all three viewports.
- The local channel endpoint returned `internal error`, so live row rendering could not be browser-validated in this pass. Expand/collapse, complete details, custom rates, peak rates, placeholders, initial loading, retained-row refresh, refresh failure, stale response protection, and unmount cancellation are covered by the component tests above and remain a final fixture-browser gate.
- The temporary preview administrator password hash was restored byte-for-byte after browser verification.

## 2026-08-19 Disclosure Relationship Addendum

- The expand/collapse icon button now exposes `aria-controls` pointing at the stable details cell id; the existing component test asserts the target is absent while collapsed and present while expanded.
- `AvailableChannelsTable.spec.ts` remains 4 tests passing. Live rows and refresh-overlay browser evidence remain required because the preview endpoint still returned `internal error` in the recorded browser pass.
