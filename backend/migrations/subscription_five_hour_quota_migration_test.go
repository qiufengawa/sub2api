package migrations

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSubscriptionFiveHourQuotaMigrationIsIdempotentAndRollingUpgradeSafe(t *testing.T) {
	content, err := FS.ReadFile("198_subscription_five_hour_quota.sql")
	require.NoError(t, err)
	sql := string(content)

	for _, statement := range []string{
		"ADD COLUMN IF NOT EXISTS five_hour_quota_usd",
		"ADD COLUMN IF NOT EXISTS five_hour_started_at",
		"ADD COLUMN IF NOT EXISTS five_hour_usage_usd",
		"ADD COLUMN IF NOT EXISTS five_hour_reserved_usd",
		"WHERE status = 'pending' AND subscription_id IS NOT NULL",
		"SET five_hour_reserved_usd = pending.reserved_amount",
		"five_hour_quota_usd IS NULL OR (",
		"five_hour_quota_usd::TEXT NOT IN ('NaN', 'Infinity', '-Infinity')",
		"five_hour_usage_usd >= 0",
		"five_hour_reserved_usd >= 0",
		"DROP CONSTRAINT IF EXISTS",
	} {
		require.Contains(t, sql, statement)
	}

	require.NotContains(t, sql, "INSERT INTO subscription_plans")
	require.NotContains(t, sql, "DELETE FROM subscription_plans")
	require.NotContains(t, sql, "UPDATE subscription_plans")
}
