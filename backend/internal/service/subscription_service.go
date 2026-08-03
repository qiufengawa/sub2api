package service

import (
	"context"
	"errors"
	"fmt"
	"log"
	"math"
	"strings"
	"time"

	dbent "github.com/Wei-Shaw/sub2api/ent"
	"github.com/Wei-Shaw/sub2api/ent/subscriptionplan"
	"github.com/Wei-Shaw/sub2api/internal/config"
	infraerrors "github.com/Wei-Shaw/sub2api/internal/pkg/errors"
	"github.com/Wei-Shaw/sub2api/internal/pkg/pagination"
)

// MaxExpiresAt is the maximum allowed expiration date (year 2099)
// This prevents time.Time JSON serialization errors (RFC 3339 requires year <= 9999)
var MaxExpiresAt = time.Date(2099, 12, 31, 23, 59, 59, 0, time.UTC)

// MaxValidityDays is the maximum allowed validity days for subscriptions (100 years)
const MaxValidityDays = 36500

var (
	ErrSubscriptionNotFound        = infraerrors.NotFound("SUBSCRIPTION_NOT_FOUND", "subscription not found")
	ErrSubscriptionExpired         = infraerrors.Forbidden("SUBSCRIPTION_EXPIRED", "subscription has expired")
	ErrSubscriptionSuspended       = infraerrors.Forbidden("SUBSCRIPTION_SUSPENDED", "subscription is suspended")
	ErrSubscriptionAlreadyExists   = infraerrors.Conflict("SUBSCRIPTION_ALREADY_EXISTS", "subscription already exists for this user and plan")
	ErrSubscriptionAssignConflict  = infraerrors.Conflict("SUBSCRIPTION_ASSIGN_CONFLICT", "subscription exists but request conflicts with existing assignment semantics")
	ErrSubscriptionNotRevoked      = infraerrors.Conflict("SUBSCRIPTION_NOT_REVOKED", "subscription is not revoked")
	ErrSubscriptionRestoreConflict = infraerrors.Conflict("SUBSCRIPTION_RESTORE_CONFLICT", "subscription already exists for this user and plan")
	ErrInvalidInput                = infraerrors.BadRequest("INVALID_INPUT", "at least one of resetDaily, resetWeekly, or resetMonthly must be true")
	ErrDailyLimitExceeded          = infraerrors.TooManyRequests("DAILY_LIMIT_EXCEEDED", "daily usage limit exceeded")
	ErrWeeklyLimitExceeded         = infraerrors.TooManyRequests("WEEKLY_LIMIT_EXCEEDED", "weekly usage limit exceeded")
	ErrMonthlyLimitExceeded        = infraerrors.TooManyRequests("MONTHLY_LIMIT_EXCEEDED", "monthly usage limit exceeded")
	ErrSubscriptionNilInput        = infraerrors.BadRequest("SUBSCRIPTION_NIL_INPUT", "subscription input cannot be nil")
	ErrAdjustWouldExpire           = infraerrors.BadRequest("ADJUST_WOULD_EXPIRE", "adjustment would result in expired subscription (remaining days must be > 0)")
)

// SubscriptionService 订阅服务
type SubscriptionService struct {
	groupRepo           GroupRepository
	userSubRepo         UserSubscriptionRepository
	billingCacheService *BillingCacheService
	entClient           *dbent.Client

	maintenanceQueue *SubscriptionMaintenanceQueue
	now              func() time.Time
}

// NewSubscriptionService 创建订阅服务
func NewSubscriptionService(groupRepo GroupRepository, userSubRepo UserSubscriptionRepository, billingCacheService *BillingCacheService, entClient *dbent.Client, cfg *config.Config) *SubscriptionService {
	svc := &SubscriptionService{
		groupRepo:           groupRepo,
		userSubRepo:         userSubRepo,
		billingCacheService: billingCacheService,
		entClient:           entClient,
		now:                 time.Now,
	}
	svc.initMaintenanceQueue(cfg)
	return svc
}

func (s *SubscriptionService) initMaintenanceQueue(cfg *config.Config) {
	if cfg == nil {
		return
	}
	mc := cfg.SubscriptionMaintenance
	if mc.WorkerCount <= 0 || mc.QueueSize <= 0 {
		return
	}
	s.maintenanceQueue = NewSubscriptionMaintenanceQueue(mc.WorkerCount, mc.QueueSize)
}

// Stop stops the maintenance worker pool.
func (s *SubscriptionService) Stop() {
	if s == nil {
		return
	}
	if s.maintenanceQueue != nil {
		s.maintenanceQueue.Stop()
	}
}

func (s *SubscriptionService) invalidateSubscriptionCaches(userID, groupID int64) error {
	if s.billingCacheService == nil {
		return nil
	}

	cacheCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := s.billingCacheService.InvalidateSubscription(cacheCtx, userID, groupID); err != nil {
		return fmt.Errorf("invalidate billing subscription cache: %w", err)
	}
	return nil
}

// AssignSubscriptionInput 分配订阅输入
type AssignSubscriptionInput struct {
	UserID                        int64
	PlanID                        int64
	FiveHourQuotaUSD              *float64
	PreserveExistingFiveHourQuota bool
	FiveHourQuotaSnapshotProvided bool
	CycleQuotaUSD                 *float64
	TotalQuotaUSD                 *float64
	PreserveExistingTotalQuota    bool
	TotalQuotaSnapshotProvided    bool
	ResetIntervalSeconds          int
	WalletFallbackEnabled         *bool
	ValidityDays                  int
	AssignedBy                    int64
	Notes                         string
}

// AssignSubscription 分配订阅给用户（不允许重复分配）
func (s *SubscriptionService) AssignSubscription(ctx context.Context, input *AssignSubscriptionInput) (*UserSubscription, error) {
	sub, _, err := s.assignSubscriptionWithReuse(ctx, input)
	if err != nil {
		return nil, err
	}
	return sub, nil
}

// AssignOrExtendSubscription 分配或续期订阅（用于兑换码等场景）
// 如果用户已有同套餐的订阅：
//   - 未过期：从当前过期时间累加天数
//   - 已过期：从当前时间开始计算新的过期时间，并激活订阅
//
// 如果没有订阅：创建新订阅
func (s *SubscriptionService) AssignOrExtendSubscription(ctx context.Context, input *AssignSubscriptionInput) (*UserSubscription, bool, error) {
	return s.assignOrExtendSubscription(ctx, input, false)
}

