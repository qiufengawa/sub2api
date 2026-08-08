package service

import (
	"context"
	"errors"
	"strconv"
	"testing"
	"time"

	dbent "github.com/Wei-Shaw/sub2api/ent"
	infraerrors "github.com/Wei-Shaw/sub2api/internal/pkg/errors"
	"github.com/Wei-Shaw/sub2api/internal/pkg/pagination"
	"github.com/Wei-Shaw/sub2api/internal/pkg/timezone"
	"github.com/stretchr/testify/require"
)

func TestWithSubscriptionUpdateTx_ReusesExistingTransaction(t *testing.T) {
	existingTx := &dbent.Tx{}
	ctx := dbent.NewTxContext(context.Background(), existingTx)
	svc := &SubscriptionService{entClient: &dbent.Client{}}

	called := false
	err := svc.withSubscriptionUpdateTx(ctx, func(txCtx context.Context) error {
		called = true
		require.Same(t, existingTx, dbent.TxFromContext(txCtx))
		return nil
	})

	require.NoError(t, err)
	require.True(t, called)
}

type groupRepoNoop struct{}

func (groupRepoNoop) Create(context.Context, *Group) error { panic("unexpected Create call") }
func (groupRepoNoop) GetByID(context.Context, int64) (*Group, error) {
	panic("unexpected GetByID call")
}
func (groupRepoNoop) GetByIDLite(context.Context, int64) (*Group, error) {
	panic("unexpected GetByIDLite call")
}
func (groupRepoNoop) Update(context.Context, *Group) error { panic("unexpected Update call") }
func (groupRepoNoop) Delete(context.Context, int64) error  { panic("unexpected Delete call") }
func (groupRepoNoop) DeleteCascade(context.Context, int64) ([]int64, error) {
	panic("unexpected DeleteCascade call")
}
func (groupRepoNoop) List(context.Context, pagination.PaginationParams) ([]Group, *pagination.PaginationResult, error) {
	panic("unexpected List call")
}
func (groupRepoNoop) ListWithFilters(context.Context, pagination.PaginationParams, string, string, string, *bool) ([]Group, *pagination.PaginationResult, error) {
	panic("unexpected ListWithFilters call")
}
func (groupRepoNoop) ListActive(context.Context) ([]Group, error) {
	panic("unexpected ListActive call")
}
func (groupRepoNoop) ListActiveByPlatform(context.Context, string) ([]Group, error) {
	panic("unexpected ListActiveByPlatform call")
}
func (groupRepoNoop) ExistsByName(context.Context, string) (bool, error) {
	panic("unexpected ExistsByName call")
}
func (groupRepoNoop) GetAccountCount(context.Context, int64) (int64, int64, error) {
	panic("unexpected GetAccountCount call")
}
func (groupRepoNoop) DeleteAccountGroupsByGroupID(context.Context, int64) (int64, error) {
	panic("unexpected DeleteAccountGroupsByGroupID call")
}
func (groupRepoNoop) GetAccountIDsByGroupIDs(context.Context, []int64) ([]int64, error) {
	panic("unexpected GetAccountIDsByGroupIDs call")
}
func (groupRepoNoop) BindAccountsToGroup(context.Context, int64, []int64) error {
	panic("unexpected BindAccountsToGroup call")
}
func (groupRepoNoop) UpdateSortOrders(context.Context, []GroupSortOrderUpdate) error {
	panic("unexpected UpdateSortOrders call")
}

type subscriptionGroupRepoStub struct {
	groupRepoNoop
	group *Group
}

func (s *subscriptionGroupRepoStub) GetByID(context.Context, int64) (*Group, error) {
	return s.group, nil
}

type userSubRepoNoop struct{}

