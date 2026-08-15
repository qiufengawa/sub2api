# R26 Redeem Codes Workspace Acceptance

## Scope

- Rebuilt the redeem-code toolbar, filters, server-side table, selection controls, pagination, confirmation flows, generation form, batch editor, and result dialog with shared UI primitives.
- Preserved generation types, subscription-plan metadata, validity and expiry rules, server sorting, export filters, batch-update field omission, and download/copy behavior.
- Kept the dense table as a horizontally scrollable comparison surface on narrow screens.
- Added persisted page-size updates and reset the server page whenever filters change.
- Preserved selected code type metadata across pages so subscription-only plan editing remains accurate.
- Reworked “delete all unused” to collect every server page and delete in bounded batches instead of silently stopping after the first 1,000 records.
- Added the supported `active` status to the UI and API filter type.

## Verification

- Redeem workspace contract suite: 4 tests passed.
- Verified selected-field payload omission, filter page reset, cross-page subscription selection, and complete unused-code pagination.
- `vue-tsc --noEmit`, targeted ESLint, and `git diff --check` passed.
