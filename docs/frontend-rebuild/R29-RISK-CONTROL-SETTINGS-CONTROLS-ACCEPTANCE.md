# R29 Risk Control Settings Controls Acceptance

## Scope

- Replaced the remaining native controls in the risk-control settings workflow with shared compact controls.
- Migrated API-key actions, group scope, model filtering, runtime, response, thresholds, keywords, retention, and flagged-hash tools without changing the settings payload.
- Replaced the browser confirmation for clearing flagged hashes with the shared pending-aware destructive confirmation dialog.
- Preserved group and model normalization, percentage-to-decimal threshold conversion, keyword deduplication, retention bounds, and API-key deletion semantics.
- Extended the shared radio group with optional descriptions and reset the shared file input after selection so the same file can be selected repeatedly.

## Verification

- Risk-control and updated shared-control suites: 9 tests passed.
- Covered model-filter payload, threshold payload, API-key write-mode locking, flagged-hash confirmation, runtime metrics, radio descriptions, and repeated file selection.
- `vue-tsc --noEmit`, targeted ESLint, legacy-control scan, and `git diff --check` passed.