func (userSubRepoNoop) Create(context.Context, *UserSubscription) error {
	panic("unexpected Create call")
}
func (userSubRepoNoop) GetByID(context.Context, int64) (*UserSubscription, error) {
	panic("unexpected GetByID call")
}
func (userSubRepoNoop) GetByIDForUpdate(context.Context, int64) (*UserSubscription, error) {
	panic("unexpected GetByIDForUpdate call")
}
func (userSubRepoNoop) GetByIDIncludeDeleted(context.Context, int64) (*UserSubscription, error) {
	panic("unexpected GetByIDIncludeDeleted call")
}
func (userSubRepoNoop) Update(context.Context, *UserSubscription) error {
	panic("unexpected Update call")
}
func (userSubRepoNoop) Delete(context.Context, int64) error { panic("unexpected Delete call") }
func (userSubRepoNoop) Restore(context.Context, int64, string) (*UserSubscription, error) {
	panic("unexpected Restore call")
}
func (userSubRepoNoop) ListByUserID(context.Context, int64) ([]UserSubscription, error) {
	panic("unexpected ListByUserID call")
}
func (userSubRepoNoop) ListActiveByUserID(context.Context, int64) ([]UserSubscription, error) {
	panic("unexpected ListActiveByUserID call")
}
func (userSubRepoNoop) ListByGroupID(context.Context, int64, pagination.PaginationParams) ([]UserSubscription, *pagination.PaginationResult, error) {
	panic("unexpected ListByGroupID call")
}
func (userSubRepoNoop) List(context.Context, pagination.PaginationParams, *int64, *int64, string, string, string, string) ([]UserSubscription, *pagination.PaginationResult, error) {
	panic("unexpected List call")
}
func (userSubRepoNoop) ExtendExpiry(context.Context, int64, time.Time) error {
	panic("unexpected ExtendExpiry call")
}
func (userSubRepoNoop) UpdateStatus(context.Context, int64, string) error {
	panic("unexpected UpdateStatus call")
}
func (userSubRepoNoop) UpdateNotes(context.Context, int64, string) error {
	panic("unexpected UpdateNotes call")
}
func (userSubRepoNoop) ActivateWindows(context.Context, int64, time.Time, time.Time) error {
	panic("unexpected ActivateWindows call")
}
func (userSubRepoNoop) ResetUsageWindows(context.Context, int64, bool, bool, bool, time.Time, time.Time) error {
	panic("unexpected ResetUsageWindows call")
}
func (userSubRepoNoop) ResetDailyUsage(context.Context, int64, *time.Time, time.Time) error {
	panic("unexpected ResetDailyUsage call")
}
func (userSubRepoNoop) ResetWeeklyUsage(context.Context, int64, *time.Time, time.Time) error {
	panic("unexpected ResetWeeklyUsage call")
}
func (userSubRepoNoop) ResetMonthlyUsage(context.Context, int64, *time.Time, time.Time) error {
	panic("unexpected ResetMonthlyUsage call")
}
func (userSubRepoNoop) IncrementUsage(context.Context, int64, float64) error {
	panic("unexpected IncrementUsage call")
}
func (userSubRepoNoop) BatchUpdateExpiredStatus(context.Context) (int64, error) {
	panic("unexpected BatchUpdateExpiredStatus call")
}

type subscriptionUserSubRepoStub struct {
	userSubRepoNoop

	nextID      int64
	byID        map[int64]*UserSubscription
	byUserPlan  map[string]*UserSubscription
	createCalls int
}

func newSubscriptionUserSubRepoStub() *subscriptionUserSubRepoStub {
	return &subscriptionUserSubRepoStub{
		nextID:     1,
		byID:       make(map[int64]*UserSubscription),
		byUserPlan: make(map[string]*UserSubscription),
	}
}

func (s *subscriptionUserSubRepoStub) key(userID, planID int64) string {
	return strconvFormatInt(userID) + ":" + strconvFormatInt(planID)
}

func (s *subscriptionUserSubRepoStub) seed(sub *UserSubscription) {
	if sub == nil {
		return
	}
	cp := *sub
	if cp.ID == 0 {
		cp.ID = s.nextID
		s.nextID++
	}
	s.byID[cp.ID] = &cp
	s.byUserPlan[s.key(cp.UserID, cp.PlanID)] = &cp
}

func (s *subscriptionUserSubRepoStub) GetByUserIDAndPlanID(_ context.Context, userID, planID int64) (*UserSubscription, error) {
	sub := s.byUserPlan[s.key(userID, planID)]
	if sub == nil {
		return nil, ErrSubscriptionNotFound
	}
	cp := *sub
	return &cp, nil
}

func (s *subscriptionUserSubRepoStub) GetActiveCoveringGroup(_ context.Context, userID, groupID int64) (*UserSubscription, error) {
	for _, sub := range s.byUserPlan {
		if sub.UserID == userID && sub.Status == SubscriptionStatusActive && sub.CoversGroup(groupID) {
			cp := *sub
			return &cp, nil
		}
	}
	return nil, ErrSubscriptionNotFound
}

func (s *subscriptionUserSubRepoStub) ListActiveCoveringGroup(_ context.Context, userID, groupID int64) ([]UserSubscription, error) {
	result := make([]UserSubscription, 0)
	for _, sub := range s.byUserPlan {
		if sub.UserID == userID && sub.Status == SubscriptionStatusActive && sub.CoversGroup(groupID) {
			result = append(result, *sub)
		}
	}
	return result, nil
}

func (s *subscriptionUserSubRepoStub) ExistsActiveCoveringGroup(ctx context.Context, userID, groupID int64) (bool, error) {
	_, err := s.GetActiveCoveringGroup(ctx, userID, groupID)
	if errors.Is(err, ErrSubscriptionNotFound) {
		return false, nil
	}
	return err == nil, err
}

