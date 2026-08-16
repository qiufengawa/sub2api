# R44 Admin Ops Acceptance

## Scope

- Rebuild the administrator Ops overview around a clear command hierarchy: readiness, health, live traffic, stability, latency, and system resources.
- Replace the legacy color utilities, hand-drawn SVG controls, and page-local progress treatments with shared UI contracts and Lucide icons.
- Rebuild the Ops settings dialog around the complete runtime, email, report, silencing, distributed-lock, threshold, and advanced-setting contracts.
- Remove the unused runtime and email settings cards after confirming that the consolidated settings dialog is their only active successor.
- Clean the remaining Ops error-log and system-log visual overrides without changing their data, filtering, pagination, or cleanup behavior.

## Preserved Contracts

- Platform, group, time-range, custom-range, refresh, fullscreen, alert-rule, settings, and request-detail events retain their existing payloads.
- SLA, request-duration, and TTFT metrics retain their targeted request-detail presets; request and upstream errors retain their dedicated error-detail events.
- Missing telemetry remains neutral and displays `-`; an idle window with zero SLA samples is not treated as a real `0%` breach.
- CPU, memory, database, and Redis percentages keep their existing calculations while using accessible shared progress meters.
- Settings load failures still disable save. Legacy responses are normalized without replacing nullable metric thresholds or inventing persisted values.
- Runtime, email, report, advanced, and threshold settings are still saved through the same four APIs; invalid RFC3339, Cron, range, and lock values are rejected before any update request.

## Verification

- Ops directory and threshold-component tests: 18 files, 60 tests passed.
- `vue-tsc --noEmit`: passed.
- ESLint for every file in this batch: passed.
- Production build: passed (`3104` modules transformed, built in `25.23s`).
- `git diff --check`: passed.
- Independent Code Review completed; the identified null-telemetry, metric-drill-down, localization, health-label, and settings-test gaps were corrected.
- Browser QA passed at 1440x900, 900x900, and 390x844.
- Document-level horizontal overflow was absent at all three widths (`scrollWidth === clientWidth`).
- The six resource metrics render in one row at desktop, three columns at 900px, two columns below 768px, and one column below 480px.
- Health diagnosis opens from the native button with Enter, closes with Escape, and returns focus to the trigger.
- At 390px, the alert-rule and settings icon buttons retain explicit accessible names after their visible text is hidden.
- At 390px, the settings dialog stays within the viewport, scrolls internally, and keeps Cancel/Save visible in the fixed footer.
- Dark mode uses the black neutral surface tokens; reduced-motion emulation reports `0s` transitions for the health control and progress ring.

## Screenshots

- `screenshots/admin-ops-1440.png`: full desktop workspace.
- `screenshots/admin-ops-900.png`: medium-width responsive layout.
- `screenshots/admin-ops-390.png`: mobile-width stacked layout.
- `screenshots/admin-ops-settings-390.png`: mobile settings dialog and fixed footer.
- `screenshots/admin-ops-dark.png`: dark-mode desktop viewport.

## Environment Notes

- Browser preview used the local `sub2api_preview` PostgreSQL database and isolated Redis database. The real database was not connected or migrated.
- The local preview binary predates the current subscription schema, so its existing announcement/subscription requests emit `group_id does not exist` errors. Those errors are outside this frontend batch and were not introduced by the Ops changes.
- The local administrator password hash was restored to its original value after browser acceptance.
