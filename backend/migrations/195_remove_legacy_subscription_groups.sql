-- Make subscription plans the only subscription entitlement model.
-- Legacy group-bound subscriptions are converted to hidden plans first so
-- active entitlements survive the removal of the scalar group columns.

-- Keep the migration directly rerunnable for preview and recovery workflows.
-- On an already-migrated schema these nullable staging columns contain no
-- data and are removed again at the end of this migration.
ALTER TABLE subscription_plans
    ADD COLUMN IF NOT EXISTS group_id BIGINT;
ALTER TABLE user_subscriptions
    ADD COLUMN IF NOT EXISTS group_id BIGINT;
ALTER TABLE payment_orders
    ADD COLUMN IF NOT EXISTS subscription_group_id BIGINT;
ALTER TABLE redeem_codes
    ADD COLUMN IF NOT EXISTS group_id BIGINT;

ALTER TABLE redeem_codes
    ADD COLUMN IF NOT EXISTS plan_id BIGINT;

-- Default-subscription settings used group_id before plans became the sole
-- entitlement model. Validate the JSON up front so malformed configuration
-- aborts this transactional migration instead of being silently discarded.
DO $$
DECLARE
    setting_row RECORD;
    setting_value JSONB;
    setting_item JSONB;
BEGIN
    FOR setting_row IN
        SELECT key, value
        FROM settings
        WHERE key = 'default_subscriptions'
           OR key LIKE 'auth_source_default_%_subscriptions'
    LOOP
        BEGIN
            setting_value := setting_row.value::JSONB;
        EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'cannot migrate legacy subscription setting %: value is not valid JSON', setting_row.key;
        END;

        IF jsonb_typeof(setting_value) <> 'array' THEN
            RAISE EXCEPTION 'cannot migrate legacy subscription setting %: value must be a JSON array', setting_row.key;
        END IF;

        FOR setting_item IN SELECT value FROM jsonb_array_elements(setting_value)
        LOOP
            IF jsonb_typeof(setting_item) <> 'object'
               OR NOT (setting_item ? 'validity_days')
               OR COALESCE(setting_item->>'validity_days', '') !~ '^[1-9][0-9]*$'
               OR (setting_item ? 'plan_id' AND COALESCE(setting_item->>'plan_id', '') !~ '^[1-9][0-9]*$')
               OR (setting_item ? 'group_id' AND COALESCE(setting_item->>'group_id', '') !~ '^[1-9][0-9]*$')
               OR (setting_item ? 'plan_id' AND setting_item ? 'group_id')
               OR (NOT (setting_item ? 'plan_id') AND NOT (setting_item ? 'group_id')) THEN
                RAISE EXCEPTION 'cannot migrate legacy subscription setting %: invalid item %', setting_row.key, setting_item;
            END IF;
        END LOOP;
    END LOOP;
END $$;

CREATE TEMP TABLE legacy_subscription_group_plan_map (
    group_id BIGINT PRIMARY KEY,
    plan_id BIGINT NOT NULL
);

DO $$
DECLARE
    legacy_group RECORD;
    migrated_plan_id BIGINT;