func (s *subscriptionUserSubRepoStub) UpdateBillingSnapshot(_ context.Context, subscriptionID int64, snapshot SubscriptionBillingSnapshot, resetCycle bool) error {
	sub := s.byID[subscriptionID]
	if sub == nil {
		return ErrSubscriptionNotFound
	}
	oldKey := s.key(sub.UserID, sub.PlanID)
	sub.PlanID = snapshot.PlanID
	if !snapshot.PreserveExistingFiveHourQuota {
		sub.FiveHourQuotaUSD = snapshot.FiveHourQuotaUSD
	}
	sub.CycleQuotaUSD = snapshot.CycleQuotaUSD
	sub.ResetIntervalSeconds = snapshot.ResetIntervalSeconds
	sub.WalletFallbackEnabled = snapshot.WalletFallbackEnabled
	if resetCycle {
		sub.FiveHourStartedAt = snapshot.FiveHourStartedAt
		sub.FiveHourUsageUSD = 0
		sub.CycleStartedAt = snapshot.CycleStartedAt
		sub.CycleUsageUSD = 0
		sub.TotalUsageUSD = 0
		if !snapshot.PreserveExistingTotalQuota {
			sub.TotalQuotaUSD = snapshot.TotalQuotaUSD
		}
	} else {
		if sub.FiveHourStartedAt == nil {
			sub.FiveHourStartedAt = snapshot.FiveHourStartedAt
		}
		if sub.CycleStartedAt == nil {
			sub.CycleStartedAt = snapshot.CycleStartedAt
		}
		if !snapshot.PreserveExistingTotalQuota {
			switch {
			case snapshot.TotalQuotaUSD == nil:
				sub.TotalQuotaUSD = nil
			case sub.TotalQuotaUSD == nil:
				quota := sub.TotalUsageUSD + sub.TotalReservedUSD + *snapshot.TotalQuotaUSD
				sub.TotalQuotaUSD = &quota
			default:
				quota := *sub.TotalQuotaUSD + *snapshot.TotalQuotaUSD
				sub.TotalQuotaUSD = &quota
			}
		}
	}
	delete(s.byUserPlan, oldKey)
	s.byUserPlan[s.key(sub.UserID, sub.PlanID)] = sub
	return nil
}

func (s *subscriptionUserSubRepoStub) Create(_ context.Context, sub *UserSubscription) error {
	if sub == nil {
		return nil
	}
	s.createCalls++
	cp := *sub
	if cp.ID == 0 {
		cp.ID = s.nextID
		s.nextID++
	}
	sub.ID = cp.ID
	s.byID[cp.ID] = &cp
	s.byUserPlan[s.key(cp.UserID, cp.PlanID)] = &cp
	return nil
}

func (s *subscriptionUserSubRepoStub) GetByID(_ context.Context, id int64) (*UserSubscription, error) {
	sub := s.byID[id]
	if sub == nil {
		return nil, ErrSubscriptionNotFound
	}
	cp := *sub
	return &cp, nil
}

func (s *subscriptionUserSubRepoStub) ExtendExpiry(_ context.Context, id int64, expiresAt time.Time) error {
	sub := s.byID[id]
	if sub == nil {
		return ErrSubscriptionNotFound
	}
	sub.ExpiresAt = expiresAt
	return nil
}

func (s *subscriptionUserSubRepoStub) UpdateStatus(_ context.Context, id int64, status string) error {
	sub := s.byID[id]
	if sub == nil {
		return ErrSubscriptionNotFound
	}
	sub.Status = status
	return nil
}

func (s *subscriptionUserSubRepoStub) UpdateNotes(_ context.Context, id int64, notes string) error {
	sub := s.byID[id]
	if sub == nil {
		return ErrSubscriptionNotFound
	}
	sub.Notes = notes
	return nil
}

func (s *subscriptionUserSubRepoStub) GetByIDForUpdate(ctx context.Context, id int64) (*UserSubscription, error) {
	return s.GetByID(ctx, id)
}

func (s *subscriptionUserSubRepoStub) Update(_ context.Context, sub *UserSubscription) error {
	if sub == nil {
		return ErrSubscriptionNilInput
	}
	existing := s.byID[sub.ID]
	if existing == nil {
		return ErrSubscriptionNotFound
	}
	oldKey := s.key(existing.UserID, existing.PlanID)
	cp := *sub
	s.byID[cp.ID] = &cp
	if oldKey != s.key(cp.UserID, cp.PlanID) {
		delete(s.byUserPlan, oldKey)
	}
	s.byUserPlan[s.key(cp.UserID, cp.PlanID)] = &cp
	return nil
}

func TestAssignSubscriptionReuseWhenSemanticsMatch(t *testing.T) {
	start := time.Now().Add(-time.Hour)
	groupRepo := &subscriptionGroupRepoStub{
		group: &Group{ID: 1, SubscriptionType: SubscriptionTypeSubscription},
	}
	subRepo := newSubscriptionUserSubRepoStub()
	subRepo.seed(&UserSubscription{
		ID:        10,
		UserID:    1001,
		PlanID:    1,
		StartsAt:  start,
		ExpiresAt: start.AddDate(0, 0, 30),
		Status:    SubscriptionStatusActive,
		Notes:     "init",
	})

	svc := NewSubscriptionService(groupRepo, subRepo, nil, nil, nil)
	sub, err := svc.AssignSubscription(context.Background(), &AssignSubscriptionInput{
		UserID:       1001,
		PlanID:       1,
		ValidityDays: 30,
		Notes:        "init",
	})
	require.NoError(t, err)
	require.Equal(t, int64(10), sub.ID)
	require.Equal(t, 0, subRepo.createCalls, "reuse should not create new subscription")
	require.Equal(t, start, sub.StartsAt)
	require.Equal(t, start.AddDate(0, 0, 30), sub.ExpiresAt)
}

