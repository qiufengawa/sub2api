package service

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

type planCoverageRepoStub struct {
	userSubRepoNoop
	subscriptions []UserSubscription
	userID        int64
	groupID       int64
}

func (r *planCoverageRepoStub) GetByUserIDAndPlanID(context.Context, int64, int64) (*UserSubscription, error) {
	panic("unexpected GetByUserIDAndPlanID call")
}

func (r *planCoverageRepoStub) GetActiveCoveringGroup(context.Context, int64, int64) (*UserSubscription, error) {
	panic("unexpected GetActiveCoveringGroup call")
}

func (r *planCoverageRepoStub) ListActiveCoveringGroup(_ context.Context, userID, groupID int64) ([]UserSubscription, error) {
	r.userID = userID
	r.groupID = groupID
	return append([]UserSubscription(nil), r.subscriptions...), nil
}

func (r *planCoverageRepoStub) ExistsActiveCoveringGroup(context.Context, int64, int64) (bool, error) {
	panic("unexpected ExistsActiveCoveringGroup call")
}

func (r *planCoverageRepoStub) UpdateBillingSnapshot(context.Context, int64, SubscriptionBillingSnapshot, bool) error {
	panic("unexpected UpdateBillingSnapshot call")
}

func TestGetActiveSubscriptionForGroupSelectsFirstUsablePlanCycle(t *testing.T) {
	now := time.Now().UTC()
	quota := 10.0
	repo := &planCoverageRepoStub{subscriptions: []UserSubscription{
		{ID: 1, PlanID: 101, CycleQuotaUSD: &quota, CycleUsageUSD: 10, ExpiresAt: now.Add(time.Hour)},
		{ID: 2, PlanID: 102, CycleQuotaUSD: &quota, CycleUsageUSD: 4, ExpiresAt: now.Add(2 * time.Hour)},
	}}
	svc := newPlanCoverageSubscriptionService(repo, now)

	subscription, err := svc.GetActiveSubscriptionForGroup(context.Background(), 7, 9)
	require.NoError(t, err)
	require.Equal(t, int64(2), subscription.ID)
	require.Equal(t, int64(7), repo.userID)
	require.Equal(t, int64(9), repo.groupID)
}

func TestGetActiveSubscriptionForGroupPreservesAnyWalletFallback(t *testing.T) {
	now := time.Now().UTC()
	quota := 10.0
	repo := &planCoverageRepoStub{subscriptions: []UserSubscription{
		{ID: 1, PlanID: 101, CycleQuotaUSD: &quota, CycleUsageUSD: 10, ExpiresAt: now.Add(time.Hour)},
		{ID: 2, PlanID: 102, CycleQuotaUSD: &quota, CycleUsageUSD: 10, WalletFallbackEnabled: true, ExpiresAt: now.Add(2 * time.Hour)},
	}}
	svc := newPlanCoverageSubscriptionService(repo, now)

	subscription, err := svc.GetActiveSubscriptionForGroup(context.Background(), 7, 9)
	require.NoError(t, err)
	require.Equal(t, int64(2), subscription.ID)
}

func TestGetActiveSubscriptionForGroupReturnsEarliestExhaustedPlanWithoutFallback(t *testing.T) {
	now := time.Now().UTC()
	quota := 10.0
	repo := &planCoverageRepoStub{subscriptions: []UserSubscription{
		{ID: 1, PlanID: 101, CycleQuotaUSD: &quota, CycleUsageUSD: 10, ExpiresAt: now.Add(time.Hour)},
		{ID: 2, PlanID: 102, CycleQuotaUSD: &quota, CycleUsageUSD: 10, ExpiresAt: now.Add(2 * time.Hour)},
	}}
	svc := newPlanCoverageSubscriptionService(repo, now)

	subscription, err := svc.GetActiveSubscriptionForGroup(context.Background(), 7, 9)
	require.NoError(t, err)
	require.Equal(t, int64(1), subscription.ID)
}

func newPlanCoverageSubscriptionService(repo UserSubscriptionRepository, now time.Time) *SubscriptionService {
	return &SubscriptionService{
		userSubRepo: repo,
		now:         func() time.Time { return now },
	}
}
