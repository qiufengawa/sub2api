package migrations

import (
	"strings"
	"testing"
)

func TestSubscriptionMultiInstanceLimitMigrationKeepsLegacyDefaultAndDropsUniqueness(t *testing.T) {
	content, err := FS.ReadFile("221_subscription_plan_multi_instance_limit.sql")
	if err != nil {
		t.Fatal(err)
	}
	sql := string(content)
	for _, required := range []string{
		"max_subscriptions_per_user INTEGER NOT NULL DEFAULT 1",
		"CHECK (max_subscriptions_per_user >= 1)",
		"conrelid = 'subscription_plans'::regclass",
		"fulfilled_subscription_id BIGINT NULL",
		"DROP INDEX IF EXISTS user_subscriptions_user_plan_unique_active",
		"idx_user_subscriptions_user_plan_occupancy",
	} {
		if !strings.Contains(sql, required) {
			t.Fatalf("migration missing %q", required)
		}
	}
}
