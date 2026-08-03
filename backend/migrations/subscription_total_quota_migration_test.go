package migrations

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSubscriptionTotalQuotaMigrationIsIdempotentAndKeepsLegacyUnlimitedRows(t *testing.T) {
	content, err := FS.ReadFile("197_subscription_total_quota.sql")
	require.NoError(t, err)
	sql := string(content)

	for _, statement := range []string{
		"ADD COLUMN IF NOT EXISTS total_quota_usd",
		"ADD COLUMN IF NOT EXISTS total_usage_usd",
		"ADD COLUMN IF NOT EXISTS total_reserved_usd",
		"WHERE status = 'pending' AND subscription_id IS NOT NULL",
		"total_quota_usd IS NULL OR total_quota_usd > 0",
		"total_usage_usd >= 0",
		"total_reserved_usd >= 0",
		"lease_expires_at = COALESCE(lease_expires_at",
	} {
		require.Contains(t, sql, statement)
	}
	// Existing subscriptions remain unlimited until a new plan snapshot gives
	// them an explicit term quota.
	require.Contains(t, sql, "NULL intentionally means unlimited")
}
