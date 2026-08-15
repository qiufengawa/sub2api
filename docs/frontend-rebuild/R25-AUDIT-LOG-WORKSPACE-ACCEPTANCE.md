# R25 Audit Log Workspace Acceptance

## Scope

- Rebuilt the audit-log filters, table workspace, pagination, detail surface, custom time range, confirmation, and TOTP prompt with shared UI primitives.
- Preserved the fixed server-side time ordering, query field semantics, local-time to RFC3339 conversion, pagination resets, TOTP gate, clear payload, and post-clear refresh.
- Kept the audit table as a horizontally scrollable comparison table on narrow screens.
- Replaced nested detail cards with a drawer, description list, semantic status, and structured code blocks.
- Added request-generation guards so stale list or detail responses cannot overwrite the latest view state.
- Added distinct empty states for an empty audit store and a filter with no matches.

## Verification

- Audit workspace contract suite: 4 tests passed.
- Verified initial query shape, custom UTC range, stale detail response protection, and the TOTP clear chain.
- `vue-tsc --noEmit`, targeted ESLint, and `git diff --check` passed.
