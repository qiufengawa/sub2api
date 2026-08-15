# R38 Groups Numeric Controls Acceptance

## Scope

- Migrated all image, batch-image, video, per-model video, peak-window, profit-control, web-search, search, and audio fields to compact shared text fields.
- Preserved Vue number coercion, min/max/step constraints, placeholders, help content, and test selectors.
- Preserved create-side empty price to `null`, edit-side empty price to `-1`, multiplier normalization, percentage-to-decimal conversion, and unknown video-family round trips.
- Folded fallback-group labels and descriptions into shared selects and removed the remaining legacy input classes.
- Updated the model-list layout test to validate the extracted `GroupModelsListEditor` instead of stale page DOM.

## Verification

- Thirteen Groups and shared-field suites passed with 64 tests.
- Covered image/video pricing, Messages Dispatch, reasoning effort, model-list behavior and layout, supported scopes, profit control, columns, duplication, and Grok contracts.
- `vue-tsc --noEmit`, targeted ESLint, native-input scans, and `git diff --check` passed.
