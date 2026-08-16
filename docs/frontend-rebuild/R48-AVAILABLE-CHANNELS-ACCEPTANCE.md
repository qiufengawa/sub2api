# R48 Available Channels Acceptance

## Scope

- Route: `/available-channels`
- View: `frontend/src/views/user/AvailableChannelsView.vue`
- Domain table: `frontend/src/components/channels/AvailableChannelsTable.vue`

## Preserved Behavior

- Channel and user-specific group-rate requests still run concurrently.
- A rate request failure still degrades to default rates without blocking the channel list.
- Channel name or description matches retain every platform section.
- Platform, group, or model matches retain only matching platform sections.
- Group/model counts, exclusive/public grouping, custom-rate comparison, peak-rate windows, pricing popovers, and expandable details remain available.
- Authentication, feature visibility, API endpoints, and payloads are unchanged.

## Rebuild Result

- Replaced `TablePageLayout`, raw input/button controls, and the local result badge with shared page and toolbar contracts.
- Added a persistent inline retry state while retaining the existing error toast.
- Consolidated the former desktop table and mobile cards into one keyboard-scrollable dense table.
- Mobile retains every field through internal horizontal scrolling and expandable detail rows.
- Removed legacy palette classes, `dark:` utilities, `.btn/.input/.card`, `!important`, and the old table scroll hook.
- Detail sections are unframed and separated by rules; there is no card-inside-card composition.

## Automated Verification

- Table/view Vitest: 2 files, 8 tests passed.
- `pnpm run typecheck`: passed.
- Targeted ESLint: passed.
- Legacy source scan and `git diff --check`: passed.

## Browser Verification

- Local frontend: `http://127.0.0.1:4174/available-channels`.
- Local backend: `http://127.0.0.1:18083` using database `sub2api_preview` only.
- Verified `1440x1000`: document/body width `1440`, both main shells remained within their client width.
- Verified `900x900`: document/body width `900`; toolbar and error state remained within the `828px` content region.
- Verified `390x844`: document/body width `390`; toolbar and error state remained within the `334px` content region.
- Search, result count, refresh, error, and retry controls were visible and non-overlapping at all three viewports.
- The local channel endpoint returned `internal error`, so live row rendering could not be browser-validated in this pass. Expand/collapse, complete details, custom rates, peak rates, placeholders, and loading geometry are covered by the component tests above and remain a final fixture-browser gate.
- The temporary preview administrator password hash was restored byte-for-byte after browser verification.
