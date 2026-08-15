# R28 Risk Control Settings Shell Acceptance

## Scope

- Replaced the risk-control settings and input-detail legacy dialogs with shared dialogs.
- Replaced the hand-built settings tab strip with the shared keyboard-aware tabs component.
- Migrated the basic enabled, mode, URL, model, timeout, retry, and sample-rate fields to shared compact controls.
- Replaced the input-detail card stack with a semantic status, description list, and code block.
- Preserved all existing form state, platform/domain selectors, settings sections, and the complete `saveConfig()` payload builder.

## Verification

- Existing risk-control page suite: 5 tests passed after updating dialog test stubs to the shared UI contract.
- Verified settings layout, model-filter payload, threshold payload, observe metrics, and pre-block metrics remain intact.
- `vue-tsc --noEmit`, targeted ESLint, and `git diff --check` passed.
