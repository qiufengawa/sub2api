package service

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
)

type scheduledTestResultRepoLimitProbe struct {
	limit int
}

func (r *scheduledTestResultRepoLimitProbe) Create(context.Context, *ScheduledTestResult) (*ScheduledTestResult, error) {
	return nil, nil
}

func (r *scheduledTestResultRepoLimitProbe) ListByPlanID(_ context.Context, _ int64, limit int) ([]*ScheduledTestResult, error) {
	r.limit = limit
	return nil, nil
}

func (r *scheduledTestResultRepoLimitProbe) PruneOldResults(context.Context, int64, int) error {
	return nil
}

func TestScheduledTestServiceListResultsClampsUnboundedLimit(t *testing.T) {
	probe := &scheduledTestResultRepoLimitProbe{}
	svc := NewScheduledTestService(nil, probe)

	_, err := svc.ListResults(context.Background(), 42, 1<<30)

	require.NoError(t, err)
	require.Equal(t, ScheduledTestResultLimitMax, probe.limit)
}

func TestScheduledTestServiceListResultsUsesDefaultForNonPositiveLimit(t *testing.T) {
	probe := &scheduledTestResultRepoLimitProbe{}
	svc := NewScheduledTestService(nil, probe)

	_, err := svc.ListResults(context.Background(), 42, 0)

	require.NoError(t, err)
	require.Equal(t, 50, probe.limit)
}
