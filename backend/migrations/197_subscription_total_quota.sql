-- Add an optional quota for the complete subscription validity term. The
-- existing cycle quota continues to reset independently; both limits apply.
-- NULL intentionally means unlimited so historical subscriptions preserve
-- their pre-migration behavior until they are renewed with a new plan snapshot.

ALTER TABLE subscription_plans
    ADD COLUMN IF NOT EXISTS total_quota_usd DECIMAL(20, 10);

ALTER TABLE user_subscriptions
    ADD COLUMN IF NOT EXISTS total_quota_usd DECIMAL(20, 10),
    ADD COLUMN IF NOT EXISTS total_usage_usd DECIMAL(20, 10) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_reserved_usd DECIMAL(20, 10) NOT NULL DEFAULT 0;

-- Reservations created by the previous release already contribute to
-- cycle_reserved_usd. Mirror those live holds so they can settle or release
-- through the new two-dimensional accounting path after a rolling upgrade.
UPDATE user_subscriptions us
SET total_reserved_usd = pending.reserved_amount
FROM (
    SELECT subscription_id, SUM(reserved_amount) AS reserved_amount
    FROM billing_reservations
    WHERE status = 'pending' AND subscription_id IS NOT NULL
    GROUP BY subscription_id
) pending
WHERE us.id = pending.subscription_id
  AND us.total_reserved_usd = 0;

-- Older batch-image holds were introduced before reservation leases and omitted
-- lease columns. Give every still-pending hold a bounded recovery window so
-- a crashed worker cannot keep cycle or term quota reserved forever. Active
-- batches finish or are recovered by their own worker lifecycle well before the
-- 24-hour safety window.
UPDATE billing_reservations
SET last_heartbeat_at = COALESCE(last_heartbeat_at, NOW()),
    lease_expires_at = COALESCE(lease_expires_at, NOW() + INTERVAL '24 hours')
WHERE status = 'pending'
  AND lease_expires_at IS NULL;

ALTER TABLE subscription_plans
    DROP CONSTRAINT IF EXISTS subscription_plans_total_quota_usd_positive;
ALTER TABLE subscription_plans
    ADD CONSTRAINT subscription_plans_total_quota_usd_positive
    CHECK (total_quota_usd IS NULL OR total_quota_usd > 0);

ALTER TABLE user_subscriptions
    DROP CONSTRAINT IF EXISTS user_subscriptions_total_quota_usd_positive;
ALTER TABLE user_subscriptions
    ADD CONSTRAINT user_subscriptions_total_quota_usd_positive
    CHECK (total_quota_usd IS NULL OR total_quota_usd > 0);

ALTER TABLE user_subscriptions
    DROP CONSTRAINT IF EXISTS user_subscriptions_total_usage_usd_nonnegative;
ALTER TABLE user_subscriptions
    ADD CONSTRAINT user_subscriptions_total_usage_usd_nonnegative
    CHECK (total_usage_usd >= 0);

ALTER TABLE user_subscriptions
    DROP CONSTRAINT IF EXISTS user_subscriptions_total_reserved_usd_nonnegative;
ALTER TABLE user_subscriptions
    ADD CONSTRAINT user_subscriptions_total_reserved_usd_nonnegative
    CHECK (total_reserved_usd >= 0);
