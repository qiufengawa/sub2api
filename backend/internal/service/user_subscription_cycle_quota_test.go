package service

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestUserSubscriptionCheckCycleLimitAt_IncludesPendingReservations(t *testing.T) {
	now := time.Date(2026, 8, 2, 0, 0, 0, 0, time.UTC)
	quota := 10.0
	startedAt := now.Add(-24 * time.Hour)
	sub := &UserSubscription{
		CycleQuotaUSD:        &quota,
		ResetIntervalSeconds: 7 * 24 * 60 * 60,
		CycleStartedAt:       &startedAt,
		CycleUsageUSD:        7,
		CycleReservedUSD:     2,
	}

	require.True(t, sub.CheckCycleLimitAt(now, 0))
	require.True(t, sub.CheckCycleLimitAt(now, 1))
	require.False(t, sub.CheckCycleLimitAt(now, 1.01))

	sub.CycleReservedUSD = 3
	require.False(t, sub.CheckCycleLimitAt(now, 0), "a fully committed cycle must reject another request")
}

func TestUserSubscriptionCheckCycleLimitAt_ExpiredCycleKeepsPendingReservation(t *testing.T) {
	now := time.Date(2026, 8, 2, 0, 0, 0, 0, time.UTC)
	quota := 10.0
	startedAt := now.Add(-8 * 24 * time.Hour)
	sub := &UserSubscription{
		CycleQuotaUSD:        &quota,
		ResetIntervalSeconds: 7 * 24 * 60 * 60,
		CycleStartedAt:       &startedAt,
		CycleUsageUSD:        10,
		CycleReservedUSD:     2,
	}

	require.True(t, sub.CheckCycleLimitAt(now, 0))
	require.True(t, sub.CheckCycleLimitAt(now, 8))
	require.False(t, sub.CheckCycleLimitAt(now, 8.01))
}
