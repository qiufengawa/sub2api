package migrations

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestUsageBillingReservationLeaseMigration(t *testing.T) {
	content, err := FS.ReadFile("194_usage_billing_reservation_leases.sql")
	require.NoError(t, err)
	sql := string(content)
	require.Contains(t, sql, "lease_owner")
	require.Contains(t, sql, "last_heartbeat_at")
	require.Contains(t, sql, "lease_expires_at")
	require.Contains(t, sql, "idx_billing_reservations_pending_lease")
}