BEGIN
    FOR legacy_group IN
        SELECT DISTINCT g.*
        FROM groups g
        WHERE EXISTS (
            SELECT 1
            FROM user_subscriptions us
            WHERE us.group_id = g.id
              AND us.plan_id IS NULL
        ) OR EXISTS (
            SELECT 1
            FROM redeem_codes rc
            WHERE rc.group_id = g.id
              AND rc.type = 'subscription'
              AND rc.plan_id IS NULL
        ) OR EXISTS (
            SELECT 1
            FROM payment_orders po
            WHERE po.subscription_group_id = g.id
              AND po.order_type = 'subscription'
              AND po.plan_id IS NULL
        ) OR EXISTS (
            SELECT 1
            FROM settings s
            CROSS JOIN LATERAL jsonb_array_elements(s.value::JSONB) AS setting_item(value)
            WHERE (s.key = 'default_subscriptions'
                   OR s.key LIKE 'auth_source_default_%_subscriptions')
              AND setting_item.value ? 'group_id'
              AND (setting_item.value->>'group_id')::BIGINT = g.id
        )
    LOOP
        SELECT id
        INTO migrated_plan_id
        FROM subscription_plans
        WHERE product_name = 'legacy-group-' || legacy_group.id
        ORDER BY id
        LIMIT 1;

        IF migrated_plan_id IS NULL THEN
            INSERT INTO subscription_plans (
                group_id,
                name,
                description,
                price,
                original_price,
                currency,
                cycle_quota_usd,
                reset_interval_seconds,
                wallet_fallback_enabled,
                validity_days,
                validity_unit,
                features,
                product_name,
                for_sale,
                sort_order,
                created_at,
                updated_at
            ) VALUES (
                legacy_group.id,
                LEFT('[Migrated] ' || legacy_group.name, 100),
                'Automatically migrated from a legacy group-bound subscription.',
                0,
                NULL,
                '',
                COALESCE(
                    legacy_group.weekly_limit_usd,
                    legacy_group.daily_limit_usd,
                    legacy_group.monthly_limit_usd
                ),
                CASE
                    WHEN legacy_group.weekly_limit_usd IS NOT NULL THEN 604800
                    WHEN legacy_group.daily_limit_usd IS NOT NULL THEN 86400
                    WHEN legacy_group.monthly_limit_usd IS NOT NULL THEN 2592000
                    ELSE 0
                END,
                TRUE,
                GREATEST(legacy_group.default_validity_days, 1),
                'day',
                '',
                'legacy-group-' || legacy_group.id,
                FALSE,
                0,
                NOW(),
                NOW()
            )
            RETURNING id INTO migrated_plan_id;
        END IF;

        INSERT INTO subscription_plan_groups (plan_id, group_id)
        VALUES (migrated_plan_id, legacy_group.id)
        ON CONFLICT (plan_id, group_id) DO NOTHING;

        INSERT INTO legacy_subscription_group_plan_map (group_id, plan_id)
        VALUES (legacy_group.id, migrated_plan_id)
        ON CONFLICT (group_id) DO UPDATE
        SET plan_id = EXCLUDED.plan_id;

        UPDATE user_subscriptions
        SET plan_id = migrated_plan_id
        WHERE plan_id IS NULL
          AND group_id = legacy_group.id;

        UPDATE payment_orders
        SET plan_id = migrated_plan_id
        WHERE order_type = 'subscription'
          AND plan_id IS NULL
          AND subscription_group_id = legacy_group.id;

        UPDATE redeem_codes
        SET plan_id = migrated_plan_id
        WHERE type = 'subscription'
          AND plan_id IS NULL
          AND group_id = legacy_group.id;
    END LOOP;
END $$;

-- Group deletion historically set redeem_codes.group_id to NULL. Such a code
-- no longer carries enough information to reconstruct an entitlement. Keep
-- used-code history, disable any still-unused code, and point the rows at one
-- hidden plan with no covered routes. Orders and active subscriptions remain
-- strict below because silently inventing paid or active entitlement there
-- would be unsafe.
ALTER TABLE subscription_plans
    ALTER COLUMN group_id DROP NOT NULL;

DO $$
DECLARE
    unresolved_plan_id BIGINT;
BEGIN
    IF EXISTS (
        SELECT 1
        FROM redeem_codes rc
        LEFT JOIN groups g ON g.id = rc.group_id
        WHERE rc.type = 'subscription'
          AND rc.plan_id IS NULL
          AND g.id IS NULL
    ) THEN
        SELECT id
        INTO unresolved_plan_id
        FROM subscription_plans
        WHERE product_name = 'legacy-unresolved-subscription-codes'
        ORDER BY id
        LIMIT 1;

        IF unresolved_plan_id IS NULL THEN
            INSERT INTO subscription_plans (
                group_id,
                name,
                description,
                price,
                original_price,
                currency,
                cycle_quota_usd,
                reset_interval_seconds,
                wallet_fallback_enabled,
                validity_days,
                validity_unit,
                features,
                product_name,
                for_sale,
                sort_order,
                created_at,
                updated_at
            ) VALUES (
                NULL,
                '[Migrated] Unresolved subscription codes',
                'Historical subscription codes whose deleted group could not be reconstructed.',
                0,
                NULL,
                '',
                NULL,
                0,
                FALSE,
                30,
                'day',
                '',
                'legacy-unresolved-subscription-codes',
                FALSE,
                0,
                NOW(),
                NOW()
            )
            RETURNING id INTO unresolved_plan_id;
        END IF;

        UPDATE redeem_codes rc
        SET plan_id = unresolved_plan_id,
            status = CASE WHEN rc.status = 'unused' THEN 'disabled' ELSE rc.status END
        WHERE rc.type = 'subscription'
          AND rc.plan_id IS NULL
          AND NOT EXISTS (
              SELECT 1
              FROM groups g
              WHERE g.id = rc.group_id
          );
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM settings s
        CROSS JOIN LATERAL jsonb_array_elements(s.value::JSONB) AS setting_item(value)
        LEFT JOIN legacy_subscription_group_plan_map migrated
          ON migrated.group_id = (setting_item.value->>'group_id')::BIGINT
        WHERE (s.key = 'default_subscriptions'
               OR s.key LIKE 'auth_source_default_%_subscriptions')
          AND setting_item.value ? 'group_id'
          AND migrated.plan_id IS NULL
    ) THEN
        RAISE EXCEPTION 'cannot remove legacy subscription groups: a default-subscription setting references an unknown group';
    END IF;
