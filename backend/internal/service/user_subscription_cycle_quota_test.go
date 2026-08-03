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

func TestUserSubscriptionCheckQuotaLimitsAt_EnforcesTermTotalWithReservations(t *testing.T) {
	now := time.Date(2026, 8, 2, 0, 0, 0, 0, time.UTC)
	cycleQuota := 250.0
	totalQuota := 1000.0
	startedAt := now.Add(-24 * time.Hour)
	sub := &UserSubscription{
		CycleQuotaUSD:        &cycleQuota,
		TotalQuotaUSD:        &totalQuota,
		ResetIntervalSeconds: 7 * 24 * 60 * 60,
		CycleStartedAt:       &startedAt,
		CycleUsageUSD:        1,
		TotalUsageUSD:        998,
		TotalReservedUSD:     1,
	}

	require.True(t, sub.CheckQuotaLimitsAt(now, 1))
	require.False(t, sub.CheckQuotaLimitsAt(now, 1.01))

	sub.TotalUsageUSD = 999
	require.False(t, sub.CheckQuotaLimitsAt(now, 0), "a fully committed term must reject another request")
}

func TestUserSubscriptionCheckQuotaLimitsAt_AllowsHistoricalUnlimitedTerm(t *testing.T) {
	now := time.Date(2026, 8, 2, 0, 0, 0, 0, time.UTC)
	cycleQuota := 10.0
	sub := &UserSubscription{
		CycleQuotaUSD:    &cycleQuota,
		CycleUsageUSD:    2,
		TotalQuotaUSD:    nil,
		TotalUsageUSD:    999,
		TotalReservedUSD: 500,
	}

	require.True(t, sub.CheckQuotaLimitsAt(now, 8))
}