func TestAssignSubscriptionDoesNotReactivateFutureSuspendedSubscription(t *testing.T) {
	start := time.Now().Add(-time.Hour)
	groupRepo := &subscriptionGroupRepoStub{
		group: &Group{ID: 1, SubscriptionType: SubscriptionTypeSubscription},
	}
	subRepo := newSubscriptionUserSubRepoStub()
	subRepo.seed(&UserSubscription{
		ID:        13,
		UserID:    1003,
		PlanID:    1,
		StartsAt:  start,
		ExpiresAt: start.AddDate(0, 0, 30),
		Status:    SubscriptionStatusSuspended,
		Notes:     "assignment",
	})

	svc := NewSubscriptionService(groupRepo, subRepo, nil, nil, nil)
	sub, err := svc.AssignSubscription(context.Background(), &AssignSubscriptionInput{
		UserID:       1003,
		PlanID:       1,
		ValidityDays: 30,
		Notes:        "assignment",
	})

	require.NoError(t, err)
	require.Equal(t, int64(13), sub.ID)
	require.Equal(t, SubscriptionStatusSuspended, sub.Status)
	require.Equal(t, start, sub.StartsAt)
	require.Equal(t, start.AddDate(0, 0, 30), sub.ExpiresAt)
	require.Equal(t, "assignment", sub.Notes)
	require.Equal(t, 0, subRepo.createCalls)
}

func TestAssignSubscriptionDoesNotReactivatePastExpirySuspendedSubscription(t *testing.T) {
	start := time.Now().AddDate(0, 0, -31)
	expiresAt := start.AddDate(0, 0, 30)
	windowStart := startOfDay(start)
	groupRepo := &subscriptionGroupRepoStub{
		group: &Group{ID: 1, SubscriptionType: SubscriptionTypeSubscription},
	}
	subRepo := newSubscriptionUserSubRepoStub()
	subRepo.seed(&UserSubscription{
		ID:                 15,
		UserID:             1005,
		PlanID:             1,
		StartsAt:           start,
		ExpiresAt:          expiresAt,
		Status:             SubscriptionStatusSuspended,
		DailyWindowStart:   &windowStart,
		WeeklyWindowStart:  &windowStart,
		MonthlyWindowStart: &windowStart,
		DailyUsageUSD:      1,
		WeeklyUsageUSD:     2,
		MonthlyUsageUSD:    3,
		Notes:              "suspended assignment",
	})

	svc := NewSubscriptionService(groupRepo, subRepo, nil, nil, nil)
	sub, err := svc.AssignSubscription(context.Background(), &AssignSubscriptionInput{
		UserID:       1005,
		PlanID:       1,
		ValidityDays: 30,
		Notes:        "suspended assignment",
	})

	require.NoError(t, err)
	require.Equal(t, int64(15), sub.ID)
	require.Equal(t, SubscriptionStatusSuspended, sub.Status)
	require.Equal(t, start, sub.StartsAt)
	require.Equal(t, expiresAt, sub.ExpiresAt)
	require.Equal(t, "suspended assignment", sub.Notes)
	require.Equal(t, &windowStart, sub.DailyWindowStart)
	require.Equal(t, &windowStart, sub.WeeklyWindowStart)
	require.Equal(t, &windowStart, sub.MonthlyWindowStart)
	require.Equal(t, float64(1), sub.DailyUsageUSD)
	require.Equal(t, float64(2), sub.WeeklyUsageUSD)
	require.Equal(t, float64(3), sub.MonthlyUsageUSD)
	require.Equal(t, 0, subRepo.createCalls)
}

