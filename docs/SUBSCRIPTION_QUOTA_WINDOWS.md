# Subscription Quota Windows

This document defines the quota contract for Qiu API subscription plans. It is
the source of truth for plan configuration, billing reservations, renewals,
catalog import, and quota displays.

## Quota dimensions

A subscription can enforce three independent quota dimensions:

| Dimension | Window | Unlimited value |
| --- | --- | --- |
| Five-hour quota | 18,000 seconds | `NULL` or a non-positive API input normalized to `NULL` |
| Cycle quota | 604,800 seconds for the Qiu monthly catalog | `NULL` |
| Term quota | The subscription entitlement term | `NULL` |

The effective capacity for a request is the minimum remaining capacity across
all enabled dimensions. Disabling the five-hour quota does not disable the
cycle quota, term quota, API key limits, RPM limits, or concurrency limits.

API key five-hour limits are separate safety controls. They are intentionally
not reused for subscription accounting because a user can own multiple API
keys. Subscription counters belong to the user subscription and are shared by
every API key that spends that entitlement.

## Window behavior

- Five-hour and cycle windows are fixed-duration windows anchored to their
  stored start time. They are not sliding windows and are not aligned to wall
  clock boundaries.
- At `now >= window_start + duration`, the expired window usage becomes zero
  and the start advances by whole periods. This avoids window drift after an
  idle interval.
- Resetting the five-hour window does not reset cycle or term usage.
- Resetting the cycle window does not reset five-hour or term usage.
- A subscription is unavailable at `now >= expires_at`; term usage never resets
  merely because a shorter window resets.
- Pending reservations survive a window boundary. Their reserved amount stays
  committed until settlement or release, and a settlement after the boundary
  counts toward the new short window. This conservative rule prevents a
  boundary from creating free capacity.

For a 30-day Qiu monthly entitlement, cycle windows are `[0d, 7d)`, `[7d,
14d)`, `[14d, 21d)`, `[21d, 28d)`, and `[28d, 30d)`. The final partial window
still has the configured cycle limit, while the term quota remains the final
cap.

## Reservation and settlement

The database row for the selected subscription is the authority. A funding
decision must lock the row and evaluate, for every enabled dimension:

```text
usage + reserved + estimated_request_cost <= quota
```

Reservation, settlement, release, and expired-lease cleanup must update all
three dimensions in the same transaction:

- reserve: add the estimate to each reserved counter;
- settle: subtract the estimate from each reserved counter and add actual cost
  to each usage counter;
- release: subtract the estimate from each reserved counter;
- cleanup: perform the same release before marking the reservation released.

The existing billing rule for underestimated successful requests is retained:
the full actual cost is recorded against the selected subscription, even when
it exceeds the estimate. This avoids turning a successful upstream request
into an unbilled request. The next admission observes the resulting exhausted
quota. Reservation estimates should remain conservative to minimize this
single-request settlement delta.

When no subscription can reserve the estimate, wallet fallback follows the
plan and user billing preference already stored by the billing resolver. The
failure reason should identify whether five-hour, cycle, or term capacity was
exhausted without changing the existing payment state machine.

## Configuration contract

- Plan create and edit APIs accept missing, `null`, or `0` five-hour quota as
  unlimited and store it as `NULL`.
- Negative, non-finite, or otherwise invalid quota values are rejected.
- For catalog updates, a missing five-hour field preserves the existing plan
  value. Explicit `null` or `0` clears the limit. A positive value replaces it.
- For catalog creates, a missing field creates an unlimited five-hour quota.
- Order snapshots capture the five-hour quota at checkout so later catalog
  edits cannot change a paid order.

Snapshot version 4 carries the new field. Version 2 and 3 snapshots remain
valid and mean that no five-hour value was captured. Fulfilling a legacy order
must not introduce a five-hour limit retroactively.

## Renewal contract

- An early renewal extends the current entitlement and adds the newly
  purchased term quota. It does not reset active five-hour or cycle windows.
- A renewal after expiry starts a new entitlement term and resets five-hour,
  cycle, and term usage according to the existing renewal transaction.
- Reserved amounts are never silently discarded. Lease cleanup and settlement
  must leave every reserved counter non-negative before and after renewal.
- Existing 28-day subscriptions keep their stored `expires_at` value.

## Qiu monthly catalog

The built-in five-tier catalog uses a 30-day entitlement term without making
the generic subscription engine globally month-only:

| Plan | Five-hour quota | Seven-day quota | Term quota |
| --- | ---: | ---: | ---: |
| Lite | Unlimited | 5 | 20 |
| Starter | Unlimited | 15 | 60 |
| Standard | Unlimited | 40 | 160 |
| Pro | Unlimited | 100 | 400 |
| Max | Unlimited | 250 | 1000 |

Catalog import changes plan definitions for future purchases and renewals. A
release migration must not insert, delete, or rewrite business plan rows.
