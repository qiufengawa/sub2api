-- Migration 195 preserved legacy group-bound entitlements by creating hidden
-- compatibility plans. Remove only compatibility rows that no longer protect
-- any subscription, order, redeem code, or default-subscription setting.
-- Referenced rows stay in the database for historical and billing integrity,
-- but application catalog queries keep them out of product management/export.

DELETE FROM subscription_plans p
WHERE (
        (
            p.product_name LIKE 'legacy-group-%'
            AND p.description = 'Automatically migrated from a legacy group-bound subscription.'
        )
        OR (
            p.product_name = 'legacy-unresolved-subscription-codes'
            AND p.description = 'Historical subscription codes whose deleted group could not be reconstructed.'
        )
    )
  AND p.price = 0
  AND p.for_sale = FALSE
  AND NOT EXISTS (
      SELECT 1
      FROM user_subscriptions us
      WHERE us.plan_id = p.id
  )
  AND NOT EXISTS (
      SELECT 1
      FROM payment_orders po
      WHERE po.plan_id = p.id
  )
  AND NOT EXISTS (
      SELECT 1
      FROM redeem_codes rc
      WHERE rc.plan_id = p.id
  )
  AND NOT EXISTS (
      SELECT 1
      FROM settings s
      CROSS JOIN LATERAL jsonb_array_elements(s.value::JSONB) AS setting_item(value)
      WHERE (s.key = 'default_subscriptions'
             OR s.key LIKE 'auth_source_default_%_subscriptions')
        AND setting_item.value->>'plan_id' = p.id::TEXT
  );
