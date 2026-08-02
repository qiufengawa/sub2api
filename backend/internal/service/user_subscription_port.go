package service

import (
	"context"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/pkg/pagination"
)

type UserSubscriptionRepository interface {
	Create(ctx context.Context, sub *UserSubscription) error
	GetByID(ctx context.Context, id int64) (*UserSubscription, error)
	GetByIDIncludeDeleted(ctx context.Context, id int64) (*UserSubscription, error)
	Update(ctx context.Context, sub *UserSubscription) error
	Delete(ctx context.Context, id int64) error
	Restore(ctx context.Context, subscriptionID int64, restoredStatus string) (*UserSubscription, error)

	ListByUserID(ctx context.Context, userID int64) ([]UserSubscription, error)
	ListActiveByUserID(ctx context.Context, userID int64) ([]UserSubscription, error)
	ListByGroupID(ctx context.Context, groupID int64, params pagination.PaginationParams) ([]UserSubscription, *pagination.PaginationResult, error)
	List(ctx context.Context, params pagination.PaginationParams, userID, groupID *int64, status, platform, sortBy, sortOrder string) ([]UserSubscription, *pagination.PaginationResult, error)

	ExtendExpiry(ctx context.Context, subscriptionID int64, newExpiresAt time.Time) error
	UpdateStatus(ctx context.Context, subscriptionID int64, status string) error
	UpdateNotes(ctx context.Context, subscriptionID int64, notes string) error

	ActivateWindows(ctx context.Context, id int64, start time.Time) error
	ResetUsageWindows(ctx context.Context, id int64, resetDaily, resetWeekly, resetMonthly bool, newWindowStart time.Time) error
	ResetDailyUsage(ctx context.Context, id int64, expectedWindowStart *time.Time, newWindowStart time.Time) error
	ResetWeeklyUsage(ctx context.Context, id int64, expectedWindowStart *time.Time, newWindowStart time.Time) error
	ResetMonthlyUsage(ctx context.Context, id int64, expectedWindowStart *time.Time, newWindowStart time.Time) error
	IncrementUsage(ctx context.Context, id int64, costUSD float64) error

	BatchUpdateExpiredStatus(ctx context.Context) (int64, error)
}

// SubscriptionCoverageRepository resolves plan entitlements against real
// routing groups. The group is a request route, never a subscription identity.
type SubscriptionCoverageRepository interface {
	GetByUserIDAndPlanID(ctx context.Context, userID, planID int64) (*UserSubscription, error)
	GetActiveCoveringGroup(ctx context.Context, userID, groupID int64) (*UserSubscription, error)
	ListActiveCoveringGroup(ctx context.Context, userID, groupID int64) ([]UserSubscription, error)
	ExistsActiveCoveringGroup(ctx context.Context, userID, groupID int64) (bool, error)
	UpdateBillingSnapshot(ctx context.Context, subscriptionID int64, snapshot SubscriptionBillingSnapshot, resetCycle bool) error
}

type SubscriptionBillingSnapshot struct {
	PlanID                int64
	CycleQuotaUSD         *float64
	ResetIntervalSeconds  int
	CycleStartedAt        *time.Time
	WalletFallbackEnabled bool
}
