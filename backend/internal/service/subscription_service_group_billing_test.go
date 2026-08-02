package service

import (
	"context"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/config"
	"github.com/stretchr/testify/require"
)

type groupBillingCoverageRepoStub struct {
	userSubRepoNoop
	subscriptions []UserSubscription
}

type planAssignmentUserSubRepoStub struct {
	*subscriptionUserSubRepoStub
}

func (r *planAssignmentUserSubRepoStub) GetByUserIDAndPlanID(_ context.Context, userID, planID int64) (*UserSubscription, error) {
	for _, subscription := range r.byID {
		if subscription.UserID == userID && subscription.PlanID != nil && *subscription.PlanID == planID {
			copyValue := *subscription
			return &copyValue, nil
		}
	}
	return nil, ErrSubscriptionNotFound
}

func (r *planAssignmentUserSubRepoStub) GetActiveCoveringGroup(context.Context, int64, int64) (*UserSubscription, error) {
	panic("unexpected GetActiveCoveringGroup call")
}

func (r *planAssignmentUserSubRepoStub) ListActiveCoveringGroup(context.Context, int64, int64) ([]UserSubscription, error) {
	panic("unexpected ListActiveCoveringGroup call")
}

func (r *planAssignmentUserSubRepoStub) ExistsActiveCoveringGroup(context.Context, int64, int64) (bool, error) {
	panic("unexpected ExistsActiveCoveringGroup call")
}

func (r *planAssignmentUserSubRepoStub) UpdateBillingSnapshot(context.Context, int64, SubscriptionBillingSnapshot, bool) error {
	panic("unexpected UpdateBillingSnapshot call")
}

func (r *groupBillingCoverageRepoStub) GetByUserIDAndPlanID(context.Context, int64, int64) (*UserSubscription, error) {
	panic("unexpected GetByUserIDAndPlanID call")
}

func (r *groupBillingCoverageRepoStub) GetActiveCoveringGroup(context.Context, int64, int64) (*UserSubscription, error) {
	panic("unexpected GetActiveCoveringGroup call")
}

func (r *groupBillingCoverageRepoStub) ListActiveCoveringGroup(context.Context, int64, int64) ([]UserSubscription, error) {
	return append([]UserSubscription(nil), r.subscriptions...), nil
}

func (r *groupBillingCoverageRepoStub) ExistsActiveCoveringGroup(context.Context, int64, int64) (bool, error) {
	panic("unexpected ExistsActiveCoveringGroup call")
}

func (r *groupBillingCoverageRepoStub) UpdateBillingSnapshot(context.Context, int64, SubscriptionBillingSnapshot, bool) error {
	panic("unexpected UpdateBillingSnapshot call")
}

func TestGetActiveSubscriptionForGroupSelectsFirstUsableCycle(t *testing.T) {
	now := time.Now().UTC()
	quota := 10.0
	repo := &groupBillingCoverageRepoStub{subscriptions: []UserSubscription{
		{ID: 1, CycleQuotaUSD: &quota, CycleUsageUSD: 10, ExpiresAt: now.Add(time.Hour)},
		{ID: 2, CycleQuotaUSD: &quota, CycleUsageUSD: 4, ExpiresAt: now.Add(2 * time.Hour)},
	}}
	svc := newGroupBillingSubscriptionService(repo, now)

	subscription, err := svc.GetActiveSubscriptionForGroup(context.Background(), 7, 9)
	require.NoError(t, err)
	require.Equal(t, int64(2), subscription.ID)
}

func TestGetActiveSubscriptionForGroupPreservesAnyWalletFallback(t *testing.T) {
	now := time.Now().UTC()
	quota := 10.0
	repo := &groupBillingCoverageRepoStub{subscriptions: []UserSubscription{
		{ID: 1, CycleQuotaUSD: &quota, CycleUsageUSD: 10, ExpiresAt: now.Add(time.Hour)},
		{ID: 2, CycleQuotaUSD: &quota, CycleUsageUSD: 10, WalletFallbackEnabled: true, ExpiresAt: now.Add(2 * time.Hour)},
	}}
	svc := newGroupBillingSubscriptionService(repo, now)

	subscription, err := svc.GetActiveSubscriptionForGroup(context.Background(), 7, 9)
	require.NoError(t, err)
	require.Equal(t, int64(2), subscription.ID)
}

