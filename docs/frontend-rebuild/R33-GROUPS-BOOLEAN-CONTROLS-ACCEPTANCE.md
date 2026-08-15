# R33 Groups Boolean Controls Acceptance

## Scope

- Replaced all native checkboxes in the groups workspace with the shared `UiCheckbox` contract.
- Covered create and edit flows for image generation, Gemini batch images, independent video pricing, peak pricing, profit control, supported model scopes, and long-context pricing.
- Replaced the remaining legacy model-pricing add buttons with compact shared buttons and Lucide icons.
- Preserved supported-scope toggle handlers, conditional section visibility, form state, and create/update payload semantics.
- Deliberately left numeric price fields unchanged in this batch so empty, `null`, and clear-to-`-1` behavior remains exact.

## Verification

- Seven targeted suites passed with 39 tests covering columns, duplication, Grok pricing, image pricing, video model pricing, profit control, and supported model scopes.
- `vue-tsc --noEmit`, targeted ESLint, native-checkbox and legacy-button scans, and `git diff --check` passed.
