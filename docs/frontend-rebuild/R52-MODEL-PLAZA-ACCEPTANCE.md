# R52 Model Plaza Acceptance

## Scope

- Route: public `/model-plaza` and authenticated `/model-plaza?embedded=1`.
- View: group-centred model discovery and price comparison.
- Shared contracts: page header, search, filter bar, mobile filter sheet, compact selects and buttons, badges, loading skeletons, empty state, error state and public navigation links.
- Business behavior retained: feature and authentication guards, anonymous and exclusive-group visibility, platform/group/rate filter linkage, personal group rates, independent image rates, token/request/image pricing, official price comparison, tiered pricing, peak-rate notice and model sorting.

## Implementation

- Kept the public and embedded layouts while giving both forms the same page title, summary, search and model-list hierarchy.
- Replaced the custom search field with `UiSearchInput` and the dead-end error alert with a retryable `UiErrorState`.
- Added request sequencing so a slower earlier plaza request cannot overwrite a newer retry response.
- Rebuilt desktop filters as a shared `UiFilterBar` with applied-count and clear behavior.
- Rebuilt mobile filters as a `UiSheet` with compact platform, group and rate selectors, safe-area footer actions and the same linkage rules as desktop.
- Standardized the mobile breakpoint at 768px.
- Removed the colored strip before each group title and retained provider identity only in the domain icon and label.
- Kept the pricing display as a dense list/comparison table on every viewport. Mobile uses an internally scrolling 1064px comparison surface rather than cards or a sticky first column.
- Replaced legacy Tailwind color and dark-mode classes in the pricing surface with shared design tokens.
- Allowed long group names and descriptions to wrap instead of hiding required information.
- Preserved sanitized administrator Markdown through `marked` and `DOMPurify`.
- Replaced command-styled public navigation buttons with `UiLink`.

## Automated Verification

- Focused Vitest: 5 files and 31 tests passed.
- Added view coverage for public, embedded, anonymous fallback, failure and retry states.
- Added group coverage for personal rates, exclusive groups, peak notices, image-rate props, empty models and removal of the colored title strip.
- Updated filter coverage for the desktop shared filter bar, mobile sheet, linked disabled options and clear-all behavior.
- Retained the complete pricing calculation, sorting, tier, request, image and responsive-list suite.
- `pnpm run typecheck`: passed.
- ESLint for the changed views, components, tests and locale files: passed.
- `pnpm run build`: passed.
- Build output retained pre-existing chunk-size and mixed dynamic/static import warnings only.
- Full frontend Vitest: 2079 tests passed; 5 existing `KeyUsageView.spec.ts` tests failed because that separate dirty batch did not issue its mocked usage request. No model-plaza test failed.

## Browser Verification

Verified against the populated local preview at `http://127.0.0.1:4174/model-plaza`.

- 1440 x 900: summary, search, three linked filter groups, provider sections and eight-column price comparisons align without document overflow.
- 900 x 900: filters wrap predictably and model price details remain readable without narrowing the page.
- 390 x 844: the document width remains bounded, filters switch to a bottom sheet, and every pricing section remains a horizontally scrollable list.
- Mobile filter sheet: three selectors, clear action and result action remain visible above the safe area.
- Dark mode: page, group headers, pricing rows, borders, filters and text use the shared dark tokens and remain legible.
- Reduced motion: pricing-row transitions are disabled through the media preference.
- No group-title color strip remains.

## Notes

- Peak pricing remains displayed as a notice. The visible base price calculation was not changed to include the current peak multiplier because that would alter the existing pricing contract.
- The local demo dataset contains intentionally synthetic price values; this batch did not modify seed data or backend billing calculations.
- The preview backend and Vite processes were left running.
