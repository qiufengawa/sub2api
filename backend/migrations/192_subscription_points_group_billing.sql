-- Decouple subscription quota from the real routing/pricing group.
-- This migration is additive: legacy group_id columns and billing paths remain
-- available until the feature flag is enabled and the rollout is complete.

ALTER TABLE subscription_plans
    ADD COLUMN IF NOT EXISTS cycle_quota_usd DECIMAL(20, 10),
    ADD COLUMN IF NOT EXISTS reset_interval_seconds INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS wallet_fallback_enabled BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS subscription_plan_groups (
    plan_id BIGINT NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
    group_id BIGINT NOT NULL REFERENCES groups(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (plan_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_subscription_plan_groups_group_id
    ON subscription_plan_groups (group_id);

INSERT INTO subscription_plan_groups (plan_id, group_id)
SELECT id, group_id
FROM subscription_plans
WHERE group_id > 0
ON CONFLICT (plan_id, group_id) DO NOTHING;

ALTER TABLE user_subscriptions
    ADD COLUMN IF NOT EXISTS plan_id BIGINT REFERENCES subscription_plans(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS cycle_quota_usd DECIMAL(20, 10),
    ADD COLUMN IF NOT EXISTS reset_interval_seconds INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cycle_started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cycle_usage_usd DECIMAL(20, 10) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cycle_reserved_usd DECIMAL(20, 10) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS wallet_fallback_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- Preserve the existing subscription window as a best-effort snapshot for
-- legacy subscriptions. Weekly is preferred because existing Qiu plans reset
-- every seven days; daily/monthly remain supported for old installations.
UPDATE user_subscriptions us
SET cycle_quota_usd = COALESCE(g.weekly_limit_usd, g.daily_limit_usd, g.monthly_limit_usd),
    reset_interval_seconds = CASE
        WHEN g.weekly_limit_usd IS NOT NULL THEN 604800
        WHEN g.daily_limit_usd IS NOT NULL THEN 86400
        WHEN g.monthly_limit_usd IS NOT NULL THEN 2592000
        ELSE 0
    END,
    cycle_started_at = CASE
        WHEN g.weekly_limit_usd IS NOT NULL THEN COALESCE(us.weekly_window_start, us.starts_at)
        WHEN g.daily_limit_usd IS NOT NULL THEN COALESCE(us.daily_window_start, us.starts_at)
        WHEN g.monthly_limit_usd IS NOT NULL THEN COALESCE(us.monthly_window_start, us.starts_at)
        ELSE us.starts_at
    END,
    cycle_usage_usd = CASE
        WHEN g.weekly_limit_usd IS NOT NULL THEN us.weekly_usage_usd
        WHEN g.daily_limit_usd IS NOT NULL THEN us.daily_usage_usd
        WHEN g.monthly_limit_usd IS NOT NULL THEN us.monthly_usage_usd
        ELSE 0
    END
FROM groups g
WHERE us.group_id = g.id
  AND us.cycle_quota_usd IS NULL;

DROP INDEX IF EXISTS user_subscriptions_user_group_unique_active;
CREATE UNIQUE INDEX IF NOT EXISTS user_subscriptions_user_group_unique_legacy
    ON user_subscriptions (user_id, group_id)
    WHERE deleted_at IS NULL AND plan_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS user_subscriptions_user_plan_unique_active
    ON user_subscriptions (user_id, plan_id)
    WHERE deleted_at IS NULL AND plan_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_plan_id
    ON user_subscriptions (plan_id)
    WHERE plan_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_billing_candidate
    ON user_subscriptions (user_id, status, expires_at, plan_id)
    WHERE deleted_at IS NULL;

ALTER TABLE payment_orders
    ADD COLUMN IF NOT EXISTS subscription_plan_snapshot JSONB;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS billing_preference VARCHAR(24) NOT NULL DEFAULT 'subscription_first';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'users_billing_preference_check'
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT users_billing_preference_check
            CHECK (billing_preference IN (
                'subscription_first', 'wallet_first',
                'subscription_only', 'wallet_only'
            ));
    END IF;
END $$;

ALTER TABLE usage_logs
    ADD COLUMN IF NOT EXISTS billing_source VARCHAR(24) NOT NULL DEFAULT 'legacy',
    ADD COLUMN IF NOT EXISTS billing_preference VARCHAR(24),
    ADD COLUMN IF NOT EXISTS billing_fallback_reason VARCHAR(64);

UPDATE usage_logs
SET billing_source = CASE WHEN billing_type = 1 THEN 'subscription' ELSE 'wallet' END
WHERE billing_source = 'legacy';

CREATE TABLE IF NOT EXISTS billing_reservations (
    id BIGSERIAL PRIMARY KEY,
    request_id VARCHAR(128) NOT NULL,
    api_key_id BIGINT NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id BIGINT REFERENCES groups(id) ON DELETE SET NULL,
    subscription_id BIGINT REFERENCES user_subscriptions(id) ON DELETE SET NULL,
    billing_source VARCHAR(24) NOT NULL,
    billing_preference VARCHAR(24) NOT NULL,
    fallback_reason VARCHAR(64),
    reserved_amount DECIMAL(20, 10) NOT NULL DEFAULT 0,
    final_amount DECIMAL(20, 10) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    settled_at TIMESTAMPTZ,
    released_at TIMESTAMPTZ,
    UNIQUE (request_id, api_key_id)
);

CREATE INDEX IF NOT EXISTS idx_billing_reservations_user_time
    ON billing_reservations (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_reservations_subscription_time
    ON billing_reservations (subscription_id, created_at DESC)
    WHERE subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_billing_reservations_pending
    ON billing_reservations (status, created_at)
    WHERE status = 'pending';