func TestGetActiveSubscriptionForGroupReturnsEarliestExhaustedSubscriptionWithoutFallback(t *testing.T) {
	now := time.Now().UTC()
	quota := 10.0
	repo := &groupBillingCoverageRepoStub{subscriptions: []UserSubscription{
		{ID: 1, CycleQuotaUSD: &quota, CycleUsageUSD: 10, ExpiresAt: now.Add(time.Hour)},
		{ID: 2, CycleQuotaUSD: &quota, CycleUsageUSD: 10, ExpiresAt: now.Add(2 * time.Hour)},
	}}
	svc := newGroupBillingSubscriptionService(repo, now)

	subscription, err := svc.GetActiveSubscriptionForGroup(context.Background(), 7, 9)
	require.NoError(t, err)
	require.Equal(t, int64(1), subscription.ID)
}

func TestAssignOrExtendSubscriptionAllowsRealGroupOnlyForEnabledPlanBilling(t *testing.T) {
	planID := int64(12)
	quota := 40.0
	walletFallback := false
	groupRepo := &subscriptionGroupRepoStub{
		group: &Group{ID: 9, SubscriptionType: SubscriptionTypeStandard},
	}

	t.Run("enabled plan assignment stores the billing snapshot", func(t *testing.T) {
		repo := &planAssignmentUserSubRepoStub{subscriptionUserSubRepoStub: newSubscriptionUserSubRepoStub()}
		svc := NewSubscriptionService(groupRepo, repo, nil, nil, &config.Config{Billing: config.BillingConfig{
			SubscriptionGroupBillingEnabled: true,
		}})

		subscription, extended, err := svc.AssignOrExtendSubscription(context.Background(), &AssignSubscriptionInput{
			UserID:                7,
			GroupID:               9,
			PlanID:                &planID,
			CycleQuotaUSD:         &quota,
			ResetIntervalSeconds:  604800,
			WalletFallbackEnabled: &walletFallback,
			ValidityDays:          28,
		})

		require.NoError(t, err)
		require.False(t, extended)
		require.Equal(t, int64(9), subscription.GroupID)
		require.NotNil(t, subscription.PlanID)
		require.Equal(t, planID, *subscription.PlanID)
		require.NotNil(t, subscription.CycleQuotaUSD)
		require.Equal(t, quota, *subscription.CycleQuotaUSD)
		require.Equal(t, 604800, subscription.ResetIntervalSeconds)
		require.False(t, subscription.WalletFallbackEnabled)
	})

	for _, testCase := range []struct {
		name   string
		cfg    *config.Config
		planID *int64
	}{
		{name: "disabled feature", cfg: &config.Config{}, planID: &planID},
		{name: "missing plan", cfg: &config.Config{Billing: config.BillingConfig{SubscriptionGroupBillingEnabled: true}}},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			repo := &planAssignmentUserSubRepoStub{subscriptionUserSubRepoStub: newSubscriptionUserSubRepoStub()}
			svc := NewSubscriptionService(groupRepo, repo, nil, nil, testCase.cfg)
			_, _, err := svc.AssignOrExtendSubscription(context.Background(), &AssignSubscriptionInput{
				UserID: 7, GroupID: 9, PlanID: testCase.planID, ValidityDays: 28,
			})
			require.ErrorIs(t, err, ErrGroupNotSubscriptionType)
		})
	}
}

func newGroupBillingSubscriptionService(repo UserSubscriptionRepository, now time.Time) *SubscriptionService {
	return &SubscriptionService{
		userSubRepo: repo,
		cfg: &config.Config{Billing: config.BillingConfig{
			SubscriptionGroupBillingEnabled: true,
		}},
		now: func() time.Time { return now },
	}
}
