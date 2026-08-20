# R13 Admin Users Table Actions Acceptance

## Scope

- Replaced user role/status/balance/quota/action controls with compact shared badges, buttons, and icon buttons.
- Removed the table action row's nested text-button styling and one inline SVG-driven control.
- Replaced the empty table state with `UiEmptyState` and a shared `UiButton` action.
- Preserved user selection, balance/history/quota/edit/status handlers, admin deletion guard, and modal event contracts.

## Verification

- `UsersView.spec.ts`: 3 tests passed.
- `vue-tsc --noEmit`: passed.
- ESLint for `UsersView.vue`: passed.

## Deferred

- The teleported action menu and user-management modal internals still use compatibility wrappers/native menu rows and remain scheduled for the next Users migration batch.

## 2026-08-19 Mutation single-flight follow-up

- Status toggles are guarded per user ID and the row button is disabled until the mutation plus list refresh completes.
- User deletion now has a function-level pending guard and passes pending state to the shared confirmation dialog.
- `UsersView.spec.ts` now has 5 tests, including direct duplicate handler invocation for both mutations; typecheck and targeted ESLint passed. Protected administrator browser verification remains pending.
