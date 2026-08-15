# R14 Admin Groups Workspace Acceptance

## Scope

- Rebuilt the Groups workspace toolbar with compact shared search, select, button, and icon-button controls.
- Replaced platform, exclusivity, and status visual badges with shared semantic badges.
- Replaced row edit, duplicate, composite-route, multiplier, RPM, and delete actions with shared icon buttons.
- Replaced the empty state with `UiEmptyState` and a shared action button.
- Preserved server-side filters, sorting, pagination, duplicate workflow, composite-route workflow, rate/RPM dialogs, and form payload behavior.

## Verification

- Groups column settings and duplicate tests: 10 tests passed.
- `vue-tsc --noEmit`: passed.
- ESLint for `GroupsView.vue`: passed.

## Deferred

- The large create/edit forms and rate/RPM child dialogs still contain compatibility controls and require the next Groups form migration batch.