func (s *SubscriptionService) assignOrExtendSubscription(ctx context.Context, input *AssignSubscriptionInput, deferCacheInvalidation bool) (*UserSubscription, bool, error) {
	groupIDs, err := s.prepareSubscriptionAssignment(ctx, input)
	if err != nil {
		return nil, false, err
	}

	// 查询是否已有订阅
	coverageRepo, ok := s.userSubRepo.(SubscriptionCoverageRepository)
	if !ok {
		return nil, false, fmt.Errorf("subscription repository does not support plan assignments")
	}
	existingSub, err := coverageRepo.GetByUserIDAndPlanID(ctx, input.UserID, input.PlanID)
	if err != nil {
		// 不存在记录是正常情况，其他错误需要返回
		existingSub = nil
	}

	validityDays := input.ValidityDays
	if validityDays <= 0 {
		validityDays = 30
	}
	if validityDays > MaxValidityDays {
		validityDays = MaxValidityDays
	}

	// 已有订阅，执行续期（在事务中完成所有更新）
	if existingSub != nil {
		now := time.Now()
		var newExpiresAt time.Time

		isExpired := !existingSub.ExpiresAt.After(now)
		if !isExpired {
			// 未过期：从当前过期时间累加
			newExpiresAt = existingSub.ExpiresAt.AddDate(0, 0, validityDays)
		} else {
			// 已过期：从当前时间开始计算
			newExpiresAt = now.AddDate(0, 0, validityDays)
		}

		// 确保不超过最大过期时间
		if newExpiresAt.After(MaxExpiresAt) {
			newExpiresAt = MaxExpiresAt
		}

		if err := s.updateExistingSubscriptionTerm(ctx, existingSub, input.Notes, now, newExpiresAt, isExpired); err != nil {
			return nil, false, err
		}
		cycleStart := existingSub.CycleStartedAt
		if isExpired || cycleStart == nil {
			cycleStart = &now
		}
		fiveHourStart := existingSub.FiveHourStartedAt
		if isExpired || fiveHourStart == nil {
			fiveHourStart = &now
		}
		walletFallback := true
		if input.WalletFallbackEnabled != nil {
			walletFallback = *input.WalletFallbackEnabled
		}
		if err := coverageRepo.UpdateBillingSnapshot(ctx, existingSub.ID, SubscriptionBillingSnapshot{
			PlanID:                        input.PlanID,
			FiveHourQuotaUSD:              input.FiveHourQuotaUSD,
			PreserveExistingFiveHourQuota: input.PreserveExistingFiveHourQuota,
			CycleQuotaUSD:                 input.CycleQuotaUSD,
			TotalQuotaUSD:                 input.TotalQuotaUSD,
			PreserveExistingTotalQuota:    input.PreserveExistingTotalQuota,
			ResetIntervalSeconds:          input.ResetIntervalSeconds,
			FiveHourStartedAt:             fiveHourStart,
			CycleStartedAt:                cycleStart,
			WalletFallbackEnabled:         walletFallback,
		}, isExpired); err != nil {
			return nil, false, err
		}

		// 失效订阅缓存
		s.maybeInvalidateAssignmentCaches(input.UserID, groupIDs, deferCacheInvalidation)

		// 返回更新后的订阅
		sub, err := s.userSubRepo.GetByID(ctx, existingSub.ID)
		return sub, true, err // true 表示是续期
	}

	// 没有订阅，创建新订阅
	sub, err := s.createSubscription(ctx, input)
	if err != nil {
		return nil, false, err
	}

	// 失效订阅缓存
	s.maybeInvalidateAssignmentCaches(input.UserID, groupIDs, deferCacheInvalidation)

	return sub, false, nil // false 表示是新建
}

func (s *SubscriptionService) prepareSubscriptionAssignment(ctx context.Context, input *AssignSubscriptionInput) ([]int64, error) {
	if input == nil {
		return nil, ErrSubscriptionNilInput
	}
	if input.UserID <= 0 || input.PlanID <= 0 {
		return nil, infraerrors.BadRequest("INVALID_INPUT", "user_id and plan_id are required")
	}
	if s.entClient == nil {
		return nil, nil
	}
	plan, err := s.entClient.SubscriptionPlan.Query().Where(subscriptionplan.IDEQ(input.PlanID)).WithGroups().Only(ctx)
	if err != nil {
		return nil, infraerrors.NotFound("PLAN_NOT_FOUND", "subscription plan not found")
	}
	groupIDs := planIncludedGroupIDs(plan)
	if len(groupIDs) == 0 {
		return nil, infraerrors.BadRequest("PLAN_GROUP_REQUIRED", "subscription plan must include at least one group")
	}
	if input.CycleQuotaUSD == nil {
		input.CycleQuotaUSD = plan.CycleQuotaUsd
	}
	if input.FiveHourQuotaUSD == nil && !input.PreserveExistingFiveHourQuota && !input.FiveHourQuotaSnapshotProvided {
		input.FiveHourQuotaUSD = plan.FiveHourQuotaUsd
	}
	if input.TotalQuotaUSD == nil && !input.PreserveExistingTotalQuota && !input.TotalQuotaSnapshotProvided {
		input.TotalQuotaUSD = plan.TotalQuotaUsd
	}
	if input.ResetIntervalSeconds <= 0 {
		input.ResetIntervalSeconds = plan.ResetIntervalSeconds
	}
	if input.WalletFallbackEnabled == nil {
		walletFallback := plan.WalletFallbackEnabled
		input.WalletFallbackEnabled = &walletFallback
	}
	if input.ValidityDays <= 0 {
		input.ValidityDays = psComputeValidityDays(plan.ValidityDays, plan.ValidityUnit)
	}
	return groupIDs, nil
}

func (s *SubscriptionService) maybeInvalidateAssignmentCaches(userID int64, groupIDs []int64, deferred bool) {
	// Payment fulfillment owns an outer transaction and performs a synchronous
	// invalidation after commit. Invalidating inside that transaction can reload
	// the pre-commit subscription into cache.
	if deferred {
		return
	}

	for _, groupID := range groupIDs {
		if s.billingCacheService != nil {
			groupID := groupID
			go func() {
				cacheCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				defer cancel()
				_ = s.billingCacheService.InvalidateSubscription(cacheCtx, userID, groupID)
			}()
		}
	}
}

