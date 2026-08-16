# R50 Channel Status Acceptance

## Scope

- Route: `/monitor`
- Views: legacy probe monitor (V1) and usage-derived monitor (V2)
- Shared contracts: page header, toolbar, filters, metrics, charts, tables, dialogs, badges, skeletons and compact controls
- Business behavior retained: V1 auto refresh and 7/15/30-day detail cache; V2 query synchronization, dimension cascade, request cancellation, tab request sequencing, matrix zoom/pan and privacy formatting

## Implementation

- Rebuilt V1 as one dense status list with a shared page shell, segmented time range, semantic status indicators and a horizontally scrolling detail table.
- Rebuilt V2 with `AppPage`, `AppPageHeader`, `AppToolbar`, `UiFilterBar`, `UiMultiCombobox`, `UiSegmentedControl`, `UiStatMetric`, `UiTabs`, `UiMobileTableScroller` and `UiProgressBar`.
- Replaced matrix and trend card chrome with `UiChartFrame`; retained Chart.js datasets, dual axes, smoothing, tooltip formatting and wheel zoom/pan.
- Removed the obsolete `FilterMultiSelect` and `MetricCell` implementations and their obsolete test.
- Replaced the custom rank trophy SVG with the shared Lucide icon pipeline.
- Added stale-response protection to V2 tab loading and the V1 detail dialog.
- Added stable accessible names for platform, group, model and matrix-dimension selectors after values are selected.
- Added a privacy regression test proving the user matrix omits TPS/RPM when throughput visibility is disabled.
- Added mobile wrapping to `UiChartFrame`; V2 toolbar modes use separate full-width rows at 390px.
- Removed the empty 340px chart reservation when a pulse matrix is unavailable.

## Automated Verification

- Focused Vitest: 44 tests passed across 9 files.
- `pnpm run typecheck`: passed.
- ESLint for all changed monitor and chart files: passed.
- `pnpm run build`: passed.
- `git diff --check`: passed.

## Browser Verification

Verified against the local preview at `http://127.0.0.1:4174/monitor` with the local `sub2api_preview` database only.

- 1440 x 1000: dense V1 rows remain on one scan line, no document overflow.
- 900 x 1000: rows reorganize into two-column information bands, no clipping or overflow.
- 390 x 844: same list hierarchy is retained; no page-level horizontal overflow.
- V1 detail dialog becomes a mobile bottom surface; its 920px table scrolls internally while the document remains fixed.
- Dark mode: semantic surfaces, borders, health states and timeline bars remain legible with no overflow.
- V2 390px: mode controls occupy separate 32px rows, filter fields fill available width, tabs remain visible, and the empty pulse view no longer reserves a blank chart block.
- V2 trend empty state: chart header tools wrap below the title and remain readable at 390px.

## Environment Note

The already-running local backend binary did not expose `channel_monitor_mode` in its public settings DTO and returned 404 for V2 endpoints, while the current repository source contains the V2 contracts. V2 visual shell verification therefore used a temporary local route selection only; that temporary change was removed before final validation. V2 data behavior is covered by the focused API, formatting, zoom, matrix and structure tests.

## Restoration

- Restored the local administrator password hash after browser verification.
- Removed the temporary local `channel_monitor_mode` database row.
- Restored the normal `ChannelStatusView` mode selector.
- Left the backend process running and restarted only the Vite preview at port 4174.
