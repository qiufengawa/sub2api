-- Allow a plan to opt in to multiple independent subscription instances per
-- user. Existing plans remain single-instance because the default is one.
ALTER TABLE subscription_plans
    ADD COLUMN IF NOT EXISTS max_subscriptions_per_user INTEGER NOT NULL DEFAULT 1;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'subscription_plans_max_subscriptions_per_user_check'
	      AND conrelid = 'subscription_plans'::regclass
    ) THEN
        ALTER TABLE subscription_plans
            ADD CONSTRAINT subscription_plans_max_subscriptions_per_user_check
            CHECK (max_subscriptions_per_user >= 1);
    END IF;
END $$;

ALTER TABLE payment_orders
    ADD COLUMN IF NOT EXISTS fulfilled_subscription_id BIGINT NULL;

DROP INDEX IF EXISTS user_subscriptions_user_plan_unique_active;

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_plan
    ON user_subscriptions (user_id, plan_id)
    WHERE deleted_at IS NULL AND plan_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_plan_occupancy
    ON user_subscriptions (user_id, plan_id, status, expires_at, id)
    WHERE deleted_at IS NULL AND plan_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_orders_fulfilled_subscription_id
    ON payment_orders (fulfilled_subscription_id)
    WHERE fulfilled_subscription_id IS NOT NULL;
