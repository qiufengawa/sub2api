# R31 Groups Workspace Acceptance

## Scope

- Rebuilt the administrator groups list with the shared page header, server-table workspace, data table, pagination, column picker, and dialog components.
- Replaced the hand-positioned column menu while preserving hidden-column persistence and usage/capacity lazy-loading behavior.
- Migrated create, edit, sort, delete, and composite-route dialog shells and footer actions to shared compact controls.
- Removed the three hand-drawn loading spinners from dialog actions and delegated loading/disabled semantics to `UiButton`.
- Kept sortable groups as a compact draggable list and replaced platform-specific visual pills with the shared badge contract.
- Preserved create/update payload construction, media-price clearing semantics, model-routing serialization, composite-route workflows, and sort-order payloads.

## Verification

- Groups column settings, duplicate-group, and Grok pricing contract suites pass.
- Verified hidden-column persistence, column-triggered secondary loading, create/edit form ownership, and sort payload semantics.
- `vue-tsc --noEmit`, targeted ESLint, native footer and inline-spinner scans, and `git diff --check` pass.

## Deferred Business Finding

- The subscription-plan API projection currently omits the five-hour quota field while the edit dialog submits it. This is recorded for a dedicated backend contract fix and is not changed by R31.