func subscriptionCoveredGroupIDs(sub *UserSubscription) []int64 {
	if sub == nil {
		return nil
	}
	ids := make([]int64, 0, len(sub.IncludedGroups))
	for i := range sub.IncludedGroups {
		if sub.IncludedGroups[i].ID > 0 {
			ids = append(ids, sub.IncludedGroups[i].ID)
		}
	}
	return normalizePlanGroupIDs(ids)
}

func (s *SubscriptionService) invalidateSubscriptionCoverage(sub *UserSubscription) error {
	for _, groupID := range subscriptionCoveredGroupIDs(sub) {
		if err := s.invalidateSubscriptionCaches(sub.UserID, groupID); err != nil {
			return err
		}
	}
	return nil
}

func (s *SubscriptionService) updateExistingSubscriptionTerm(
	ctx context.Context,
	existingSub *UserSubscription,
	notes string,
	startsAt time.Time,
	newExpiresAt time.Time,
	isExpired bool,
) error {
	return s.withSubscriptionUpdateTx(ctx, func(txCtx context.Context) error {
		if isExpired {
			renewed := renewedSubscriptionTerm(existingSub, notes, startsAt, newExpiresAt)
			if err := s.userSubRepo.Update(txCtx, renewed); err != nil {
				return fmt.Errorf("renew expired subscription: %w", err)
			}
			return nil
		}

		// 更新过期时间
		if err := s.userSubRepo.ExtendExpiry(txCtx, existingSub.ID, newExpiresAt); err != nil {
			return fmt.Errorf("extend subscription: %w", err)
		}

		// 如果订阅被暂停，恢复为 active 状态
		if existingSub.Status != SubscriptionStatusActive {
			if err := s.userSubRepo.UpdateStatus(txCtx, existingSub.ID, SubscriptionStatusActive); err != nil {
				return fmt.Errorf("update subscription status: %w", err)
			}
		}

		// 追加备注
		if notes != "" {
			if err := s.userSubRepo.UpdateNotes(txCtx, existingSub.ID, appendSubscriptionNotes(existingSub.Notes, notes)); err != nil {
				return fmt.Errorf("update subscription notes: %w", err)
			}
		}

		return nil
	})
}

