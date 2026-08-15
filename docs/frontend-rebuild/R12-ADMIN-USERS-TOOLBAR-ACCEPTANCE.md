# R12 Admin Users Toolbar Acceptance

## Scope

- Replaced the high-frequency Users toolbar search, role/status/group filters, dynamic attribute filters, refresh, filter settings, column settings, attribute configuration, bulk action, and create action controls with the shared UI system.
- Removed the toolbar's inline SVG grid icon and reused the shared icon component.
- Kept the existing filter state, debounce, localStorage preferences, selection behavior, API request shape, and modal event contracts unchanged.

## Verification

- `UsersView.spec.ts`: 3 tests passed.
- `vue-tsc --noEmit`: passed.
- Targeted ESLint: passed.
- Existing common table/modal wrappers remain in place for the untouched Users table and modal workflows; those are the next migration boundary.

## Deferred

- Users row action menus, table cell controls, and user-management modals still require migration in the next batch. No API or state contract was changed in this batch.