END $$;

WITH migrated_settings AS (
    SELECT
        s.id,
        jsonb_agg(
            CASE
                WHEN setting_item.value ? 'group_id' THEN
                    (setting_item.value - 'group_id') ||
                    jsonb_build_object('plan_id', group_plan.plan_id)
                ELSE setting_item.value
            END
            ORDER BY setting_item.ordinality
        ) AS value
    FROM settings s
    CROSS JOIN LATERAL jsonb_array_elements(s.value::JSONB) WITH ORDINALITY AS setting_item(value, ordinality)
    LEFT JOIN legacy_subscription_group_plan_map group_plan
      ON setting_item.value ? 'group_id'
     AND group_plan.group_id = (setting_item.value->>'group_id')::BIGINT
    WHERE s.key = 'default_subscriptions'
       OR s.key LIKE 'auth_source_default_%_subscriptions'
    GROUP BY s.id
)
UPDATE settings s
SET value = migrated_settings.value::TEXT,
    updated_at = NOW()
FROM migrated_settings
WHERE s.id = migrated_settings.id
  AND s.value IS DISTINCT FROM migrated_settings.value::TEXT;

DROP TABLE IF EXISTS legacy_subscription_group_plan_map;

-- Every subscription order must carry an immutable plan snapshot before the
-- legacy order-level group column is removed. Existing v1 snapshots already
-- contain the full group set, so only the obsolete primary field is removed.
UPDATE payment_orders
SET subscription_plan_snapshot =
    (subscription_plan_snapshot - 'primary_group_id') ||
    jsonb_build_object(
        'schema_version', 2,
        'plan_id', plan_id
    )
WHERE order_type = 'subscription'
  AND plan_id IS NOT NULL
  AND subscription_plan_snapshot IS NOT NULL
  AND jsonb_typeof(subscription_plan_snapshot) = 'object';

UPDATE payment_orders po
SET subscription_plan_snapshot = jsonb_build_object(
    'schema_version', 2,
    'plan_id', p.id,
    'plan_name', p.name,
    'included_group_ids', COALESCE(groups.group_ids, '[]'::jsonb),
    'included_group_names', COALESCE(groups.group_names, '[]'::jsonb),
    'cycle_quota_usd', p.cycle_quota_usd,
    'reset_interval_seconds', p.reset_interval_seconds,
    'wallet_fallback_enabled', p.wallet_fallback_enabled,
    'validity_days', COALESCE(po.subscription_days, p.validity_days)
)
FROM subscription_plans p
LEFT JOIN LATERAL (
    SELECT
        jsonb_agg(spg.group_id ORDER BY spg.group_id) AS group_ids,
        jsonb_agg(g.name ORDER BY spg.group_id) AS group_names
    FROM subscription_plan_groups spg
    JOIN groups g ON g.id = spg.group_id
    WHERE spg.plan_id = p.id
) groups ON TRUE
WHERE po.order_type = 'subscription'
  AND po.plan_id = p.id
  AND po.subscription_plan_snapshot IS NULL;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM user_subscriptions WHERE plan_id IS NULL) THEN
        RAISE EXCEPTION 'cannot remove legacy subscription groups: subscriptions without a plan remain';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM payment_orders
        WHERE order_type = 'subscription'
          AND (
              plan_id IS NULL
              OR subscription_plan_snapshot IS NULL
              OR jsonb_typeof(subscription_plan_snapshot) <> 'object'
              OR COALESCE(subscription_plan_snapshot->>'schema_version', '') <> '2'
              OR COALESCE(subscription_plan_snapshot->>'plan_id', '') <> plan_id::TEXT
              OR COALESCE(subscription_plan_snapshot->>'validity_days', '') !~ '^[1-9][0-9]*$'
              OR CASE
                  WHEN jsonb_typeof(subscription_plan_snapshot->'included_group_ids') = 'array'
                  THEN jsonb_array_length(subscription_plan_snapshot->'included_group_ids') = 0
                  ELSE TRUE
              END
          )
    ) THEN
        RAISE EXCEPTION 'cannot remove legacy subscription groups: subscription orders without a valid plan snapshot remain';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM redeem_codes
        WHERE type = 'subscription'
          AND plan_id IS NULL
    ) THEN
        RAISE EXCEPTION 'cannot remove legacy subscription groups: subscription redeem codes without a plan remain';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM settings s
        CROSS JOIN LATERAL jsonb_array_elements(s.value::JSONB) AS setting_item(value)
        LEFT JOIN subscription_plans p
          ON p.id = (setting_item.value->>'plan_id')::BIGINT
        WHERE (s.key = 'default_subscriptions'
               OR s.key LIKE 'auth_source_default_%_subscriptions')
          AND (NOT (setting_item.value ? 'plan_id') OR p.id IS NULL)
    ) THEN
        RAISE EXCEPTION 'cannot remove legacy subscription groups: default-subscription settings without a valid plan remain';
    END IF;
