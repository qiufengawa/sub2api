-- Add a subscription-wide five-hour quota. Historical plans and subscriptions
-- stay unlimited because the quota columns are nullable and are not backfilled.
ALTER TABLE subscription_plans
    ADD COLUMN IF NOT EXISTS five_hour_quota_usd DECIMAL(20, 10);

ALTER TABLE user_subscriptions
    ADD COLUMN IF NOT EXISTS five_hour_quota_usd DECIMAL(20, 10),
    ADD COLUMN IF NOT EXISTS five_hour_started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS five_hour_usage_usd DECIMAL(20, 10) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS five_hour_reserved_usd DECIMAL(20, 10) NOT NULL DEFAULT 0;

-- Reservations created by the previous release already contribute to the
-- cycle and term counters. Mirror live holds so rolling-upgrade settlement and
-- release can update all three dimensions without producing a negative value.
UPDATE user_subscriptions us
SET five_hour_reserved_usd = pending.reserved_amount
FROM (
    SELECT subscription_id, SUM(reserved_amount) AS reserved_amount
    FROM billing_reservations
    WHERE status = 'pending' AND subscription_id IS NOT NULL
    GROUP BY subscription_id
) pending
WHERE us.id = pending.subscription_id
  AND us.five_hour_reserved_usd = 0;

ALTER TABLE subscription_plans
    DROP CONSTRAINT IF EXISTS subscription_plans_five_hour_quota_positive;
ALTER TABLE subscription_plans
    ADD CONSTRAINT subscription_plans_five_hour_quota_positive
    CHECK (
        five_hour_quota_usd IS NULL OR (
            five_hour_quota_usd > 0 AND
            five_hour_quota_usd::TEXT NOT IN ('NaN', 'Infinity', '-Infinity')
        )
    );

ALTER TABLE user_subscriptions
    DROP CONSTRAINT IF EXISTS user_subscriptions_five_hour_quota_positive;
ALTER TABLE user_subscriptions
    ADD CONSTRAINT user_subscriptions_five_hour_quota_positive
    CHECK (
        five_hour_quota_usd IS NULL OR (
            five_hour_quota_usd > 0 AND
            five_hour_quota_usd::TEXT NOT IN ('NaN', 'Infinity', '-Infinity')
        )
    );

ALTER TABLE user_subscriptions
    DROP CONSTRAINT IF EXISTS user_subscriptions_five_hour_usage_nonnegative;
ALTER TABLE user_subscriptions
    ADD CONSTRAINT user_subscriptions_five_hour_usage_nonnegative
    CHECK (
        five_hour_usage_usd >= 0 AND
        five_hour_usage_usd::TEXT NOT IN ('NaN', 'Infinity', '-Infinity')
    );

ALTER TABLE user_subscriptions
    DROP CONSTRAINT IF EXISTS user_subscriptions_five_hour_reserved_nonnegative;
ALTER TABLE user_subscriptions
    ADD CONSTRAINT user_subscriptions_five_hour_reserved_nonnegative
    CHECK (
        five_hour_reserved_usd >= 0 AND
        five_hour_reserved_usd::TEXT NOT IN ('NaN', 'Infinity', '-Infinity')
    );