func TestAssignSubscriptionRenewsExpiredSemanticMatch(t *testing.T) {
	groupRepo := &subscriptionGroupRepoStub{
		group: &Group{ID: 1, SubscriptionType: SubscriptionTypeSubscription},
	}
	subRepo := newSubscriptionUserSubRepoStub()
	oldStart := time.Now().Add(-time.Hour)
	oldWindowStart := startOfDay(oldStart)
	subRepo.seed(&UserSubscription{
		ID:                 12,
		UserID:             1002,
		PlanID:             1,
		StartsAt:           oldStart,
		ExpiresAt:          oldStart.AddDate(0, 0, 30),
		Status:             SubscriptionStatusExpired,
		DailyWindowStart:   &oldWindowStart,
		WeeklyWindowStart:  &oldWindowStart,
		MonthlyWindowStart: &oldWindowStart,
		DailyUsageUSD:      1,
		WeeklyUsageUSD:     2,
		MonthlyUsageUSD:    3,
		Notes:              " assignment ",
	})

	svc := NewSubscriptionService(groupRepo, subRepo, nil, nil, nil)
	before := time.Now()
	sub, err := svc.AssignSubscription(context.Background(), &AssignSubscriptionInput{
		UserID:       1002,
		PlanID:       1,
		ValidityDays: 30,
		Notes:        "assignment",
	})
	after := time.Now()

	require.NoError(t, err)
	require.Equal(t, int64(12), sub.ID)
	require.Equal(t, 0, subRepo.createCalls)
	require.Equal(t, SubscriptionStatusActive, sub.Status)
	require.False(t, sub.StartsAt.Before(before))
	require.False(t, sub.StartsAt.After(after))
	require.Equal(t, sub.StartsAt.AddDate(0, 0, 30), sub.ExpiresAt)
	require.Equal(t, timezone.StartOfDay(sub.StartsAt), *sub.DailyWindowStart, "续期后日窗口应锚定当天 0 点")
	require.Equal(t, sub.StartsAt, *sub.WeeklyWindowStart)
	require.Equal(t, sub.StartsAt, *sub.MonthlyWindowStart)
	require.Zero(t, sub.DailyUsageUSD)
	require.Zero(t, sub.WeeklyUsageUSD)
	require.Zero(t, sub.MonthlyUsageUSD)
	require.Equal(t, " assignment ", sub.Notes)
}

func TestAssignSubscriptionRenewsExpiredAndAppendsDifferentNotes(t *testing.T) {
	groupRepo := &subscriptionGroupRepoStub{
		group: &Group{ID: 1, SubscriptionType: SubscriptionTypeSubscription},
	}
	subRepo := newSubscriptionUserSubRepoStub()
	oldStart := time.Date(2025, 1, 2, 3, 4, 5, 0, time.UTC)
	subRepo.seed(&UserSubscription{
		ID:        14,
		UserID:    1004,
		PlanID:    1,
		StartsAt:  oldStart,
		ExpiresAt: oldStart.AddDate(0, 0, 30),
		Status:    SubscriptionStatusExpired,
		Notes:     "old assignment",
	})

	svc := NewSubscriptionService(groupRepo, subRepo, nil, nil, nil)
	sub, err := svc.AssignSubscription(context.Background(), &AssignSubscriptionInput{
		UserID:       1004,
		PlanID:       1,
		ValidityDays: 30,
		Notes:        "new assignment",
	})

	require.NoError(t, err)
	require.Equal(t, "old assignment\nnew assignment", sub.Notes)
}

func TestAssignSubscriptionExpiredRenewalResetsUsageAndPreservesReservations(t *testing.T) {
	groupRepo := &subscriptionGroupRepoStub{
		group: &Group{ID: 1, SubscriptionType: SubscriptionTypeSubscription},
	}
	subRepo := newSubscriptionUserSubRepoStub()
	oldStart := time.Now().AddDate(0, 0, -31)
	fiveHourQuota := 8.0
	cycleQuota := 40.0
	totalQuota := 160.0
	subRepo.seed(&UserSubscription{
		ID:                  16,
		UserID:              1006,
		PlanID:              1,
		StartsAt:            oldStart,
		ExpiresAt:           oldStart.AddDate(0, 0, 28),
		Status:              SubscriptionStatusExpired,
		FiveHourQuotaUSD:    &fiveHourQuota,
		CycleQuotaUSD:       &cycleQuota,
		TotalQuotaUSD:       &totalQuota,
		FiveHourUsageUSD:    6,
		FiveHourReservedUSD: 2,
		CycleUsageUSD:       12,
		CycleReservedUSD:    3,
		TotalUsageUSD:       80,
		TotalReservedUSD:    5,
	})

	svc := NewSubscriptionService(groupRepo, subRepo, nil, nil, nil)
	newFiveHourQuota := 3.0
	newCycleQuota := 15.0
	newTotalQuota := 60.0
	sub, err := svc.AssignSubscription(context.Background(), &AssignSubscriptionInput{
		UserID:           1006,
		PlanID:           1,
		FiveHourQuotaUSD: &newFiveHourQuota,
		CycleQuotaUSD:    &newCycleQuota,
		TotalQuotaUSD:    &newTotalQuota,
		ValidityDays:     28,
	})

	require.NoError(t, err)
	require.NotNil(t, sub)
	require.Equal(t, newFiveHourQuota, *sub.FiveHourQuotaUSD)
	require.Equal(t, newCycleQuota, *sub.CycleQuotaUSD)
	require.Equal(t, newTotalQuota, *sub.TotalQuotaUSD)
	require.Zero(t, sub.FiveHourUsageUSD)
	require.Zero(t, sub.CycleUsageUSD)
	require.Zero(t, sub.TotalUsageUSD)
	require.Equal(t, 2.0, sub.FiveHourReservedUSD)
	require.Equal(t, 3.0, sub.CycleReservedUSD)
	require.Equal(t, 5.0, sub.TotalReservedUSD)
}