func (s *SubscriptionService) withSubscriptionUpdateTx(ctx context.Context, fn func(context.Context) error) error {
	if dbent.TxFromContext(ctx) != nil {
		return fn(ctx)
	}
	if s.entClient == nil {
		return fn(ctx)
	}

	tx, err := s.entClient.Tx(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	txCtx := dbent.NewTxContext(ctx, tx)

	if err := fn(txCtx); err != nil {
		_ = tx.Rollback()
		return err
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}
	return nil
}

func renewedSubscriptionTerm(existingSub *UserSubscription, notes string, startsAt, expiresAt time.Time) *UserSubscription {
	renewed := *existingSub
	windowStart := startsAt
	renewed.StartsAt = startsAt
	renewed.ExpiresAt = expiresAt
	renewed.Status = SubscriptionStatusActive
	renewed.DailyWindowStart = &windowStart
	renewed.WeeklyWindowStart = &windowStart
	renewed.MonthlyWindowStart = &windowStart
	renewed.DailyUsageUSD = 0
	renewed.WeeklyUsageUSD = 0
	renewed.MonthlyUsageUSD = 0
	renewed.FiveHourStartedAt = &windowStart
	renewed.FiveHourUsageUSD = 0
	renewed.CycleStartedAt = &windowStart
	renewed.CycleUsageUSD = 0
	renewed.TotalUsageUSD = 0
	renewed.Notes = appendSubscriptionNotes(existingSub.Notes, notes)
	return &renewed
}

func appendSubscriptionNotes(existingNotes, newNotes string) string {
	if newNotes == "" {
		return existingNotes
	}
	if existingNotes == "" {
		return newNotes
	}
	return existingNotes + "\n" + newNotes
}

// createSubscription 创建新订阅（内部方法）
func (s *SubscriptionService) createSubscription(ctx context.Context, input *AssignSubscriptionInput) (*UserSubscription, error) {
	validityDays := input.ValidityDays
	if validityDays <= 0 {
		validityDays = 30
	}
	if validityDays > MaxValidityDays {
		validityDays = MaxValidityDays
	}

	now := time.Now()
	expiresAt := now.AddDate(0, 0, validityDays)
	if expiresAt.After(MaxExpiresAt) {
		expiresAt = MaxExpiresAt
	}

	sub := &UserSubscription{
		UserID:                input.UserID,
		PlanID:                input.PlanID,
		StartsAt:              now,
		ExpiresAt:             expiresAt,
		Status:                SubscriptionStatusActive,
		AssignedAt:            now,
		Notes:                 input.Notes,
		CreatedAt:             now,
		UpdatedAt:             now,
		FiveHourQuotaUSD:      input.FiveHourQuotaUSD,
		FiveHourStartedAt:     &now,
		CycleQuotaUSD:         input.CycleQuotaUSD,
		TotalQuotaUSD:         input.TotalQuotaUSD,
		ResetIntervalSeconds:  input.ResetIntervalSeconds,
		CycleStartedAt:        &now,
		WalletFallbackEnabled: true,
	}
	if input.WalletFallbackEnabled != nil {
		sub.WalletFallbackEnabled = *input.WalletFallbackEnabled
	}
	// 只有当 AssignedBy > 0 时才设置（0 表示系统分配，如兑换码）
	if input.AssignedBy > 0 {
		sub.AssignedBy = &input.AssignedBy
	}

	if err := s.userSubRepo.Create(ctx, sub); err != nil {
		return nil, err
	}

	// 重新获取完整订阅信息（包含关联）
	return s.userSubRepo.GetByID(ctx, sub.ID)
}

// BulkAssignSubscriptionInput 批量分配订阅输入
type BulkAssignSubscriptionInput struct {
	UserIDs      []int64
	PlanID       int64
	ValidityDays int
	AssignedBy   int64
	Notes        string
}

// BulkAssignResult 批量分配结果
type BulkAssignResult struct {
	SuccessCount  int
	CreatedCount  int
	ReusedCount   int
	FailedCount   int
	Subscriptions []UserSubscription
	Errors        []string
	Statuses      map[int64]string
}

// BulkAssignSubscription 批量分配订阅
func (s *SubscriptionService) BulkAssignSubscription(ctx context.Context, input *BulkAssignSubscriptionInput) (*BulkAssignResult, error) {
	result := &BulkAssignResult{
		Subscriptions: make([]UserSubscription, 0),
		Errors:        make([]string, 0),
		Statuses:      make(map[int64]string),
	}

	for _, userID := range input.UserIDs {
		sub, reused, err := s.assignSubscriptionWithReuse(ctx, &AssignSubscriptionInput{
			UserID:       userID,
			PlanID:       input.PlanID,
			ValidityDays: input.ValidityDays,
			AssignedBy:   input.AssignedBy,
			Notes:        input.Notes,
		})
		if err != nil {
			result.FailedCount++
			result.Errors = append(result.Errors, fmt.Sprintf("user %d: %v", userID, err))
			result.Statuses[userID] = "failed"
		} else {
			result.SuccessCount++
			result.Subscriptions = append(result.Subscriptions, *sub)
			if reused {
				result.ReusedCount++
				result.Statuses[userID] = "reused"
			} else {
				result.CreatedCount++
				result.Statuses[userID] = "created"
			}
		}
	}

	return result, nil
}

func (s *SubscriptionService) assignSubscriptionWithReuse(ctx context.Context, input *AssignSubscriptionInput) (*UserSubscription, bool, error) {
	groupIDs, err := s.prepareSubscriptionAssignment(ctx, input)
	if err != nil {
		return nil, false, err
	}

	coverageRepo, ok := s.userSubRepo.(SubscriptionCoverageRepository)
	if !ok {
		return nil, false, fmt.Errorf("subscription repository does not support plan assignments")
	}
	sub, getErr := coverageRepo.GetByUserIDAndPlanID(ctx, input.UserID, input.PlanID)
	if getErr == nil && sub != nil {
		now := time.Now()
		if sub.Status == SubscriptionStatusExpired ||
			(sub.Status != SubscriptionStatusSuspended && !sub.ExpiresAt.After(now)) {
			validityDays := normalizeAssignValidityDays(input.ValidityDays)
			newExpiresAt := now.AddDate(0, 0, validityDays)
			if newExpiresAt.After(MaxExpiresAt) {
				newExpiresAt = MaxExpiresAt
			}
			renewalNotes := input.Notes
			if strings.TrimSpace(sub.Notes) == strings.TrimSpace(input.Notes) {
				renewalNotes = ""
			}
			if err := s.updateExistingSubscriptionTerm(ctx, sub, renewalNotes, now, newExpiresAt, true); err != nil {
				return nil, false, err
			}
			walletFallback := true
			if input.WalletFallbackEnabled != nil {
				walletFallback = *input.WalletFallbackEnabled
			}
			if err := coverageRepo.UpdateBillingSnapshot(ctx, sub.ID, SubscriptionBillingSnapshot{
				PlanID:                        input.PlanID,
				FiveHourQuotaUSD:              input.FiveHourQuotaUSD,
				PreserveExistingFiveHourQuota: input.PreserveExistingFiveHourQuota,
				CycleQuotaUSD:                 input.CycleQuotaUSD,
				TotalQuotaUSD:                 input.TotalQuotaUSD,
				PreserveExistingTotalQuota:    input.PreserveExistingTotalQuota,
				ResetIntervalSeconds:          input.ResetIntervalSeconds,
				FiveHourStartedAt:             &now,
				CycleStartedAt:                &now,
				WalletFallbackEnabled:         walletFallback,
			}, true); err != nil {
				return nil, false, err
			}
			s.maybeInvalidateAssignmentCaches(input.UserID, groupIDs, false)
			renewed, getErr := s.userSubRepo.GetByID(ctx, sub.ID)
			return renewed, true, getErr
		}
		if conflictReason, conflict := detectAssignSemanticConflict(sub, input); conflict {
			return nil, false, ErrSubscriptionAssignConflict.WithMetadata(map[string]string{
				"conflict_reason": conflictReason,
			})
		}
		return sub, true, nil
	}
	if getErr != nil && !errors.Is(getErr, ErrSubscriptionNotFound) {
		return nil, false, getErr
	}

	sub, err = s.createSubscription(ctx, input)
	if err != nil {
		return nil, false, err
	}

	// 失效订阅缓存
	s.maybeInvalidateAssignmentCaches(input.UserID, groupIDs, false)

	return sub, false, nil
}

func detectAssignSemanticConflict(existing *UserSubscription, input *AssignSubscriptionInput) (string, bool) {
	if existing == nil || input == nil {
		return "", false
	}

	normalizedDays := normalizeAssignValidityDays(input.ValidityDays)
	if !existing.StartsAt.IsZero() {
		expectedExpiresAt := existing.StartsAt.AddDate(0, 0, normalizedDays)
		if expectedExpiresAt.After(MaxExpiresAt) {
			expectedExpiresAt = MaxExpiresAt
		}
		if !existing.ExpiresAt.Equal(expectedExpiresAt) {
			return "validity_days_mismatch", true
		}
	}

	existingNotes := strings.TrimSpace(existing.Notes)
	inputNotes := strings.TrimSpace(input.Notes)
	if existingNotes != inputNotes {
		return "notes_mismatch", true
	}

	return "", false
}

func normalizeAssignValidityDays(days int) int {
	if days <= 0 {
		days = 30
	}
	if days > MaxValidityDays {
		days = MaxValidityDays
	}
	return days
}

// RevokeSubscription 撤销订阅
func (s *SubscriptionService) RevokeSubscription(ctx context.Context, subscriptionID int64) error {
	// 先获取订阅信息用于失效缓存
	sub, err := s.userSubRepo.GetByID(ctx, subscriptionID)
	if err != nil {
		return err
	}

	if err := s.userSubRepo.Delete(ctx, subscriptionID); err != nil {
		return err
	}

	if err := s.invalidateSubscriptionCoverage(sub); err != nil {
		return err
	}

	return nil
}

// RestoreSubscription 恢复已撤销订阅
func (s *SubscriptionService) RestoreSubscription(ctx context.Context, subscriptionID int64) (*UserSubscription, error) {
	sub, err := s.userSubRepo.GetByIDIncludeDeleted(ctx, subscriptionID)
	if err != nil {
		return nil, err
	}
	if sub.DeletedAt == nil {
		return nil, ErrSubscriptionNotRevoked
	}

	if coverageRepo, ok := s.userSubRepo.(SubscriptionCoverageRepository); ok {
		if existing, lookupErr := coverageRepo.GetByUserIDAndPlanID(ctx, sub.UserID, sub.PlanID); lookupErr == nil && existing != nil {
			return nil, ErrSubscriptionRestoreConflict
		} else if lookupErr != nil && !errors.Is(lookupErr, ErrSubscriptionNotFound) {
			return nil, lookupErr
		}
	}

	restoredStatus := sub.Status
	now := time.Now()
	if restoredStatus == SubscriptionStatusActive && !sub.ExpiresAt.After(now) {
		restoredStatus = SubscriptionStatusExpired
	}

	restored, err := s.userSubRepo.Restore(ctx, subscriptionID, restoredStatus)
	if err != nil {
		return nil, err
	}

	if err := s.invalidateSubscriptionCoverage(restored); err != nil {
		return nil, err
	}
	return restored, nil
}

// ExtendSubscription 调整订阅时长（正数延长，负数缩短）
func (s *SubscriptionService) ExtendSubscription(ctx context.Context, subscriptionID int64, days int) (*UserSubscription, error) {
	sub, err := s.userSubRepo.GetByID(ctx, subscriptionID)
	if err != nil {
		return nil, ErrSubscriptionNotFound
	}

	// 限制调整天数范围
	if days > MaxValidityDays {
		days = MaxValidityDays
	}
	if days < -MaxValidityDays {
		days = -MaxValidityDays
	}

	now := time.Now()
	isExpired := !sub.ExpiresAt.After(now)

	// 如果订阅已过期，不允许负向调整
	if isExpired && days < 0 {
		return nil, infraerrors.BadRequest("CANNOT_SHORTEN_EXPIRED", "cannot shorten an expired subscription")
	}

	// 计算新的过期时间
	var newExpiresAt time.Time
	if isExpired {
		// 已过期：从当前时间开始增加天数
		newExpiresAt = now.AddDate(0, 0, days)
	} else {
		// 未过期：从原过期时间增加/减少天数
		newExpiresAt = sub.ExpiresAt.AddDate(0, 0, days)
	}

	if newExpiresAt.After(MaxExpiresAt) {
		newExpiresAt = MaxExpiresAt
	}

	// 检查新的过期时间必须大于当前时间
	if !newExpiresAt.After(now) {
		return nil, ErrAdjustWouldExpire
	}

	if err := s.userSubRepo.ExtendExpiry(ctx, subscriptionID, newExpiresAt); err != nil {
		return nil, err
	}

	// 如果订阅已过期，恢复为active状态
	if sub.Status == SubscriptionStatusExpired {
		if err := s.userSubRepo.UpdateStatus(ctx, subscriptionID, SubscriptionStatusActive); err != nil {
			return nil, err
		}
	}

	// 失效订阅缓存
	s.maybeInvalidateAssignmentCaches(sub.UserID, subscriptionCoveredGroupIDs(sub), false)

	return s.userSubRepo.GetByID(ctx, subscriptionID)
}

// GetByID 根据ID获取订阅
func (s *SubscriptionService) GetByID(ctx context.Context, id int64) (*UserSubscription, error) {
	return s.userSubRepo.GetByID(ctx, id)
}

// GetActiveSubscriptionForGroup resolves entitlement through plan coverage.
func (s *SubscriptionService) GetActiveSubscriptionForGroup(ctx context.Context, userID, groupID int64) (*UserSubscription, error) {
	if s == nil {
		return nil, ErrSubscriptionNotFound
	}
	coverageRepo, ok := s.userSubRepo.(SubscriptionCoverageRepository)
	if !ok {
		return nil, ErrSubscriptionNotFound
	}
	subscriptions, err := coverageRepo.ListActiveCoveringGroup(ctx, userID, groupID)
	if err != nil {
		return nil, err
	}
	if len(subscriptions) == 0 {
		return nil, ErrSubscriptionNotFound
	}
	now := s.now()
	for i := range subscriptions {
		if subscriptions[i].CheckQuotaLimitsAt(now, 0) {
			return &subscriptions[i], nil
		}
	}
	for i := range subscriptions {
		if subscriptions[i].WalletFallbackEnabled {
			return &subscriptions[i], nil
		}
	}
	return &subscriptions[0], nil
}

// ListUserSubscriptions 获取用户的所有订阅
func (s *SubscriptionService) ListUserSubscriptions(ctx context.Context, userID int64) ([]UserSubscription, error) {
	subs, err := s.userSubRepo.ListByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}
	normalizeExpiredWindows(subs)
	normalizeSubscriptionStatus(subs)
	return subs, nil
}

