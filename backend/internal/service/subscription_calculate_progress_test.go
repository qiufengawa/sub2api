package service

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func ptrTime(t time.Time) *time.Time { return &t }

func TestCalculateProgress_UsesPlanFieldsWithoutChoosingIncludedGroup(t *testing.T) {
	now := time.Now()
	limit := 20.0
	cycleStart := now.Add(-24 * time.Hour)
	svc := &SubscriptionService{now: func() time.Time { return now }}
	sub := &UserSubscription{
		ID:                   100,
		PlanName:             "Standard",
		StartsAt:             now.Add(-7 * 24 * time.Hour),
		ExpiresAt:            now.Add(21 * 24 * time.Hour),
		CycleQuotaUSD:        &limit,
		CycleUsageUSD:        7.5,
		CycleStartedAt:       &cycleStart,
		ResetIntervalSeconds: 7 * 24 * 60 * 60,
		IncludedGroups: []Group{
			{ID: 10, Name: "GPT 1", DailyLimitUSD: progressFloat64Ptr(1)},
			{ID: 20, Name: "GPT 2", DailyLimitUSD: progressFloat64Ptr(99)},
		},
	}

	progress := svc.calculateProgress(sub)

	assert.Equal(t, int64(100), progress.ID)
	assert.Equal(t, "Standard", progress.PlanName)
	assert.Equal(t, sub.ExpiresAt, progress.ExpiresAt)
	require.NotNil(t, progress.Cycle)
	assert.Equal(t, limit, progress.Cycle.LimitUSD)
	assert.Equal(t, 7.5, progress.Cycle.UsedUSD)
	assert.Equal(t, 12.5, progress.Cycle.RemainingUSD)
	assert.Equal(t, 37.5, progress.Cycle.Percentage)
}

func TestCalculateProgress_WithoutCycleQuotaHasNoUsageWindow(t *testing.T) {
	now := time.Now()
	svc := &SubscriptionService{now: func() time.Time { return now }}
	sub := &UserSubscription{
		ID:        1,
		PlanName:  "Unlimited",
		StartsAt:  now,
		ExpiresAt: now.Add(24 * time.Hour),
	}

	progress := svc.calculateProgress(sub)

	assert.Nil(t, progress.Cycle)
}

func TestCalculateProgress_CycleValuesAreClamped(t *testing.T) {
	now := time.Now()
	limit := 10.0
	cycleStart := now.Add(-time.Hour)
	svc := &SubscriptionService{now: func() time.Time { return now }}
	sub := &UserSubscription{
		ID:                   1,
		StartsAt:             cycleStart,
		ExpiresAt:            now.Add(24 * time.Hour),
		CycleQuotaUSD:        &limit,
		CycleUsageUSD:        15,
		CycleStartedAt:       &cycleStart,
		ResetIntervalSeconds: 24 * 60 * 60,
	}

	progress := svc.calculateProgress(sub)

	require.NotNil(t, progress.Cycle)
	assert.Equal(t, 0.0, progress.Cycle.RemainingUSD)
	assert.Equal(t, 100.0, progress.Cycle.Percentage)
	assert.GreaterOrEqual(t, progress.Cycle.ResetsInSeconds, int64(0))
}

func TestCalculateProgress_IncludesTermReservationInCommittedCapacity(t *testing.T) {
	now := time.Now()
	totalLimit := 1000.0
	svc := &SubscriptionService{now: func() time.Time { return now }}
	sub := &UserSubscription{
		ID:               1,
		StartsAt:         now.Add(-7 * 24 * time.Hour),
		ExpiresAt:        now.Add(21 * 24 * time.Hour),
		TotalQuotaUSD:    &totalLimit,
		TotalUsageUSD:    125,
		TotalReservedUSD: 25,
	}

	progress := svc.calculateProgress(sub)

	require.NotNil(t, progress.Total)
	assert.Equal(t, totalLimit, progress.Total.LimitUSD)
	assert.Equal(t, 125.0, progress.Total.UsedUSD)
	assert.Equal(t, 25.0, progress.Total.ReservedUSD)
	assert.Equal(t, 850.0, progress.Total.RemainingUSD)
	assert.Equal(t, 15.0, progress.Total.Percentage)
	assert.Equal(t, sub.StartsAt, progress.Total.WindowStart)
	assert.Equal(t, sub.ExpiresAt, progress.Total.ResetsAt)
}

func TestCalculateProgress_IncludesFiveHourWindow(t *testing.T) {
	now := time.Date(2026, 8, 3, 12, 0, 0, 0, time.UTC)
	limit := 10.0
	startedAt := now.Add(-time.Hour)
	svc := &SubscriptionService{now: func() time.Time { return now }}
	sub := &UserSubscription{
		StartsAt:            now.Add(-24 * time.Hour),
		ExpiresAt:           now.Add(29 * 24 * time.Hour),
		FiveHourQuotaUSD:    &limit,
		FiveHourStartedAt:   &startedAt,
		FiveHourUsageUSD:    6,
		FiveHourReservedUSD: 1,
	}

	progress := svc.calculateProgress(sub)

	require.NotNil(t, progress.FiveHour)
	assert.Equal(t, 6.0, progress.FiveHour.UsedUSD)
	assert.Equal(t, 1.0, progress.FiveHour.ReservedUSD)
	assert.Equal(t, 3.0, progress.FiveHour.RemainingUSD)
	assert.Equal(t, 70.0, progress.FiveHour.Percentage)
	assert.Equal(t, startedAt.Add(5*time.Hour), progress.FiveHour.ResetsAt)
}

func TestCalculateProgress_ExpiredSubscriptionHasNoRemainingDays(t *testing.T) {
	now := time.Now()
	svc := &SubscriptionService{now: func() time.Time { return now }}
	sub := &UserSubscription{
		ID:        1,
		ExpiresAt: now.Add(-24 * time.Hour),
	}

	progress := svc.calculateProgress(sub)

	assert.Equal(t, 0, progress.ExpiresInDays)
}

func progressFloat64Ptr(value float64) *float64 { return &value }