func TestAssignSubscriptionActiveRenewalAddsTermQuotaWithoutResettingWindows(t *testing.T) {
	groupRepo := &subscriptionGroupRepoStub{
		group: &Group{ID: 1, SubscriptionType: SubscriptionTypeSubscription},
	}
	subRepo := newSubscriptionUserSubRepoStub()
	startsAt := time.Now().Add(-24 * time.Hour)
	expiresAt := time.Now().Add(10 * 24 * time.Hour)
	fiveHourStartedAt := time.Now().Add(-2 * time.Hour)
	cycleStartedAt := time.Now().Add(-2 * 24 * time.Hour)
	fiveHourQuota := 8.0
	cycleQuota := 40.0
	totalQuota := 160.0
	subRepo.seed(&UserSubscription{
		ID:                    19,
		UserID:                1009,
		PlanID:                1,
		StartsAt:              startsAt,
		ExpiresAt:             expiresAt,
		Status:                SubscriptionStatusActive,
		FiveHourQuotaUSD:      &fiveHourQuota,
		FiveHourStartedAt:     &fiveHourStartedAt,
		FiveHourUsageUSD:      6,
		FiveHourReservedUSD:   2,
		CycleQuotaUSD:         &cycleQuota,
		CycleStartedAt:        &cycleStartedAt,
		CycleUsageUSD:         12,
		CycleReservedUSD:      3,
		TotalQuotaUSD:         &totalQuota,
		TotalUsageUSD:         80,
		TotalReservedUSD:      5,
		ResetIntervalSeconds:  604800,
		WalletFallbackEnabled: false,
	})

	svc := NewSubscriptionService(groupRepo, subRepo, nil, nil, nil)
	purchasedTermQuota := 60.0
	sub, extended, err := svc.AssignOrExtendSubscription(context.Background(), &AssignSubscriptionInput{
		UserID:                1009,
		PlanID:                1,
		FiveHourQuotaUSD:      &fiveHourQuota,
		CycleQuotaUSD:         &cycleQuota,
		TotalQuotaUSD:         &purchasedTermQuota,
		ResetIntervalSeconds:  604800,
		WalletFallbackEnabled: boolPtr(false),
		ValidityDays:          30,
	})

	require.NoError(t, err)
	require.True(t, extended)
	require.NotNil(t, sub)
	require.Equal(t, startsAt, sub.StartsAt)
	require.Equal(t, expiresAt.AddDate(0, 0, 30), sub.ExpiresAt)
	require.Equal(t, fiveHourStartedAt, *sub.FiveHourStartedAt)
	require.Equal(t, cycleStartedAt, *sub.CycleStartedAt)
	require.Equal(t, 6.0, sub.FiveHourUsageUSD)
	require.Equal(t, 2.0, sub.FiveHourReservedUSD)
	require.Equal(t, 12.0, sub.CycleUsageUSD)
	require.Equal(t, 3.0, sub.CycleReservedUSD)
	require.Equal(t, 80.0, sub.TotalUsageUSD)
	require.Equal(t, 5.0, sub.TotalReservedUSD)
	require.NotNil(t, sub.TotalQuotaUSD)
	require.Equal(t, 220.0, *sub.TotalQuotaUSD)
}

func TestAssignSubscriptionLegacyRenewalPreservesExistingTermQuota(t *testing.T) {
	groupRepo := &subscriptionGroupRepoStub{
		group: &Group{ID: 1, SubscriptionType: SubscriptionTypeSubscription},
	}
	subRepo := newSubscriptionUserSubRepoStub()
	oldStart := time.Now().Add(-time.Hour)
	totalQuota := 160.0
	subRepo.seed(&UserSubscription{
		ID:            17,
		UserID:        1007,
		PlanID:        1,
		StartsAt:      oldStart,
		ExpiresAt:     oldStart.AddDate(0, 0, 28),
		Status:        SubscriptionStatusActive,
		TotalQuotaUSD: &totalQuota,
		TotalUsageUSD: 80,
	})

	svc := NewSubscriptionService(groupRepo, subRepo, nil, nil, nil)
	sub, _, err := svc.AssignOrExtendSubscription(context.Background(), &AssignSubscriptionInput{
		UserID:                     1007,
		PlanID:                     1,
		ValidityDays:               28,
		PreserveExistingTotalQuota: true,
	})

	require.NoError(t, err)
	require.NotNil(t, sub)
	require.Equal(t, totalQuota, *sub.TotalQuotaUSD)
	require.Equal(t, 80.0, sub.TotalUsageUSD)
}