// ListActiveUserSubscriptions 获取用户的所有有效订阅
func (s *SubscriptionService) ListActiveUserSubscriptions(ctx context.Context, userID int64) ([]UserSubscription, error) {
	subs, err := s.userSubRepo.ListActiveByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}
	normalizeExpiredWindows(subs)
	return subs, nil
}

// ListGroupSubscriptions 获取分组的所有订阅
func (s *SubscriptionService) ListGroupSubscriptions(ctx context.Context, groupID int64, page, pageSize int) ([]UserSubscription, *pagination.PaginationResult, error) {
	params := pagination.PaginationParams{Page: page, PageSize: pageSize}
	subs, pag, err := s.userSubRepo.ListByGroupID(ctx, groupID, params)
	if err != nil {
		return nil, nil, err
	}
	normalizeExpiredWindows(subs)
	normalizeSubscriptionStatus(subs)
	return subs, pag, nil
}

// List 获取所有订阅（分页，支持筛选和排序）
func (s *SubscriptionService) List(ctx context.Context, page, pageSize int, userID, groupID *int64, status, platform, sortBy, sortOrder string) ([]UserSubscription, *pagination.PaginationResult, error) {
	params := pagination.PaginationParams{Page: page, PageSize: pageSize}
	subs, pag, err := s.userSubRepo.List(ctx, params, userID, groupID, status, platform, sortBy, sortOrder)
	if err != nil {
		return nil, nil, err
	}
	normalizeExpiredWindows(subs)
	normalizeSubscriptionStatus(subs)
	return subs, pag, nil
}

