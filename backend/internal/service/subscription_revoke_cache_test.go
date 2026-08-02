//go:build unit

package service

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

type revokeCacheUserSubRepoStub struct {
	userSubRepoNoop

	sub     *UserSubscription
	deleted bool
}

func (r *revokeCacheUserSubRepoStub) GetByID(_ context.Context, id int64) (*UserSubscription, error) {
	if r.sub == nil || r.sub.ID != id || r.deleted {
		return nil, ErrSubscriptionNotFound
	}
	cp := *r.sub
	return &cp, nil
}

func (r *revokeCacheUserSubRepoStub) Delete(_ context.Context, id int64) error {
	if r.sub == nil || r.sub.ID != id || r.deleted {
		return ErrSubscriptionNotFound
	}
	r.deleted = true
	return nil
}

type revokeCacheSpy struct {
	billingCacheWorkerStub
	invalidated [][2]int64
}

func (s *revokeCacheSpy) InvalidateSubscriptionCache(_ context.Context, userID, groupID int64) error {
	s.invalidated = append(s.invalidated, [2]int64{userID, groupID})
	return nil
}

func TestRevokeSubscription_InvalidatesEveryCoveredGroupSynchronously(t *testing.T) {
	repo := &revokeCacheUserSubRepoStub{
		sub: &UserSubscription{
			ID:             1,
			UserID:         10,
			PlanID:         30,
			Status:         SubscriptionStatusActive,
			ExpiresAt:      time.Now().Add(time.Hour),
			IncludedGroups: []Group{{ID: 20}, {ID: 21}},
		},
	}
	cache := &revokeCacheSpy{}
	svc := NewSubscriptionService(groupRepoNoop{}, repo, &BillingCacheService{cache: cache}, nil, nil)

	err := svc.RevokeSubscription(context.Background(), 1)
	require.NoError(t, err)
	require.True(t, repo.deleted)
	require.Equal(t, [][2]int64{{10, 20}, {10, 21}}, cache.invalidated)
}

type restoreUserSubRepoStub struct {
	userSubRepoNoop

	sub            *UserSubscription
	existsActive   bool
	restoreCalls   int
	restoredStatus string
}

func (r *restoreUserSubRepoStub) GetByIDIncludeDeleted(_ context.Context, id int64) (*UserSubscription, error) {
	if r.sub == nil || r.sub.ID != id {
		return nil, ErrSubscriptionNotFound
	}
	cp := *r.sub
	return &cp, nil
}

func (r *restoreUserSubRepoStub) GetByUserIDAndPlanID(_ context.Context, userID, planID int64) (*UserSubscription, error) {
	if !r.existsActive || r.sub == nil || r.sub.UserID != userID || r.sub.PlanID != planID {
		return nil, ErrSubscriptionNotFound
	}
	cp := *r.sub
	cp.ID++
	cp.DeletedAt = nil
	return &cp, nil
}

func (r *restoreUserSubRepoStub) GetActiveCoveringGroup(context.Context, int64, int64) (*UserSubscription, error) {
	panic("unexpected GetActiveCoveringGroup call")
}

func (r *restoreUserSubRepoStub) ListActiveCoveringGroup(context.Context, int64, int64) ([]UserSubscription, error) {
	panic("unexpected ListActiveCoveringGroup call")
}

func (r *restoreUserSubRepoStub) ExistsActiveCoveringGroup(context.Context, int64, int64) (bool, error) {
	panic("unexpected ExistsActiveCoveringGroup call")
}

func (r *restoreUserSubRepoStub) UpdateBillingSnapshot(context.Context, int64, SubscriptionBillingSnapshot, bool) error {
	panic("unexpected UpdateBillingSnapshot call")
}

func (r *restoreUserSubRepoStub) Restore(_ context.Context, id int64, restoredStatus string) (*UserSubscription, error) {
	if r.sub == nil || r.sub.ID != id {
		return nil, ErrSubscriptionNotFound
	}
	r.restoreCalls++
	r.restoredStatus = restoredStatus
	cp := *r.sub
	cp.Status = restoredStatus
	cp.DeletedAt = nil
	r.sub = &cp
	return &cp, nil
}

func TestRestoreSubscription_ExpiredActiveRestoresAsExpired(t *testing.T) {
	deletedAt := time.Now().Add(-time.Hour)
	repo := &restoreUserSubRepoStub{
		sub: &UserSubscription{
			ID:        1,
			UserID:    10,
			PlanID:    20,
			Status:    SubscriptionStatusActive,
			ExpiresAt: time.Now().Add(-time.Minute),
			DeletedAt: &deletedAt,
		},
	}
	svc := NewSubscriptionService(groupRepoNoop{}, repo, nil, nil, nil)
	t.Cleanup(svc.Stop)

	restored, err := svc.RestoreSubscription(context.Background(), 1)
	require.NoError(t, err)
	require.Equal(t, 1, repo.restoreCalls)
	require.Equal(t, SubscriptionStatusExpired, repo.restoredStatus)
	require.Equal(t, SubscriptionStatusExpired, restored.Status)
	require.Nil(t, restored.DeletedAt)
}

func TestRestoreSubscription_NotRevokedReturnsConflict(t *testing.T) {
	repo := &restoreUserSubRepoStub{
		sub: &UserSubscription{
			ID:        1,
			UserID:    10,
			PlanID:    20,
			Status:    SubscriptionStatusActive,
			ExpiresAt: time.Now().Add(time.Hour),
		},
	}
	svc := NewSubscriptionService(groupRepoNoop{}, repo, nil, nil, nil)
	t.Cleanup(svc.Stop)

	_, err := svc.RestoreSubscription(context.Background(), 1)
	require.ErrorIs(t, err, ErrSubscriptionNotRevoked)
	require.Zero(t, repo.restoreCalls)
}

func TestRestoreSubscription_LiveSubscriptionConflict(t *testing.T) {
	deletedAt := time.Now().Add(-time.Hour)
	repo := &restoreUserSubRepoStub{
		existsActive: true,
		sub: &UserSubscription{
			ID:        1,
			UserID:    10,
			PlanID:    20,
			Status:    SubscriptionStatusExpired,
			ExpiresAt: time.Now().Add(-time.Hour),
			DeletedAt: &deletedAt,
		},
	}
	svc := NewSubscriptionService(groupRepoNoop{}, repo, nil, nil, nil)
	t.Cleanup(svc.Stop)

	_, err := svc.RestoreSubscription(context.Background(), 1)
	require.ErrorIs(t, err, ErrSubscriptionRestoreConflict)
	require.Zero(t, repo.restoreCalls)
}