func TestAssignSubscriptionLegacyExpiredRenewalPreservesExistingTermQuota(t *testing.T) {
	groupRepo := &subscriptionGroupRepoStub{
		group: &Group{ID: 1, SubscriptionType: SubscriptionTypeSubscription},
	}
	subRepo := newSubscriptionUserSubRepoStub()
	oldStart := time.Now().AddDate(0, 0, -31)
	totalQuota := 160.0
	subRepo.seed(&UserSubscription{
		ID:            18,
		UserID:        1008,
		PlanID:        1,
		StartsAt:      oldStart,
		ExpiresAt:     oldStart.AddDate(0, 0, 28),
		Status:        SubscriptionStatusExpired,
		TotalQuotaUSD: &totalQuota,
		TotalUsageUSD: 80,
	})

	svc := NewSubscriptionService(groupRepo, subRepo, nil, nil, nil)
	sub, _, err := svc.AssignOrExtendSubscription(context.Background(), &AssignSubscriptionInput{
		UserID:                     1008,
		PlanID:                     1,
		ValidityDays:               28,
		PreserveExistingTotalQuota: true,
	})

	require.NoError(t, err)
	require.NotNil(t, sub)
	require.Equal(t, totalQuota, *sub.TotalQuotaUSD)
	require.Zero(t, sub.TotalUsageUSD)
}

func TestAssignSubscriptionConflictWhenSemanticsMismatch(t *testing.T) {
	start := time.Now().Add(-time.Hour)
	groupRepo := &subscriptionGroupRepoStub{
		group: &Group{ID: 1, SubscriptionType: SubscriptionTypeSubscription},
	}
	subRepo := newSubscriptionUserSubRepoStub()
	subRepo.seed(&UserSubscription{
		ID:        11,
		UserID:    2001,
		PlanID:    1,
		StartsAt:  start,
		ExpiresAt: start.AddDate(0, 0, 30),
		Status:    SubscriptionStatusActive,
		Notes:     "old-note",
	})

	svc := NewSubscriptionService(groupRepo, subRepo, nil, nil, nil)
	_, err := svc.AssignSubscription(context.Background(), &AssignSubscriptionInput{
		UserID:       2001,
		PlanID:       1,
		ValidityDays: 30,
		Notes:        "new-note",
	})
	require.Error(t, err)
	require.Equal(t, "SUBSCRIPTION_ASSIGN_CONFLICT", infraerrorsReason(err))
	require.Equal(t, 0, subRepo.createCalls, "conflict should not create or mutate existing subscription")
}

func TestBulkAssignSubscriptionCreatedReusedAndConflict(t *testing.T) {
	start := time.Now().Add(-time.Hour)
	groupRepo := &subscriptionGroupRepoStub{
		group: &Group{ID: 1, SubscriptionType: SubscriptionTypeSubscription},
	}
	subRepo := newSubscriptionUserSubRepoStub()
	// user 1: 语义一致，可 reused
	subRepo.seed(&UserSubscription{
		ID:        21,
		UserID:    1,
		PlanID:    1,
		StartsAt:  start,
		ExpiresAt: start.AddDate(0, 0, 30),
		Status:    SubscriptionStatusActive,
		Notes:     "same-note",
	})
	// user 3: 语义冲突（有效期不一致），应 failed
	subRepo.seed(&UserSubscription{
		ID:        23,
		UserID:    3,
		PlanID:    1,
		StartsAt:  start,
		ExpiresAt: start.AddDate(0, 0, 60),
		Status:    SubscriptionStatusActive,
		Notes:     "same-note",
	})

	svc := NewSubscriptionService(groupRepo, subRepo, nil, nil, nil)
	result, err := svc.BulkAssignSubscription(context.Background(), &BulkAssignSubscriptionInput{
		UserIDs:      []int64{1, 2, 3},
		PlanID:       1,
		ValidityDays: 30,
		AssignedBy:   9,
		Notes:        "same-note",
	})
	require.NoError(t, err)
	require.Equal(t, 2, result.SuccessCount)
	require.Equal(t, 1, result.CreatedCount)
	require.Equal(t, 1, result.ReusedCount)
	require.Equal(t, 1, result.FailedCount)
	require.Equal(t, "reused", result.Statuses[1])
	require.Equal(t, "created", result.Statuses[2])
	require.Equal(t, "failed", result.Statuses[3])
	require.Equal(t, 1, subRepo.createCalls)
}

