package service

import (
	"context"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/config"
	"github.com/stretchr/testify/require"
)

type accountServiceStatusRepoStub struct {
	OpsRepository
	aggregates []AccountServiceStatusBucketAggregate
	err        error
	calls      int
	accountIDs []int64
	startTime  time.Time
	endTime    time.Time
}

func (r *accountServiceStatusRepoStub) GetAccountServiceStatusBuckets(
	_ context.Context,
	accountIDs []int64,
	startTime time.Time,
	endTime time.Time,
) ([]AccountServiceStatusBucketAggregate, error) {
	r.calls++
	r.accountIDs = append([]int64(nil), accountIDs...)
	r.startTime = startTime
	r.endTime = endTime
	return r.aggregates, r.err
}

func TestGetAccountServiceStatusBatchBuildsMinuteTimeline(t *testing.T) {
	now := time.Date(2026, time.August, 7, 12, 30, 30, 0, time.UTC)
	firstLastCall := time.Date(2026, time.August, 7, 12, 27, 20, 0, time.UTC)
	latestCall := time.Date(2026, time.August, 7, 12, 28, 45, 0, time.UTC)
	currentCall := time.Date(2026, time.August, 7, 12, 30, 10, 0, time.UTC)
	firstToken120 := 120.0
	firstToken320 := 320.0
	firstToken180 := 180.0
	speed40 := 40.0
	speed80 := 80.0
	speed30 := 30.0

	repo := &accountServiceStatusRepoStub{aggregates: []AccountServiceStatusBucketAggregate{
		{
			AccountID: 7, BucketStart: time.Date(2026, time.August, 7, 12, 27, 0, 0, time.UTC),
			SuccessCount: 98, FailureCount: 2,
			AverageFirstTokenMs: &firstToken120, FirstTokenSampleCount: 2,
			AverageTokensPerSec: &speed40, SpeedSampleCount: 2, LastCallAt: &firstLastCall,
		},
		{
			AccountID: 7, BucketStart: time.Date(2026, time.August, 7, 12, 28, 0, 0, time.UTC),
			SuccessCount: 8, FailureCount: 2,
			AverageFirstTokenMs: &firstToken320, FirstTokenSampleCount: 6,
			AverageTokensPerSec: &speed80, SpeedSampleCount: 6, LastCallAt: &latestCall,
		},
		{
			AccountID: 8, BucketStart: time.Date(2026, time.August, 7, 12, 30, 0, 0, time.UTC),
			SuccessCount: 3, FailureCount: 2,
			AverageFirstTokenMs: &firstToken180, FirstTokenSampleCount: 3,
			AverageTokensPerSec: &speed30, SpeedSampleCount: 3, LastCallAt: &currentCall,
		},
	}}
	svc := &OpsService{opsRepo: repo}

	result, err := svc.getAccountServiceStatusBatchAt(context.Background(), []int64{9, 7, 8, 7, 0, -1}, now)
	require.NoError(t, err)
	require.Equal(t, []int64{7, 8, 9}, repo.accountIDs)
	require.Equal(t, time.Date(2026, time.August, 7, 11, 31, 0, 0, time.UTC), repo.startTime)
	require.Equal(t, now, repo.endTime)
	require.Equal(t, 60, result.BucketSeconds)

	account7 := result.Accounts[7]
	require.Len(t, account7.Buckets, AccountServiceStatusBucketCount)
	require.Equal(t, AccountServiceStatusOperational, account7.Buckets[56].Status)
	require.Equal(t, AccountServiceStatusDegraded, account7.Buckets[57].Status)
	require.Equal(t, int64(110), account7.RequestCount)
	require.InDelta(t, 106.0/110.0, *account7.SuccessRate, 0.000001)
	require.InDelta(t, 270.0, *account7.AverageFirstTokenMs, 0.000001)
	require.InDelta(t, 70.0, *account7.AverageTokensPerSec, 0.000001)
	require.Equal(t, latestCall, *account7.LastCallAt)

	account8 := result.Accounts[8]
	require.Equal(t, AccountServiceStatusFailed, account8.Status)
	require.Equal(t, now, account8.Buckets[59].EndTime)

	account9 := result.Accounts[9]
	require.Equal(t, AccountServiceStatusUnknown, account9.Status)
	require.Nil(t, account9.SuccessRate)
	for _, bucket := range account9.Buckets {
		require.Equal(t, AccountServiceStatusUnknown, bucket.Status)
		require.Zero(t, bucket.RequestCount)
	}
}

func TestAccountServiceStatusLevelThresholds(t *testing.T) {
	operational := 0.98
	degraded := 0.80
	failed := 0.799

	require.Equal(t, AccountServiceStatusUnknown, accountServiceStatusLevel(nil))
	require.Equal(t, AccountServiceStatusOperational, accountServiceStatusLevel(&operational))
	require.Equal(t, AccountServiceStatusDegraded, accountServiceStatusLevel(&degraded))
	require.Equal(t, AccountServiceStatusFailed, accountServiceStatusLevel(&failed))
	require.Nil(t, serviceStatusSuccessRate(0, 0))
}

func TestGetAccountServiceStatusBatchHonorsMonitoringSwitch(t *testing.T) {
	repo := &accountServiceStatusRepoStub{}
	svc := &OpsService{
		opsRepo: repo,
		cfg:     &config.Config{Ops: config.OpsConfig{Enabled: false}},
	}

	result, err := svc.GetAccountServiceStatusBatch(context.Background(), []int64{1})
	require.ErrorIs(t, err, ErrOpsDisabled)
	require.Nil(t, result)
	require.Zero(t, repo.calls)
}

func TestGetAccountServiceStatusBatchSkipsRepositoryForEmptyIDs(t *testing.T) {
	repo := &accountServiceStatusRepoStub{}
	svc := &OpsService{opsRepo: repo}

	result, err := svc.getAccountServiceStatusBatchAt(
		context.Background(),
		[]int64{0, -1},
		time.Date(2026, time.August, 7, 12, 30, 0, 0, time.UTC),
	)
	require.NoError(t, err)
	require.Empty(t, result.Accounts)
	require.Zero(t, repo.calls)
}