// normalizeExpiredWindows 将已过期窗口的数据清零（仅影响返回数据，不影响数据库）
// 这确保前端显示正确的当前窗口状态，而不是过期窗口的历史数据
func normalizeExpiredWindows(subs []UserSubscription) {
	normalizeExpiredWindowsAt(subs, time.Now())
}

func normalizeExpiredWindowsAt(subs []UserSubscription, now time.Time) {
	for i := range subs {
		sub := &subs[i]
		// 日窗口过期：清零展示数据
		if sub.canAutomaticallyResetDailyAt(now) {
			sub.DailyWindowStart = nil
			sub.DailyUsageUSD = 0
		}
		// 周窗口过期：清零展示数据
		if sub.canAutomaticallyResetWeeklyAt(now) {
			sub.WeeklyWindowStart = nil
			sub.WeeklyUsageUSD = 0
		}
		// 月窗口过期：清零展示数据
		if sub.canAutomaticallyResetMonthlyAt(now) {
			sub.MonthlyWindowStart = nil
			sub.MonthlyUsageUSD = 0
		}
	}
}

// normalizeSubscriptionStatus 根据实际过期时间修正状态（仅影响返回数据，不影响数据库）
// 这确保前端显示正确的状态，即使定时任务尚未更新数据库
func normalizeSubscriptionStatus(subs []UserSubscription) {
	now := time.Now()
	for i := range subs {
		sub := &subs[i]
		if sub.Status == SubscriptionStatusActive && !sub.ExpiresAt.After(now) {
			sub.Status = SubscriptionStatusExpired
		}
	}
}

// startOfDay 返回给定时间所在日期的零点（保持原时区）
func startOfDay(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
}

// CheckAndActivateWindow 检查并激活窗口（首次使用时）
func (s *SubscriptionService) CheckAndActivateWindow(ctx context.Context, sub *UserSubscription) error {
	return s.checkAndActivateWindowAt(ctx, sub, s.now())
}

func (s *SubscriptionService) checkAndActivateWindowAt(ctx context.Context, sub *UserSubscription, now time.Time) error {
	if sub.IsWindowActivated() {
		return nil
	}

	return s.userSubRepo.ActivateWindows(ctx, sub.ID, now)
}

// AdminResetQuota manually resets the daily, weekly, and/or monthly usage windows.
func (s *SubscriptionService) AdminResetQuota(ctx context.Context, subscriptionID int64, resetDaily, resetWeekly, resetMonthly bool) (*UserSubscription, error) {
	if !resetDaily && !resetWeekly && !resetMonthly {
		return nil, ErrInvalidInput
	}
	sub, err := s.userSubRepo.GetByID(ctx, subscriptionID)
	if err != nil {
		return nil, err
	}
	windowStart := s.now()
	if err := s.userSubRepo.ResetUsageWindows(ctx, sub.ID, resetDaily, resetWeekly, resetMonthly, windowStart); err != nil {
		return nil, err
	}
	for _, groupID := range subscriptionCoveredGroupIDs(sub) {
		if s.billingCacheService != nil {
			_ = s.billingCacheService.InvalidateSubscription(ctx, sub.UserID, groupID)
		}
	}
	// Return the refreshed subscription from DB
	return s.userSubRepo.GetByID(ctx, subscriptionID)
}

// CheckAndResetWindows 检查并重置过期的窗口
func (s *SubscriptionService) CheckAndResetWindows(ctx context.Context, sub *UserSubscription) error {
	now := s.now()
	needsInvalidateCache := false

	// 日窗口重置（24小时）
	if windowStart, ok := sub.automaticWindowStartAt(sub.DailyWindowStart, 24*time.Hour, now); !sub.HasOneTimeDailyQuota() && ok {
		expectedWindowStart := sub.DailyWindowStart
		if err := s.userSubRepo.ResetDailyUsage(ctx, sub.ID, expectedWindowStart, windowStart); err != nil {
			return err
		}
		sub.DailyWindowStart = &windowStart
		sub.DailyUsageUSD = 0
		needsInvalidateCache = true
	}

	// 周窗口重置（7天）
	if windowStart, ok := sub.automaticWindowStartAt(sub.WeeklyWindowStart, 7*24*time.Hour, now); ok {
		expectedWindowStart := sub.WeeklyWindowStart
		if err := s.userSubRepo.ResetWeeklyUsage(ctx, sub.ID, expectedWindowStart, windowStart); err != nil {
			return err
		}
		sub.WeeklyWindowStart = &windowStart
		sub.WeeklyUsageUSD = 0
		needsInvalidateCache = true
	}

	// 月窗口重置（30天）
	if windowStart, ok := sub.automaticWindowStartAt(sub.MonthlyWindowStart, 30*24*time.Hour, now); ok {
		expectedWindowStart := sub.MonthlyWindowStart
		if err := s.userSubRepo.ResetMonthlyUsage(ctx, sub.ID, expectedWindowStart, windowStart); err != nil {
			return err
		}
		sub.MonthlyWindowStart = &windowStart
		sub.MonthlyUsageUSD = 0
		needsInvalidateCache = true
	}

	// 如果有窗口被重置，失效缓存以保持一致性
	if needsInvalidateCache {
		for _, groupID := range subscriptionCoveredGroupIDs(sub) {
			if s.billingCacheService != nil {
				_ = s.billingCacheService.InvalidateSubscription(ctx, sub.UserID, groupID)
			}
		}
	}

	return nil
}

