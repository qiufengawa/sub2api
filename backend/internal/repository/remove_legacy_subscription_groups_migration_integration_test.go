//go:build integration

package repository

import (
	"context"
	"fmt"
	"testing"

	dbmigrations "github.com/Wei-Shaw/sub2api/migrations"
	"github.com/stretchr/testify/require"
)

func TestMigration195RemoveLegacySubscriptionGroupsIsRerunnable(t *testing.T) {
	tx := testTx(t)
	ctx := context.Background()
	migrationSQL, err := dbmigrations.FS.ReadFile("195_remove_legacy_subscription_groups.sql")
	require.NoError(t, err)

	var plansBefore int
	require.NoError(t, tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM subscription_plans").Scan(&plansBefore))

	_, err = tx.ExecContext(ctx, string(migrationSQL))
	require.NoError(t, err)
	_, err = tx.ExecContext(ctx, string(migrationSQL))
	require.NoError(t, err)

	var plansAfter int
	require.NoError(t, tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM subscription_plans").Scan(&plansAfter))
	require.Equal(t, plansBefore, plansAfter)

	var legacyColumns int
	require.NoError(t, tx.QueryRowContext(ctx, `
SELECT COUNT(*)
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'subscription_plans' AND column_name = 'group_id')
    OR (table_name = 'user_subscriptions' AND column_name = 'group_id')
    OR (table_name = 'payment_orders' AND column_name = 'subscription_group_id')
    OR (table_name = 'redeem_codes' AND column_name = 'group_id')
  )
`).Scan(&legacyColumns))
	require.Zero(t, legacyColumns)

	var nonStandardGroups int
	require.NoError(t, tx.QueryRowContext(ctx, `
SELECT COUNT(*) FROM groups WHERE subscription_type <> 'standard'
`).Scan(&nonStandardGroups))
	require.Zero(t, nonStandardGroups)
}

func TestMigration196CleansOnlyUnreferencedLegacyPlans(t *testing.T) {
	tx := testTx(t)
	ctx := context.Background()
	migrationSQL, err := dbmigrations.FS.ReadFile("196_cleanup_unreferenced_legacy_subscription_plans.sql")
	require.NoError(t, err)

	insertLegacyPlan := func(productName string) int64 {
		var id int64
		err := tx.QueryRowContext(ctx, `
INSERT INTO subscription_plans (
    name, description, price, currency, validity_days, validity_unit,
    features, product_name, for_sale, sort_order, created_at, updated_at
) VALUES (
    '[Migrated] integration fixture',
    'Automatically migrated from a legacy group-bound subscription.',
    0, '', 28, 'day', '', $1, FALSE, 0, NOW(), NOW()
)
RETURNING id
`, productName).Scan(&id)
		require.NoError(t, err)
		return id
	}

	unreferencedID := insertLegacyPlan("legacy-group-910001")
	referencedID := insertLegacyPlan("legacy-group-910002")
	_, err = tx.ExecContext(ctx, `
INSERT INTO settings (key, value, updated_at)
VALUES ($1, $2, NOW())
`, "auth_source_default_migration_196_fixture_subscriptions", fmt.Sprintf(`[{"plan_id":%d,"validity_days":28}]`, referencedID))
	require.NoError(t, err)

	_, err = tx.ExecContext(ctx, string(migrationSQL))
	require.NoError(t, err)

	var unreferencedCount int
	require.NoError(t, tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM subscription_plans WHERE id = $1", unreferencedID).Scan(&unreferencedCount))
	require.Zero(t, unreferencedCount)

	var referencedCount int
	require.NoError(t, tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM subscription_plans WHERE id = $1", referencedID).Scan(&referencedCount))
	require.Equal(t, 1, referencedCount)
}
