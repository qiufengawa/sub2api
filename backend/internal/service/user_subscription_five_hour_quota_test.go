package service

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestUserSubscriptionFiveHourQuotaIncludesSharedReservations(t *testing.T) {
	now := time.Date(2026, 8, 3, 12, 0, 0, 0, time.UTC)
	quota := 10.0
	startedAt := now.Add(-time.Hour)
	sub := &UserSubscription{
		FiveHourQuotaUSD:    &quota,
		FiveHourStartedAt:   &startedAt,
		FiveHourUsageUSD:    7,
		FiveHourReservedUSD: 2,
	}

	require.True(t, sub.CheckFiveHourLimitAt(now, 1))
	require.False(t, sub.CheckFiveHourLimitAt(now, 1.01))
	sub.FiveHourReservedUSD = 3
	require.False(t, sub.CheckFiveHourLimitAt(now, 0))
}

func TestUserSubscriptionExpiredFiveHourWindowKeepsReservationsOnly(t *testing.T) {
	now := time.Date(2026, 8, 3, 12, 0, 0, 0, time.UTC)
	quota := 10.0
	startedAt := now.Add(-6 * time.Hour)
	sub := &UserSubscription{
		ExpiresAt:           now.Add(24 * time.Hour),
		FiveHourQuotaUSD:    &quota,
		FiveHourStartedAt:   &startedAt,
		FiveHourUsageUSD:    10,
		FiveHourReservedUSD: 2,
	}

	require.Equal(t, 0.0, sub.FiveHourUsageAt(now))
	require.True(t, sub.CheckFiveHourLimitAt(now, 8))
	require.False(t, sub.CheckFiveHourLimitAt(now, 8.01))
	reset := sub.FiveHourResetTimeAt(now)
	require.NotNil(t, reset)
	require.Equal(t, startedAt.Add(10*time.Hour), *reset)
}

func TestUserSubscriptionUnlimitedFiveHourStillEnforcesLongerWindows(t *testing.T) {
	now := time.Date(2026, 8, 3, 12, 0, 0, 0, time.UTC)
	cycleQuota := 5.0
	totalQuota := 20.0
	startedAt := now.Add(-24 * time.Hour)
	sub := &UserSubscription{
		FiveHourQuotaUSD:     nil,
		CycleQuotaUSD:        &cycleQuota,
		CycleStartedAt:       &startedAt,
		ResetIntervalSeconds: 7 * 24 * 60 * 60,
		CycleUsageUSD:        5,
		TotalQuotaUSD:        &totalQuota,
		TotalUsageUSD:        5,
	}

	require.False(t, sub.CheckQuotaLimitsAt(now, 0))
	zero := 0.0
	sub.FiveHourQuotaUSD = &zero
	require.False(t, sub.CheckQuotaLimitsAt(now, 0))
}

func TestUserSubscriptionQuotaUsesMinimumRemainingDimension(t *testing.T) {
	now := time.Date(2026, 8, 3, 12, 0, 0, 0, time.UTC)
	fiveHourQuota, cycleQuota, totalQuota := 5.0, 20.0, 100.0
	startedAt := now.Add(-time.Hour)
	sub := &UserSubscription{
		FiveHourQuotaUSD:     &fiveHourQuota,
		FiveHourStartedAt:    &startedAt,
		FiveHourUsageUSD:     4,
		CycleQuotaUSD:        &cycleQuota,
		CycleStartedAt:       &startedAt,
		ResetIntervalSeconds: 7 * 24 * 60 * 60,
		CycleUsageUSD:        10,
		TotalQuotaUSD:        &totalQuota,
		TotalUsageUSD:        10,
	}

	require.True(t, sub.CheckQuotaLimitsAt(now, 1))
	require.False(t, sub.CheckQuotaLimitsAt(now, 1.01))
}