// EnsureWindowMaintenance advances expired usage windows before a request is
// allowed to proceed. It returns a fresh database snapshot because a competing
// request may have won one of the conditional resets.
func (s *SubscriptionService) EnsureWindowMaintenance(ctx context.Context, sub *UserSubscription) (*UserSubscription, error) {
	if sub == nil {
		return nil, ErrSubscriptionNilInput
	}
	if !sub.IsWindowActivated() {
		if err := s.CheckAndActivateWindow(ctx, sub); err != nil {
			return nil, err
		}
	}
	if err := s.CheckAndResetWindows(ctx, sub); err != nil {
		return nil, err
	}

	// GetByID bypasses the service caches. This prevents a stale loser of the
	// CAS from validating limits against zeroed in-memory usage.
	refreshed, err := s.userSubRepo.GetByID(ctx, sub.ID)
	if err != nil {
		return nil, err
	}
	for _, groupID := range subscriptionCoveredGroupIDs(refreshed) {
		if s.billingCacheService != nil {
			_ = s.billingCacheService.InvalidateSubscription(ctx, refreshed.UserID, groupID)
		}
	}
	return refreshed, nil
}

// CheckUsageLimits 检查使用限额（返回错误如果超限）
// 用于中间件的快速预检查，additionalCost 通常为 0
func (s *SubscriptionService) CheckUsageLimits(ctx context.Context, sub *UserSubscription, group *Group, additionalCost float64) error {
	if sub.HasCycleQuota() || sub.HasTotalQuota() {
		if !sub.CheckQuotaLimitsAt(s.now(), additionalCost) {
			return ErrWeeklyLimitExceeded
		}
		return nil
	}
	if !sub.CheckDailyLimit(group, additionalCost) {
		return ErrDailyLimitExceeded
	}
	if !sub.CheckWeeklyLimit(group, additionalCost) {
		return ErrWeeklyLimitExceeded
	}
	if !sub.CheckMonthlyLimit(group, additionalCost) {
		return ErrMonthlyLimitExceeded
	}
	return nil
}

// ValidateAndCheckLimits 合并验证+限额检查（中间件热路径专用）
// 仅做内存检查，不触发 DB 写入。调用方必须在放行请求前同步完成窗口维护。
// 返回 needsMaintenance 表示是否需要执行窗口维护并回读数据库快照。
func (s *SubscriptionService) ValidateAndCheckLimits(sub *UserSubscription, group *Group) (needsMaintenance bool, err error) {
	now := s.now()
	// 1. 验证订阅状态
	if sub.Status == SubscriptionStatusExpired {
		return false, ErrSubscriptionExpired
	}
	if sub.Status == SubscriptionStatusSuspended {
		return false, ErrSubscriptionSuspended
	}
	if !sub.ExpiresAt.After(now) {
		return false, ErrSubscriptionExpired
	}
	if sub.HasCycleQuota() || sub.HasTotalQuota() {
		if !sub.CheckQuotaLimitsAt(now, 0) {
			return false, ErrWeeklyLimitExceeded
		}
		return false, nil
	}

	// 2. 内存中修正过期窗口的用量，确保预检查不会误拒绝用户。
	//    调用方随后同步推进 DB 窗口，并用回读快照重新校验。
	if sub.canAutomaticallyResetDailyAt(now) {
		sub.DailyUsageUSD = 0
		needsMaintenance = true
	}
	if sub.canAutomaticallyResetWeeklyAt(now) {
		sub.WeeklyUsageUSD = 0
		needsMaintenance = true
	}
	if sub.canAutomaticallyResetMonthlyAt(now) {
		sub.MonthlyUsageUSD = 0
		needsMaintenance = true
	}
	if !sub.IsWindowActivated() {
		needsMaintenance = true
	}

	// 3. 检查用量限额
	if !sub.CheckDailyLimit(group, 0) {
		return needsMaintenance, ErrDailyLimitExceeded
	}
	if !sub.CheckWeeklyLimit(group, 0) {
		return needsMaintenance, ErrWeeklyLimitExceeded
	}
	if !sub.CheckMonthlyLimit(group, 0) {
		return needsMaintenance, ErrMonthlyLimitExceeded
	}

	return needsMaintenance, nil
}

// DoWindowMaintenance 异步执行窗口维护（激活+重置）
// 使用独立 context，不受请求取消影响。
// 注意：此方法仅在 ValidateAndCheckLimits 返回 needsMaintenance=true 时调用，
// 而 IsExpired()=true 的订阅在 ValidateAndCheckLimits 中已被拦截返回错误，
// 因此进入此方法的订阅一定未过期，无需处理过期状态同步。
func (s *SubscriptionService) DoWindowMaintenance(sub *UserSubscription) {
	if s == nil {
		return
	}
	if s.maintenanceQueue != nil {
		err := s.maintenanceQueue.TryEnqueue(func() {
			s.doWindowMaintenance(sub)
		})
		if err != nil {
			log.Printf("Subscription maintenance enqueue failed: %v", err)
		}
		return
	}

	s.doWindowMaintenance(sub)
}

func (s *SubscriptionService) doWindowMaintenance(sub *UserSubscription) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// 激活窗口（首次使用时）
	if !sub.IsWindowActivated() {
		if err := s.CheckAndActivateWindow(ctx, sub); err != nil {
			log.Printf("Failed to activate subscription windows: %v", err)
		}
	}

	// 重置过期窗口
	if err := s.CheckAndResetWindows(ctx, sub); err != nil {
		log.Printf("Failed to reset subscription windows: %v", err)
	}

	for _, groupID := range subscriptionCoveredGroupIDs(sub) {
		if s.billingCacheService != nil {
			if err := s.billingCacheService.InvalidateSubscription(ctx, sub.UserID, groupID); err != nil {
				log.Printf("Failed to invalidate subscription billing cache: %v", err)
			}
		}
	}
}

// RecordUsage 记录使用量到订阅
func (s *SubscriptionService) RecordUsage(ctx context.Context, subscriptionID int64, costUSD float64) error {
	return s.userSubRepo.IncrementUsage(ctx, subscriptionID, costUSD)
}

// SubscriptionProgress 订阅进度
type SubscriptionProgress struct {
	ID            int64                `json:"id"`
	PlanName      string               `json:"plan_name"`
	ExpiresAt     time.Time            `json:"expires_at"`
	ExpiresInDays int                  `json:"expires_in_days"`
	FiveHour      *UsageWindowProgress `json:"five_hour,omitempty"`
	Cycle         *UsageWindowProgress `json:"cycle,omitempty"`
	Total         *UsageWindowProgress `json:"total,omitempty"`
}

