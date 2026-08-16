# R61 R1 Dead Compatibility Cleanup Acceptance

## Scope

- Remove obsolete `common` compatibility components with no production consumers.
- Remove the obsolete compatibility-only date range test.
- Route the scheduled-test select type through the public `@/components/ui` entry.

## Removed Compatibility Components

- `frontend/src/components/common/DateRangePicker.vue`
- `frontend/src/components/common/SearchInput.vue`
- `frontend/src/components/common/Skeleton.vue`
- `frontend/src/components/common/TextArea.vue`
- `frontend/src/components/common/__tests__/DateRangePicker.spec.ts`

Repository-wide production searches found no imports of the four compatibility components. Their replacement contracts remain available as `UiDateRangePicker`, `UiSearchInput`, `UiSkeleton`, and `UiTextArea` from `@/components/ui`.

## Public Entry Correction

`ScheduledTestsPanel.vue` now imports `SelectOption` from `@/components/ui`. The public entry already exports this type, so the business component no longer bypasses the shared compatibility boundary through `@/components/ui/selectTypes`.

## Automated Verification

Run on 2026-08-17:

```text
pnpm exec vitest run \
  src/components/ui/__tests__/UiDateRangePicker.spec.ts \
  src/components/ui/__tests__/UiPrimitives.spec.ts \
  src/components/ui/__tests__/UiSkeleton.spec.ts \
  src/components/admin/account/__tests__/ScheduledTestsPanel.spec.ts
Result: 4 files, 21 tests passed

pnpm exec vue-tsc --noEmit --pretty false
Result: passed

rg -n "@/components/common/(DateRangePicker|SearchInput|Skeleton|TextArea)\\.vue|components/common/(DateRangePicker|SearchInput|Skeleton|TextArea)\\.vue" frontend/src
Result: no matches

git diff --check
Result: passed
```

The targeted test run retains the existing Browserslist data-age warning.

## Review Result

- No production consumer, barrel export, dynamic import, or relative import remains for the deleted files.
- The replacements are independently implemented in `components/ui` and remain covered by component tests.
- No API, route, store, backend, database, version, or release behavior changed.
- No browser acceptance is required for removing unreachable compatibility files; visual behavior remains covered by the replacement component fixtures and their existing page consumers.
