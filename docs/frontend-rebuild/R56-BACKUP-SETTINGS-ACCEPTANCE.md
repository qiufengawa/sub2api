# R56 Backup Settings Acceptance

## Scope

- Production workspace: `frontend/src/views/admin/BackupView.vue`
- Shared contracts: `UiDescriptionList`, `UiStatusBadge`
- Contract tests: `BackupView.spec.ts`, `UiPrimitives.spec.ts`
- Route ownership: `BackupView` is the `backup` workspace rendered inside `/admin/settings`; the parent `SettingsView` owns the route-level `AppPage` and `AppPageHeader`.

## Implemented

- Replaced the legacy cards, native fields, buttons, table, status classes, and browser prompts with shared `Ui/App` contracts.
- Added stable skeleton, persistent error, independent retry, empty, disabled, and loading states for S3, image storage, schedule, and backup records.
- Preserved S3 and image-storage secret replacement semantics and all existing payload fields.
- Preserved TOTP step-up for storage updates, backup creation, download, and restore.
- Preserved split-part and legacy single-file downloads.
- Replaced database restore prompts with a bounded password dialog and retained exact backup ID submission.
- Preserved legal zero values for retention days and retention count.
- Normalized the flat API-client `409` response and resumes monitoring an already-running backup.
- Replaced overlapping interval polling with generation-guarded, single-flight timeout polling for backup and restore operations.
- Reconciles busy state after the tab becomes visible without clearing state when the refresh itself fails.
- Added monospace values to `UiDescriptionList` and mapped the operational `completed` state to success in `UiStatusBadge`.

## Contract Evidence

- S3 save/test payloads remain the original `BackupS3Config` object.
- Image storage keeps `max_download_bytes` and all provider-specific fields even though the field is not directly edited here.
- Create remains `{ expire_days }`; restore remains `(backupId, password)`.
- `0` still means no automatic retention cleanup / no retained-count limit.
- Visibility recovery, polling stop, unmount cleanup, `409` recovery, split download, restore target, and zero-value round trip have regression coverage.

## Automated Verification

Run on 2026-08-16:

```text
pnpm exec vitest run \
  src/views/admin/__tests__/BackupView.spec.ts \
  src/components/ui/__tests__/UiPrimitives.spec.ts \
  src/views/__tests__/KeyUsageView.spec.ts
Result: 3 files, 30 tests passed

pnpm run test:run
Result: 321 files, 2103 tests passed

pnpm exec vue-tsc --noEmit
Result: passed

pnpm run lint:check
Result: passed

pnpm run build
Result: passed

git diff --check -- <R56 files>
Result: passed
```

The production build reports existing dependency/chunk warnings (`lottie-web` eval, mixed dynamic/static imports, and large chunks); it reports no build error.

## Legacy Scan

The production workspace has no remaining:

- native `input`, `button`, or `table` elements;
- `window.confirm` or `window.prompt`;
- `components/common` imports;
- legacy `card`, `input`, `btn`, Tailwind palette, dark utility, rounded utility, or `flex` visual classes;
- hard-coded color values, `:deep()`, or `!important` patches.

The remaining scoped CSS controls only workspace width, contextual spacing, the compact expiry-field width, and ordered-list layout.

## Browser Gate

The live local preview was opened at:

```text
http://127.0.0.1:4174/admin/settings?tab=backup
```

The existing Edge session was not authenticated for the local Sub2API instance and correctly redirected to:

```text
/login?redirect=/admin/settings?tab=backup
```

No credentials or database state were changed to bypass authentication. Therefore the following route-level evidence remains pending and must not be reported as passed:

- authenticated `1440px`, `900px`, and `390px` screenshots;
- dark-mode and reduced-motion route screenshots;
- keyboard/focus traversal through the real Settings page;
- real API success/empty/error/slow-request visual states and browser-console inspection.

Automated implementation gates are green. R56 route-level browser acceptance remains open until a real local administrator session is available.