END $$;

DROP INDEX IF EXISTS idx_subscription_plans_group_id;
ALTER TABLE subscription_plans
    DROP COLUMN IF EXISTS group_id;

DROP INDEX IF EXISTS idx_user_subscriptions_group_id;
DROP INDEX IF EXISTS user_subscriptions_user_group_unique_active;
DROP INDEX IF EXISTS user_subscriptions_user_group_unique_legacy;
ALTER TABLE user_subscriptions
    DROP CONSTRAINT IF EXISTS user_subscriptions_user_id_group_id_key,
    DROP CONSTRAINT IF EXISTS user_subscriptions_group_id_fkey,
    DROP COLUMN IF EXISTS group_id,
    ALTER COLUMN plan_id SET NOT NULL;

ALTER TABLE user_subscriptions
    DROP CONSTRAINT IF EXISTS user_subscriptions_plan_id_fkey;
ALTER TABLE user_subscriptions
    ADD CONSTRAINT user_subscriptions_plan_id_fkey
    FOREIGN KEY (plan_id) REFERENCES subscription_plans(id) ON DELETE RESTRICT;

ALTER TABLE payment_orders
    DROP COLUMN IF EXISTS subscription_group_id;
ALTER TABLE payment_orders
    DROP CONSTRAINT IF EXISTS payment_orders_plan_id_fkey;
ALTER TABLE payment_orders
    ADD CONSTRAINT payment_orders_plan_id_fkey
    FOREIGN KEY (plan_id) REFERENCES subscription_plans(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_payment_orders_plan_id
    ON payment_orders (plan_id)
    WHERE plan_id IS NOT NULL;

DROP INDEX IF EXISTS idx_redeem_codes_group_id;
ALTER TABLE redeem_codes
    DROP CONSTRAINT IF EXISTS redeem_codes_group_id_fkey,
    DROP COLUMN IF EXISTS group_id;
ALTER TABLE redeem_codes
    DROP CONSTRAINT IF EXISTS redeem_codes_plan_id_fkey;
ALTER TABLE redeem_codes
    ADD CONSTRAINT redeem_codes_plan_id_fkey
    FOREIGN KEY (plan_id) REFERENCES subscription_plans(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_redeem_codes_plan_id
    ON redeem_codes (plan_id);

-- subscription_type used to turn a route group into the entitlement itself.
-- Plans now own entitlement and quota, while groups only describe routing and
-- effective request pricing. Preserve the column for wire compatibility with
-- older clients, but make every persisted runtime group a standard route.
UPDATE groups
SET subscription_type = 'standard',
    updated_at = NOW()
WHERE subscription_type <> 'standard';

DROP INDEX IF EXISTS idx_groups_subscription_type;
ALTER TABLE groups
    DROP CONSTRAINT IF EXISTS groups_subscription_type_standard_check,
    ADD CONSTRAINT groups_subscription_type_standard_check
    CHECK (subscription_type = 'standard');