// UsageWindowProgress 使用窗口进度
type UsageWindowProgress struct {
	LimitUSD        float64   `json:"limit_usd"`
	UsedUSD         float64   `json:"used_usd"`
	ReservedUSD     float64   `json:"reserved_usd"`
	RemainingUSD    float64   `json:"remaining_usd"`
	Percentage      float64   `json:"percentage"`
	WindowStart     time.Time `json:"window_start"`
	ResetsAt        time.Time `json:"resets_at"`
	ResetsInSeconds int64     `json:"resets_in_seconds"`
}

// GetSubscriptionProgress 获取订阅使用进度
func (s *SubscriptionService) GetSubscriptionProgress(ctx context.Context, subscriptionID int64) (*SubscriptionProgress, error) {
	sub, err := s.userSubRepo.GetByID(ctx, subscriptionID)
	if err != nil {
		return nil, ErrSubscriptionNotFound
	}

	return s.calculateProgress(sub), nil
}

// calculateProgress 根据已加载的订阅数据计算套餐周期进度（纯内存计算，无 DB 查询）。
// 覆盖分组只决定可用路由及实际倍率，不能任选一个分组代表整份套餐的额度。
func (s *SubscriptionService) calculateProgress(sub *UserSubscription) *SubscriptionProgress {
	now := s.now()
	progress := &SubscriptionProgress{
		ID:            sub.ID,
		PlanName:      sub.PlanName,
		ExpiresAt:     sub.ExpiresAt,
		ExpiresInDays: sub.DaysRemaining(),
	}
	if sub.HasFiveHourQuota() {
		used := sub.FiveHourUsageAt(now)
		reserved := math.Max(sub.FiveHourReservedUSD, 0)
		start := sub.StartsAt
		if sub.FiveHourStartedAt != nil {
			start = *sub.FiveHourStartedAt
			if !now.Before(start.Add(subscriptionFiveHourDuration)) {
				start = start.Add((now.Sub(start) / subscriptionFiveHourDuration) * subscriptionFiveHourDuration)
			}
		}
		resetsAt := sub.ExpiresAt
		if reset := sub.FiveHourResetTimeAt(now); reset != nil {
			resetsAt = *reset
		}
		limit := *sub.FiveHourQuotaUSD
		remaining := math.Max(limit-used-reserved, 0)
		percentage := math.Min(((used+reserved)/limit)*100, 100)
		resetsInSeconds := int64(resetsAt.Sub(now).Seconds())
		if resetsInSeconds < 0 {
			resetsInSeconds = 0
		}
		progress.FiveHour = &UsageWindowProgress{
			LimitUSD:        limit,
			UsedUSD:         used,
			ReservedUSD:     reserved,
			RemainingUSD:    remaining,
			Percentage:      percentage,
			WindowStart:     start,
			ResetsAt:        resetsAt,
			ResetsInSeconds: resetsInSeconds,
		}
	}
	if sub.HasCycleQuota() {
		used := sub.CycleUsageAt(now)
		reserved := math.Max(sub.CycleReservedUSD, 0)
		start := sub.StartsAt
		if sub.CycleStartedAt != nil {
			start = *sub.CycleStartedAt
			if sub.ResetIntervalSeconds > 0 && !now.Before(start.Add(time.Duration(sub.ResetIntervalSeconds)*time.Second)) {
				period := time.Duration(sub.ResetIntervalSeconds) * time.Second
				start = start.Add((now.Sub(start) / period) * period)
			}
		}
		resetsAt := sub.ExpiresAt
		if reset := sub.CycleResetTimeAt(now); reset != nil {
			resetsAt = *reset
		}
		limit := *sub.CycleQuotaUSD
		remaining := math.Max(limit-used-reserved, 0)
		percentage := math.Min(((used+reserved)/limit)*100, 100)
		resetsInSeconds := int64(resetsAt.Sub(now).Seconds())
		if resetsInSeconds < 0 {
			resetsInSeconds = 0
		}
		progress.Cycle = &UsageWindowProgress{
			LimitUSD:        limit,
			UsedUSD:         used,
			ReservedUSD:     reserved,
			RemainingUSD:    remaining,
			Percentage:      percentage,
			WindowStart:     start,
			ResetsAt:        resetsAt,
			ResetsInSeconds: resetsInSeconds,
		}
	}
	if sub.HasTotalQuota() {
		limit := *sub.TotalQuotaUSD
		used := sub.TotalUsageUSD
		reserved := math.Max(sub.TotalReservedUSD, 0)
		remaining := math.Max(limit-used-reserved, 0)
		percentage := math.Min(((used+reserved)/limit)*100, 100)
		resetsInSeconds := int64(sub.ExpiresAt.Sub(now).Seconds())
		if resetsInSeconds < 0 {
			resetsInSeconds = 0
		}
		progress.Total = &UsageWindowProgress{
			LimitUSD:        limit,
			UsedUSD:         used,
			ReservedUSD:     reserved,
			RemainingUSD:    remaining,
			Percentage:      percentage,
			WindowStart:     sub.StartsAt,
			ResetsAt:        sub.ExpiresAt,
			ResetsInSeconds: resetsInSeconds,
		}
	}

	return progress
}

// GetUserSubscriptionsWithProgress 获取用户所有订阅及进度
func (s *SubscriptionService) GetUserSubscriptionsWithProgress(ctx context.Context, userID int64) ([]SubscriptionProgress, error) {
	// 套餐额度属于订阅本身；覆盖分组只决定哪些 API Key 可使用该订阅。
	subs, err := s.userSubRepo.ListActiveByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}

	progresses := make([]SubscriptionProgress, 0, len(subs))
	for i := range subs {
		sub := &subs[i]
		progresses = append(progresses, *s.calculateProgress(sub))
	}

	return progresses, nil
}

// ValidateSubscription 验证订阅是否有效
func (s *SubscriptionService) ValidateSubscription(ctx context.Context, sub *UserSubscription) error {
	if sub.Status == SubscriptionStatusExpired {
		return ErrSubscriptionExpired
	}
	if sub.Status == SubscriptionStatusSuspended {
		return ErrSubscriptionSuspended
	}
	if sub.IsExpired() {
		// 更新状态
		_ = s.userSubRepo.UpdateStatus(ctx, sub.ID, SubscriptionStatusExpired)
		return ErrSubscriptionExpired
	}
	return nil
}
