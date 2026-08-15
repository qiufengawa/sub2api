# R27 Risk Control Observability Acceptance

## Scope

- Rebuilt the risk-control page header, primary actions, summary metrics, log filters, log table, status treatments, empty state, and pagination with shared UI primitives.
- Kept the ten-column moderation log as a mobile-scrollable comparison table and preserved detail, unban, model-filter summary, date normalization, and pagination behavior.
- Added request-generation protection so overlapping log queries cannot replace current results with stale responses.
- Deliberately left the settings form and `saveConfig()` payload construction unchanged in this slice to protect API-key, proxy, threshold, retention, and ban semantics.

## Verification

- Existing risk-control page suite: 5 tests passed.
- Verified settings structure, model-filter payload, threshold payload, observe-mode worker metrics, and pre-block metrics remain intact.
- `vue-tsc --noEmit`, targeted ESLint, and `git diff --check` passed.
