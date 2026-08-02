//go:build integration

package repository

import (
	"context"
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