func TestBulkAssignSubscriptionRenewsExpiredSemanticMatch(t *testing.T) {
	groupRepo := &subscriptionGroupRepoStub{
		group: &Group{ID: 1, SubscriptionType: SubscriptionTypeSubscription},
	}
	subRepo := newSubscriptionUserSubRepoStub()
	oldStart := time.Date(2025, 1, 2, 3, 4, 5, 0, time.UTC)
	subRepo.seed(&UserSubscription{
		ID:              24,
		UserID:          4,
		PlanID:          1,
		StartsAt:        oldStart,
		ExpiresAt:       oldStart.AddDate(0, 0, 7),
		Status:          SubscriptionStatusExpired,
		DailyUsageUSD:   1,
		WeeklyUsageUSD:  2,
		MonthlyUsageUSD: 3,
		Notes:           "bulk",
	})

	svc := NewSubscriptionService(groupRepo, subRepo, nil, nil, nil)
	before := time.Now()
	result, err := svc.BulkAssignSubscription(context.Background(), &BulkAssignSubscriptionInput{
		UserIDs:      []int64{4},
		PlanID:       1,
		ValidityDays: 7,
		Notes:        "bulk",
	})
	after := time.Now()

	require.NoError(t, err)
	require.Equal(t, 1, result.SuccessCount)
	require.Equal(t, 0, result.CreatedCount)
	require.Equal(t, 1, result.ReusedCount)
	require.Equal(t, "reused", result.Statuses[4])
	require.Len(t, result.Subscriptions, 1)
	renewed := result.Subscriptions[0]
	require.Equal(t, SubscriptionStatusActive, renewed.Status)
	require.False(t, renewed.StartsAt.Before(before))
	require.False(t, renewed.StartsAt.After(after))
	require.Equal(t, renewed.StartsAt.AddDate(0, 0, 7), renewed.ExpiresAt)
	require.Zero(t, renewed.DailyUsageUSD)
	require.Zero(t, renewed.WeeklyUsageUSD)
	require.Zero(t, renewed.MonthlyUsageUSD)
	require.Equal(t, "bulk", renewed.Notes)
}

func TestAssignSubscriptionKeepsWorkingWhenIdempotencyStoreUnavailable(t *testing.T) {
	groupRepo := &subscriptionGroupRepoStub{
		group: &Group{ID: 1, SubscriptionType: SubscriptionTypeSubscription},
	}
	subRepo := newSubscriptionUserSubRepoStub()
	SetDefaultIdempotencyCoordinator(NewIdempotencyCoordinator(failingIdempotencyRepo{}, DefaultIdempotencyConfig()))
	t.Cleanup(func() {
		SetDefaultIdempotencyCoordinator(nil)
	})

	svc := NewSubscriptionService(groupRepo, subRepo, nil, nil, nil)
	sub, err := svc.AssignSubscription(context.Background(), &AssignSubscriptionInput{
		UserID:       9001,
		PlanID:       1,
		ValidityDays: 30,
		Notes:        "new",
	})
	require.NoError(t, err)
	require.NotNil(t, sub)
	require.Equal(t, 1, subRepo.createCalls, "semantic idempotent endpoint should not depend on idempotency store availability")
}

func TestNormalizeAssignValidityDays(t *testing.T) {
	require.Equal(t, 30, normalizeAssignValidityDays(0))
	require.Equal(t, 30, normalizeAssignValidityDays(-5))
	require.Equal(t, MaxValidityDays, normalizeAssignValidityDays(MaxValidityDays+100))
	require.Equal(t, 7, normalizeAssignValidityDays(7))
}

func TestDetectAssignSemanticConflictCases(t *testing.T) {
	start := time.Date(2026, 2, 20, 10, 0, 0, 0, time.UTC)
	base := &UserSubscription{
		UserID:    1,
		PlanID:    1,
		StartsAt:  start,
		ExpiresAt: start.AddDate(0, 0, 30),
		Notes:     "same",
	}

	reason, conflict := detectAssignSemanticConflict(base, &AssignSubscriptionInput{
		UserID:       1,
		PlanID:       1,
		ValidityDays: 30,
		Notes:        "same",
	})
	require.False(t, conflict)
	require.Equal(t, "", reason)

	reason, conflict = detectAssignSemanticConflict(base, &AssignSubscriptionInput{
		UserID:       1,
		PlanID:       1,
		ValidityDays: 60,
		Notes:        "same",
	})
	require.True(t, conflict)
	require.Equal(t, "validity_days_mismatch", reason)

	reason, conflict = detectAssignSemanticConflict(base, &AssignSubscriptionInput{
		UserID:       1,
		PlanID:       1,
		ValidityDays: 30,
		Notes:        "other",
	})
	require.True(t, conflict)
	require.Equal(t, "notes_mismatch", reason)
}

func TestAssignSubscriptionRequiresPlan(t *testing.T) {
	groupRepo := &subscriptionGroupRepoStub{}
	subRepo := newSubscriptionUserSubRepoStub()
	svc := NewSubscriptionService(groupRepo, subRepo, nil, nil, nil)

	_, err := svc.AssignSubscription(context.Background(), &AssignSubscriptionInput{
		UserID:       1,
		PlanID:       0,
		ValidityDays: 30,
	})
	require.Error(t, err)
	require.Equal(t, "INVALID_INPUT", infraerrors.Reason(err))
}

func strconvFormatInt(v int64) string {
	return strconv.FormatInt(v, 10)
}

func infraerrorsReason(err error) string {
	return infraerrors.Reason(err)
}
