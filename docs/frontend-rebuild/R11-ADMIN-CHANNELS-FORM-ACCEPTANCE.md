# R11 Admin Channels Form Acceptance

## Scope

- Rebuilt the remaining channel form controls on top of `@/components/ui`.
- Replaced legacy platform/group checkboxes, mapping inputs, rule actions, and account search UI.
- Rebuilt channel pricing entries, model tag input, and interval rows with the shared compact controls.
- Preserved existing channel CRUD, pricing serialization, conflict validation, account rule search, and feature configuration contracts.

## Contract Checks

- `adminAPI.channels.list/create/update/remove` unchanged.
- Server-side sorting, pagination, filtering, abort handling, and conflict loading unchanged.
- `model_pricing`, `model_mapping`, `account_stats_pricing_rules`, and feature configuration payloads unchanged.
- Model paste/import behavior preserved through `UiTagInput`.
- Existing boolean and object forms of `bedrock_cc_compat` remain readable.

## Verification

- `ChannelsView.spec.ts`: 2 tests passed.
- Full frontend suite: 278 files, 1907 tests passed.
- `vue-tsc --noEmit`: passed.
- Targeted ESLint: passed.
- Production Vite build: passed.
- `git diff --check`: passed.

## Residual Risk

- Browser screenshot validation remains pending because the available Edge extension blocks local Vite URLs.
- The backend currently rejects `video` channel billing mode even though the existing frontend contract still exposes it. This mismatch predates the visual rebuild and requires a separate product/API decision.
