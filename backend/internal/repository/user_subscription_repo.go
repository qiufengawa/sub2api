package repository

import (
	"context"
	"database/sql"
	"time"

	dbent "github.com/Wei-Shaw/sub2api/ent"
	"github.com/Wei-Shaw/sub2api/ent/group"
	"github.com/Wei-Shaw/sub2api/ent/predicate"
	"github.com/Wei-Shaw/sub2api/ent/schema/mixins"
	"github.com/Wei-Shaw/sub2api/ent/subscriptionplan"
	"github.com/Wei-Shaw/sub2api/ent/user"
	"github.com/Wei-Shaw/sub2api/ent/usersubscription"
	"github.com/Wei-Shaw/sub2api/internal/pkg/pagination"
	"github.com/Wei-Shaw/sub2api/internal/service"
)

type userSubscriptionRepository struct {
	client *dbent.Client
}

func NewUserSubscriptionRepository(client *dbent.Client) service.UserSubscriptionRepository {
	return &userSubscriptionRepository{client: client}
}

func (r *userSubscriptionRepository) Create(ctx context.Context, sub *service.UserSubscription) error {
	if sub == nil {
		return service.ErrSubscriptionNilInput
	}

	client := clientFromContext(ctx, r.client)
	builder := client.UserSubscription.Create().
		SetUserID(sub.UserID).
		SetPlanID(sub.PlanID).
		SetExpiresAt(sub.ExpiresAt).
		SetNillableDailyWindowStart(sub.DailyWindowStart).
		SetNillableWeeklyWindowStart(sub.WeeklyWindowStart).
		SetNillableMonthlyWindowStart(sub.MonthlyWindowStart).
		SetDailyUsageUsd(sub.DailyUsageUSD).
		SetWeeklyUsageUsd(sub.WeeklyUsageUSD).
		SetMonthlyUsageUsd(sub.MonthlyUsageUSD).
		SetNillableCycleQuotaUsd(sub.CycleQuotaUSD).
		SetResetIntervalSeconds(sub.ResetIntervalSeconds).
		SetNillableCycleStartedAt(sub.CycleStartedAt).
		SetCycleUsageUsd(sub.CycleUsageUSD).
		SetCycleReservedUsd(sub.CycleReservedUSD).
		SetNillableTotalQuotaUsd(sub.TotalQuotaUSD).
		SetTotalUsageUsd(sub.TotalUsageUSD).
		SetTotalReservedUsd(sub.TotalReservedUSD).
		SetWalletFallbackEnabled(sub.WalletFallbackEnabled).
		SetNillableAssignedBy(sub.AssignedBy)

	if sub.StartsAt.IsZero() {
		builder.SetStartsAt(time.Now())
	} else {
		builder.SetStartsAt(sub.StartsAt)
	}
	if sub.Status != "" {
		builder.SetStatus(sub.Status)
	}
	if !sub.AssignedAt.IsZero() {
		builder.SetAssignedAt(sub.AssignedAt)
	}
	// Keep compatibility with historical behavior: always store notes as a string value.
	builder.SetNotes(sub.Notes)

	created, err := builder.Save(ctx)
	if err == nil {
		applyUserSubscriptionEntityToService(sub, created)
	}
	return translatePersistenceError(err, nil, service.ErrSubscriptionAlreadyExists)
}

func (r *userSubscriptionRepository) GetByID(ctx context.Context, id int64) (*service.UserSubscription, error) {
	client := clientFromContext(ctx, r.client)
	m, err := client.UserSubscription.Query().
		Where(usersubscription.IDEQ(id)).
		WithUser().
		WithAssignedByUser().
		WithPlan(func(q *dbent.SubscriptionPlanQuery) { q.WithGroups() }).
		Only(ctx)
	if err != nil {
		return nil, translatePersistenceError(err, service.ErrSubscriptionNotFound, nil)
	}
	return userSubscriptionEntityToService(m), nil
}

func (r *userSubscriptionRepository) GetByIDIncludeDeleted(ctx context.Context, id int64) (*service.UserSubscription, error) {
	client := clientFromContext(ctx, r.client)
	queryCtx := mixins.SkipSoftDelete(ctx)
	m, err := client.UserSubscription.Query().
		Where(usersubscription.IDEQ(id)).
		WithUser().
		WithAssignedByUser().
		WithPlan(func(q *dbent.SubscriptionPlanQuery) { q.WithGroups() }).
		Only(queryCtx)
	if err != nil {
		return nil, translatePersistenceError(err, service.ErrSubscriptionNotFound, nil)
	}
	return userSubscriptionEntityToServicePreserveStatus(m), nil
}

func activeSubscriptionCoversGroup(groupID int64) predicate.UserSubscription {
	return usersubscription.HasPlanWith(subscriptionplan.HasGroupsWith(group.IDEQ(groupID)))
}

func (r *userSubscriptionRepository) GetActiveCoveringGroup(ctx context.Context, userID, groupID int64) (*service.UserSubscription, error) {
	client := clientFromContext(ctx, r.client)
	m, err := client.UserSubscription.Query().
		Where(
			usersubscription.UserIDEQ(userID),
			usersubscription.StatusEQ(service.SubscriptionStatusActive),
			usersubscription.ExpiresAtGT(time.Now()),
			activeSubscriptionCoversGroup(groupID),
		).
		WithPlan(func(q *dbent.SubscriptionPlanQuery) { q.WithGroups() }).
		Order(dbent.Asc(usersubscription.FieldExpiresAt), dbent.Asc(usersubscription.FieldID)).
		First(ctx)
	if err != nil {
		return nil, translatePersistenceError(err, service.ErrSubscriptionNotFound, nil)
	}
	return userSubscriptionEntityToService(m), nil
}

func (r *userSubscriptionRepository) GetByUserIDAndPlanID(ctx context.Context, userID, planID int64) (*service.UserSubscription, error) {
	client := clientFromContext(ctx, r.client)
	m, err := client.UserSubscription.Query().
		Where(usersubscription.UserIDEQ(userID), usersubscription.PlanIDEQ(planID)).
		WithPlan(func(q *dbent.SubscriptionPlanQuery) { q.WithGroups() }).
		Order(dbent.Desc(usersubscription.FieldExpiresAt), dbent.Desc(usersubscription.FieldID)).
		First(ctx)
	if err != nil {
		return nil, translatePersistenceError(err, service.ErrSubscriptionNotFound, nil)
	}
	return userSubscriptionEntityToService(m), nil
}

func (r *userSubscriptionRepository) ListActiveCoveringGroup(ctx context.Context, userID, groupID int64) ([]service.UserSubscription, error) {
	client := clientFromContext(ctx, r.client)
	rows, err := client.UserSubscription.Query().
		Where(
			usersubscription.UserIDEQ(userID),
			usersubscription.StatusEQ(service.SubscriptionStatusActive),
			usersubscription.ExpiresAtGT(time.Now()),
			activeSubscriptionCoversGroup(groupID),
		).
		WithPlan(func(q *dbent.SubscriptionPlanQuery) { q.WithGroups() }).
		Order(dbent.Asc(usersubscription.FieldExpiresAt), dbent.Asc(usersubscription.FieldID)).
		All(ctx)
	if err != nil {
		return nil, err
	}
	return userSubscriptionEntitiesToService(rows), nil
}

func (r *userSubscriptionRepository) ExistsActiveCoveringGroup(ctx context.Context, userID, groupID int64) (bool, error) {
	client := clientFromContext(ctx, r.client)
	return client.UserSubscription.Query().Where(
		usersubscription.UserIDEQ(userID),
		usersubscription.StatusEQ(service.SubscriptionStatusActive),
		usersubscription.ExpiresAtGT(time.Now()),
		activeSubscriptionCoversGroup(groupID),
	).Exist(ctx)
}

func (r *userSubscriptionRepository) UpdateBillingSnapshot(ctx context.Context, subscriptionID int64, snapshot service.SubscriptionBillingSnapshot, resetCycle bool) error {
	client := clientFromContext(ctx, r.client)
	var result sql.Result
	var err error
	if resetCycle {
		result, err = client.ExecContext(ctx, `
			UPDATE user_subscriptions
			SET plan_id = $1,
				cycle_quota_usd = $2,
				reset_interval_seconds = $3,
				cycle_started_at = $4,
				cycle_usage_usd = 0,
				total_quota_usd = CASE
					WHEN $8 THEN total_quota_usd
					ELSE $5
				END,
				total_usage_usd = 0,
				wallet_fallback_enabled = $6,
				updated_at = NOW()
			WHERE id = $7 AND deleted_at IS NULL
		`, snapshot.PlanID, snapshot.CycleQuotaUSD, snapshot.ResetIntervalSeconds, snapshot.CycleStartedAt, snapshot.TotalQuotaUSD, snapshot.WalletFallbackEnabled, subscriptionID, snapshot.PreserveExistingTotalQuota)
	} else if snapshot.PreserveExistingTotalQuota {
		result, err = client.ExecContext(ctx, `
			UPDATE user_subscriptions
			SET plan_id = $1,
				cycle_quota_usd = $2,
				reset_interval_seconds = $3,
				cycle_started_at = $4,
				wallet_fallback_enabled = $5,
				updated_at = NOW()
			WHERE id = $6 AND deleted_at IS NULL
		`, snapshot.PlanID, snapshot.CycleQuotaUSD, snapshot.ResetIntervalSeconds, snapshot.CycleStartedAt, snapshot.WalletFallbackEnabled, subscriptionID)
	} else if snapshot.TotalQuotaUSD == nil {
		result, err = client.ExecContext(ctx, `
			UPDATE user_subscriptions
			SET plan_id = $1,
				cycle_quota_usd = $2,
				reset_interval_seconds = $3,
				cycle_started_at = $4,
				total_quota_usd = NULL,
				wallet_fallback_enabled = $5,
				updated_at = NOW()
			WHERE id = $6 AND deleted_at IS NULL
		`, snapshot.PlanID, snapshot.CycleQuotaUSD, snapshot.ResetIntervalSeconds, snapshot.CycleStartedAt, snapshot.WalletFallbackEnabled, subscriptionID)
	} else {
		// An early renewal extends the same entitlement term. Preserve existing
		// consumption and add the newly purchased allowance. Historical unlimited
		// rows start enforcing the cap only after receiving a full fresh allowance.
		result, err = client.ExecContext(ctx, `
			UPDATE user_subscriptions
			SET plan_id = $1,
				cycle_quota_usd = $2,
				reset_interval_seconds = $3,
				cycle_started_at = $4,
				total_quota_usd = CASE
					WHEN total_quota_usd IS NULL THEN total_usage_usd + total_reserved_usd + $5
					ELSE total_quota_usd + $5
				END,
				wallet_fallback_enabled = $6,
				updated_at = NOW()
			WHERE id = $7 AND deleted_at IS NULL
		`, snapshot.PlanID, snapshot.CycleQuotaUSD, snapshot.ResetIntervalSeconds, snapshot.CycleStartedAt, *snapshot.TotalQuotaUSD, snapshot.WalletFallbackEnabled, subscriptionID)
	}
	if err != nil {
		return translatePersistenceError(err, service.ErrSubscriptionNotFound, nil)
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return service.ErrSubscriptionNotFound
	}
	return nil
}

func (r *userSubscriptionRepository) Update(ctx context.Context, sub *service.UserSubscription) error {
	if sub == nil {
		return service.ErrSubscriptionNilInput
	}

	client := clientFromContext(ctx, r.client)
	builder := client.UserSubscription.UpdateOneID(sub.ID).
		SetUserID(sub.UserID).
		SetPlanID(sub.PlanID).
		SetStartsAt(sub.StartsAt).
		SetExpiresAt(sub.ExpiresAt).
		SetStatus(sub.Status).
		SetNillableDailyWindowStart(sub.DailyWindowStart).
		SetNillableWeeklyWindowStart(sub.WeeklyWindowStart).
		SetNillableMonthlyWindowStart(sub.MonthlyWindowStart).
		SetDailyUsageUsd(sub.DailyUsageUSD).
		SetWeeklyUsageUsd(sub.WeeklyUsageUSD).
		SetMonthlyUsageUsd(sub.MonthlyUsageUSD).
		SetNillableCycleQuotaUsd(sub.CycleQuotaUSD).
		SetResetIntervalSeconds(sub.ResetIntervalSeconds).
		SetNillableCycleStartedAt(sub.CycleStartedAt).
		SetCycleUsageUsd(sub.CycleUsageUSD).
		SetCycleReservedUsd(sub.CycleReservedUSD).
		SetNillableTotalQuotaUsd(sub.TotalQuotaUSD).
		SetTotalUsageUsd(sub.TotalUsageUSD).
		SetTotalReservedUsd(sub.TotalReservedUSD).
		SetWalletFallbackEnabled(sub.WalletFallbackEnabled).
		SetNillableAssignedBy(sub.AssignedBy).
		SetAssignedAt(sub.AssignedAt).
		SetNotes(sub.Notes)

	updated, err := builder.Save(ctx)
	if err == nil {
		applyUserSubscriptionEntityToService(sub, updated)
		return nil
	}
	return translatePersistenceError(err, service.ErrSubscriptionNotFound, service.ErrSubscriptionAlreadyExists)
}

func (r *userSubscriptionRepository) Delete(ctx context.Context, id int64) error {
	// Match GORM semantics: deleting a missing row is not an error.
	client := clientFromContext(ctx, r.client)
	_, err := client.UserSubscription.Delete().Where(usersubscription.IDEQ(id)).Exec(ctx)
	return err
}

func (r *userSubscriptionRepository) Restore(ctx context.Context, subscriptionID int64, restoredStatus string) (*service.UserSubscription, error) {
	client := clientFromContext(ctx, r.client)
	queryCtx := mixins.SkipSoftDelete(ctx)
	_, err := client.UserSubscription.UpdateOneID(subscriptionID).
		SetStatus(restoredStatus).
		ClearDeletedAt().
		SetUpdatedAt(time.Now()).
		Save(queryCtx)
	if err != nil {
		return nil, translatePersistenceError(err, service.ErrSubscriptionNotFound, service.ErrSubscriptionRestoreConflict)
	}
	return r.GetByID(ctx, subscriptionID)
}

func (r *userSubscriptionRepository) ListByUserID(ctx context.Context, userID int64) ([]service.UserSubscription, error) {
	client := clientFromContext(ctx, r.client)
	subs, err := client.UserSubscription.Query().
		Where(usersubscription.UserIDEQ(userID)).
		WithPlan(func(q *dbent.SubscriptionPlanQuery) { q.WithGroups() }).
		Order(dbent.Desc(usersubscription.FieldCreatedAt)).
		All(ctx)
	if err != nil {
		return nil, err
	}
	return userSubscriptionEntitiesToService(subs), nil
}

func (r *userSubscriptionRepository) ListActiveByUserID(ctx context.Context, userID int64) ([]service.UserSubscription, error) {
	client := clientFromContext(ctx, r.client)
	subs, err := client.UserSubscription.Query().
		Where(
			usersubscription.UserIDEQ(userID),
			usersubscription.StatusEQ(service.SubscriptionStatusActive),
			usersubscription.ExpiresAtGT(time.Now()),
		).
		WithPlan(func(q *dbent.SubscriptionPlanQuery) { q.WithGroups() }).
		Order(dbent.Desc(usersubscription.FieldCreatedAt)).
		All(ctx)
	if err != nil {
		return nil, err
	}
	return userSubscriptionEntitiesToService(subs), nil
}

func (r *userSubscriptionRepository) ListByGroupID(ctx context.Context, groupID int64, params pagination.PaginationParams) ([]service.UserSubscription, *pagination.PaginationResult, error) {
	client := clientFromContext(ctx, r.client)
	q := client.UserSubscription.Query().Where(activeSubscriptionCoversGroup(groupID))

	total, err := q.Clone().Count(ctx)
	if err != nil {
		return nil, nil, err
	}

	subs, err := q.
		WithUser().
		WithPlan(func(q *dbent.SubscriptionPlanQuery) { q.WithGroups() }).
		Order(dbent.Desc(usersubscription.FieldCreatedAt)).
		Offset(params.Offset()).
		Limit(params.Limit()).
		All(ctx)
	if err != nil {
		return nil, nil, err
	}

	return userSubscriptionEntitiesToService(subs), paginationResultFromTotal(int64(total), params), nil
}

func (r *userSubscriptionRepository) List(ctx context.Context, params pagination.PaginationParams, userID, groupID *int64, status, platform, sortBy, sortOrder string) ([]service.UserSubscription, *pagination.PaginationResult, error) {
	client := clientFromContext(ctx, r.client)
	q := client.UserSubscription.Query()
	includeSoftDeleted := status == "" || status == service.SubscriptionStatusRevoked
	if userID != nil {
		q = q.Where(usersubscription.UserIDEQ(*userID))
	}
	if groupID != nil {
		q = q.Where(activeSubscriptionCoversGroup(*groupID))
	}
	if platform != "" {
		groupPredicates := []predicate.Group{group.PlatformEQ(platform)}
		if includeSoftDeleted {
			groupPredicates = append(groupPredicates, group.DeletedAtIsNil())
		}
		q = q.Where(usersubscription.HasPlanWith(subscriptionplan.HasGroupsWith(groupPredicates...)))
	}

	// Status filtering with real-time expiration check
	now := time.Now()
	switch status {
	case service.SubscriptionStatusActive:
		// Active: status is active AND not yet expired
		q = q.Where(
			usersubscription.StatusEQ(service.SubscriptionStatusActive),
			usersubscription.ExpiresAtGT(now),
		)
	case service.SubscriptionStatusExpired:
		// Expired: status is expired OR (status is active but already expired)
		q = q.Where(
			usersubscription.Or(
				usersubscription.StatusEQ(service.SubscriptionStatusExpired),
				usersubscription.And(
					usersubscription.StatusEQ(service.SubscriptionStatusActive),
					usersubscription.ExpiresAtLTE(now),
				),
			),
		)
	case service.SubscriptionStatusRevoked:
		// Revoked is a DTO/API display state backed by user_subscriptions.deleted_at.
		q = q.Where(usersubscription.DeletedAtNotNil())
	case "":
		// No filter. Use SkipSoftDelete below so admin "all status" includes revoked history.
	default:
		// Other persisted status.
		q = q.Where(usersubscription.StatusEQ(status))
	}

	queryCtx := ctx
	if includeSoftDeleted {
		queryCtx = mixins.SkipSoftDelete(ctx)
	}

	total, err := q.Clone().Count(queryCtx)
	if err != nil {
		return nil, nil, err
	}

	if !includeSoftDeleted {
		q = q.WithUser().WithPlan(func(q *dbent.SubscriptionPlanQuery) { q.WithGroups() }).WithAssignedByUser()
	}

	// Determine sort field
	var field string
	switch sortBy {
	case "expires_at":
		field = usersubscription.FieldExpiresAt
	case "status":
		field = usersubscription.FieldStatus
	default:
		field = usersubscription.FieldCreatedAt
	}

	// Determine sort order (default: desc)
	if sortOrder == "asc" && sortBy != "" {
		q = q.Order(dbent.Asc(field))
	} else {
		q = q.Order(dbent.Desc(field))
	}

	subs, err := q.
		Offset(params.Offset()).
		Limit(params.Limit()).
		All(queryCtx)
	if err != nil {
		return nil, nil, err
	}

	result := userSubscriptionEntitiesToService(subs)
	if includeSoftDeleted {
		if err := r.attachUserSubscriptionRelations(ctx, result); err != nil {
			return nil, nil, err
		}
	}

	return result, paginationResultFromTotal(int64(total), params), nil
}

func (r *userSubscriptionRepository) ExtendExpiry(ctx context.Context, subscriptionID int64, newExpiresAt time.Time) error {
	client := clientFromContext(ctx, r.client)
	_, err := client.UserSubscription.UpdateOneID(subscriptionID).
		SetExpiresAt(newExpiresAt).
		Save(ctx)
	return translatePersistenceError(err, service.ErrSubscriptionNotFound, nil)
}

func (r *userSubscriptionRepository) UpdateStatus(ctx context.Context, subscriptionID int64, status string) error {
	client := clientFromContext(ctx, r.client)
	_, err := client.UserSubscription.UpdateOneID(subscriptionID).
		SetStatus(status).
		Save(ctx)
	return translatePersistenceError(err, service.ErrSubscriptionNotFound, nil)
}

func (r *userSubscriptionRepository) UpdateNotes(ctx context.Context, subscriptionID int64, notes string) error {
	client := clientFromContext(ctx, r.client)
	_, err := client.UserSubscription.UpdateOneID(subscriptionID).
		SetNotes(notes).
		Save(ctx)
	return translatePersistenceError(err, service.ErrSubscriptionNotFound, nil)
}

func (r *userSubscriptionRepository) ActivateWindows(ctx context.Context, id int64, start time.Time) error {
	client := clientFromContext(ctx, r.client)
	n, err := client.UserSubscription.Update().
		Where(
			usersubscription.IDEQ(id),
			usersubscription.DailyWindowStartIsNil(),
			usersubscription.WeeklyWindowStartIsNil(),
			usersubscription.MonthlyWindowStartIsNil(),
		).
		SetDailyWindowStart(start).
		SetWeeklyWindowStart(start).
		SetMonthlyWindowStart(start).
		Save(ctx)
	return r.translateConditionalWindowReset(ctx, client, id, n, err)
}

func (r *userSubscriptionRepository) ResetUsageWindows(ctx context.Context, id int64, resetDaily, resetWeekly, resetMonthly bool, newWindowStart time.Time) error {
	client := clientFromContext(ctx, r.client)
	update := client.UserSubscription.UpdateOneID(id)
	if resetDaily {
		update.SetDailyUsageUsd(0).SetDailyWindowStart(newWindowStart)
	}
	if resetWeekly {
		update.SetWeeklyUsageUsd(0).SetWeeklyWindowStart(newWindowStart)
	}
	if resetMonthly {
		update.SetMonthlyUsageUsd(0).SetMonthlyWindowStart(newWindowStart)
	}
	_, err := update.Save(ctx)
	return translatePersistenceError(err, service.ErrSubscriptionNotFound, nil)
}

func (r *userSubscriptionRepository) ResetDailyUsage(ctx context.Context, id int64, expectedWindowStart *time.Time, newWindowStart time.Time) error {
	client := clientFromContext(ctx, r.client)
	query := client.UserSubscription.Update().Where(usersubscription.IDEQ(id))
	if expectedWindowStart == nil {
		query = query.Where(usersubscription.DailyWindowStartIsNil())
	} else {
		query = query.Where(usersubscription.DailyWindowStartEQ(*expectedWindowStart))
	}
	n, err := query.
		SetDailyUsageUsd(0).
		SetDailyWindowStart(newWindowStart).
		Save(ctx)
	return r.translateConditionalWindowReset(ctx, client, id, n, err)
}

func (r *userSubscriptionRepository) ResetWeeklyUsage(ctx context.Context, id int64, expectedWindowStart *time.Time, newWindowStart time.Time) error {
	client := clientFromContext(ctx, r.client)
	query := client.UserSubscription.Update().Where(usersubscription.IDEQ(id))
	if expectedWindowStart == nil {
		query = query.Where(usersubscription.WeeklyWindowStartIsNil())
	} else {
		query = query.Where(usersubscription.WeeklyWindowStartEQ(*expectedWindowStart))
	}
	n, err := query.
		SetWeeklyUsageUsd(0).
		SetWeeklyWindowStart(newWindowStart).
		Save(ctx)
	return r.translateConditionalWindowReset(ctx, client, id, n, err)
}

func (r *userSubscriptionRepository) ResetMonthlyUsage(ctx context.Context, id int64, expectedWindowStart *time.Time, newWindowStart time.Time) error {
	client := clientFromContext(ctx, r.client)
	query := client.UserSubscription.Update().Where(usersubscription.IDEQ(id))
	if expectedWindowStart == nil {
		query = query.Where(usersubscription.MonthlyWindowStartIsNil())
	} else {
		query = query.Where(usersubscription.MonthlyWindowStartEQ(*expectedWindowStart))
	}
	n, err := query.
		SetMonthlyUsageUsd(0).
		SetMonthlyWindowStart(newWindowStart).
		Save(ctx)
	return r.translateConditionalWindowReset(ctx, client, id, n, err)
}

func (r *userSubscriptionRepository) translateConditionalWindowReset(ctx context.Context, client *dbent.Client, id int64, affected int, err error) error {
	if err != nil {
		return translatePersistenceError(err, service.ErrSubscriptionNotFound, nil)
	}
	if affected > 0 {
		return nil
	}

	// A stale reset is an expected no-op: another request already advanced the
	// window. Preserve not-found semantics for callers that target a missing row.
	exists, err := client.UserSubscription.Query().Where(usersubscription.IDEQ(id)).Exist(ctx)
	if err != nil {
		return translatePersistenceError(err, service.ErrSubscriptionNotFound, nil)
	}
	if !exists {
		return service.ErrSubscriptionNotFound
	}
	return nil
}

// IncrementUsage 原子性地累加订阅用量。
// 限额检查已在请求前由 BillingCacheService.CheckBillingEligibility 完成，
// 此处仅负责记录实际消费，确保消费数据的完整性。
func (r *userSubscriptionRepository) IncrementUsage(ctx context.Context, id int64, costUSD float64) error {
	const updateSQL = `
			UPDATE user_subscriptions
			SET
				daily_usage_usd = daily_usage_usd + $1,
				weekly_usage_usd = weekly_usage_usd + $1,
				monthly_usage_usd = monthly_usage_usd + $1,
				cycle_started_at = CASE
					WHEN reset_interval_seconds > 0 AND (
						cycle_started_at IS NULL OR
						NOW() >= cycle_started_at + reset_interval_seconds * INTERVAL '1 second'
					) THEN NOW()
					ELSE cycle_started_at
				END,
				cycle_usage_usd = CASE
					WHEN reset_interval_seconds > 0 AND (
						cycle_started_at IS NULL OR
						NOW() >= cycle_started_at + reset_interval_seconds * INTERVAL '1 second'
					) THEN $1
					ELSE cycle_usage_usd + $1
				END,
				total_usage_usd = total_usage_usd + $1,
				updated_at = NOW()
			WHERE id = $2
				AND deleted_at IS NULL
		`

	client := clientFromContext(ctx, r.client)
	result, err := client.ExecContext(ctx, updateSQL, costUSD, id)
	if err != nil {
		return err
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if affected > 0 {
		return nil
	}

	// affected == 0：订阅不存在或已删除
	return service.ErrSubscriptionNotFound
}

func (r *userSubscriptionRepository) BatchUpdateExpiredStatus(ctx context.Context) (int64, error) {
	client := clientFromContext(ctx, r.client)
	n, err := client.UserSubscription.Update().
		Where(
			usersubscription.StatusEQ(service.SubscriptionStatusActive),
			usersubscription.ExpiresAtLTE(time.Now()),
		).
		SetStatus(service.SubscriptionStatusExpired).
		Save(ctx)
	return int64(n), err
}

// Extra repository helpers (currently used only by integration tests).

func (r *userSubscriptionRepository) ListExpired(ctx context.Context) ([]service.UserSubscription, error) {
	client := clientFromContext(ctx, r.client)
	subs, err := client.UserSubscription.Query().
		Where(
			usersubscription.StatusEQ(service.SubscriptionStatusActive),
			usersubscription.ExpiresAtLTE(time.Now()),
		).
		All(ctx)
	if err != nil {
		return nil, err
	}
	return userSubscriptionEntitiesToService(subs), nil
}

func (r *userSubscriptionRepository) attachUserSubscriptionRelations(ctx context.Context, subs []service.UserSubscription) error {
	if len(subs) == 0 {
		return nil
	}

	userIDs := make([]int64, 0, len(subs))
	planIDs := make([]int64, 0, len(subs))
	assignedByIDs := make([]int64, 0, len(subs))
	for i := range subs {
		userIDs = append(userIDs, subs[i].UserID)
		planIDs = append(planIDs, subs[i].PlanID)
		if subs[i].AssignedBy != nil {
			assignedByIDs = append(assignedByIDs, *subs[i].AssignedBy)
		}
	}

	client := clientFromContext(ctx, r.client)
	users, err := client.User.Query().Where(user.IDIn(uniqueInt64s(userIDs)...)).All(ctx)
	if err != nil {
		return err
	}
	userByID := make(map[int64]*service.User, len(users))
	for _, u := range users {
		userByID[u.ID] = userEntityToService(u)
	}

	plans, err := client.SubscriptionPlan.Query().Where(subscriptionplan.IDIn(uniqueInt64s(planIDs)...)).WithGroups().All(ctx)
	if err != nil {
		return err
	}
	planByID := make(map[int64]*dbent.SubscriptionPlan, len(plans))
	for _, plan := range plans {
		planByID[plan.ID] = plan
	}

	assignedByID := map[int64]*service.User{}
	if len(assignedByIDs) > 0 {
		assignedUsers, err := client.User.Query().Where(user.IDIn(uniqueInt64s(assignedByIDs)...)).All(ctx)
		if err != nil {
			return err
		}
		assignedByID = make(map[int64]*service.User, len(assignedUsers))
		for _, u := range assignedUsers {
			assignedByID[u.ID] = userEntityToService(u)
		}
	}

	for i := range subs {
		subs[i].User = userByID[subs[i].UserID]
		if plan := planByID[subs[i].PlanID]; plan != nil {
			subs[i].PlanName = plan.Name
			for _, g := range plan.Edges.Groups {
				if mapped := groupEntityToService(g); mapped != nil {
					subs[i].IncludedGroups = append(subs[i].IncludedGroups, *mapped)
				}
			}
		}
		if subs[i].AssignedBy != nil {
			subs[i].AssignedByUser = assignedByID[*subs[i].AssignedBy]
		}
	}
	return nil
}

func uniqueInt64s(values []int64) []int64 {
	seen := make(map[int64]struct{}, len(values))
	out := make([]int64, 0, len(values))
	for _, v := range values {
		if _, ok := seen[v]; ok {
			continue
		}
		seen[v] = struct{}{}
		out = append(out, v)
	}
	return out
}

func userSubscriptionEntityToService(m *dbent.UserSubscription) *service.UserSubscription {
	return userSubscriptionEntityToServiceWithStatusMapping(m, true)
}

func userSubscriptionEntityToServicePreserveStatus(m *dbent.UserSubscription) *service.UserSubscription {
	return userSubscriptionEntityToServiceWithStatusMapping(m, false)
}

func userSubscriptionEntityToServiceWithStatusMapping(m *dbent.UserSubscription, mapDeletedToRevoked bool) *service.UserSubscription {
	if m == nil {
		return nil
	}
	status := m.Status
	if mapDeletedToRevoked && m.DeletedAt != nil {
		status = service.SubscriptionStatusRevoked
	}
	out := &service.UserSubscription{
		ID:                    m.ID,
		UserID:                m.UserID,
		PlanID:                m.PlanID,
		StartsAt:              m.StartsAt,
		ExpiresAt:             m.ExpiresAt,
		Status:                status,
		DailyWindowStart:      m.DailyWindowStart,
		WeeklyWindowStart:     m.WeeklyWindowStart,
		MonthlyWindowStart:    m.MonthlyWindowStart,
		DailyUsageUSD:         m.DailyUsageUsd,
		WeeklyUsageUSD:        m.WeeklyUsageUsd,
		MonthlyUsageUSD:       m.MonthlyUsageUsd,
		CycleQuotaUSD:         m.CycleQuotaUsd,
		ResetIntervalSeconds:  m.ResetIntervalSeconds,
		CycleStartedAt:        m.CycleStartedAt,
		CycleUsageUSD:         m.CycleUsageUsd,
		CycleReservedUSD:      m.CycleReservedUsd,
		TotalQuotaUSD:         m.TotalQuotaUsd,
		TotalUsageUSD:         m.TotalUsageUsd,
		TotalReservedUSD:      m.TotalReservedUsd,
		WalletFallbackEnabled: m.WalletFallbackEnabled,
		AssignedBy:            m.AssignedBy,
		AssignedAt:            m.AssignedAt,
		Notes:                 derefString(m.Notes),
		CreatedAt:             m.CreatedAt,
		UpdatedAt:             m.UpdatedAt,
		DeletedAt:             m.DeletedAt,
	}
	if m.Edges.User != nil {
		out.User = userEntityToService(m.Edges.User)
	}
	if m.Edges.AssignedByUser != nil {
		out.AssignedByUser = userEntityToService(m.Edges.AssignedByUser)
	}
	if m.Edges.Plan != nil {
		out.PlanName = m.Edges.Plan.Name
		for _, g := range m.Edges.Plan.Edges.Groups {
			if mapped := groupEntityToService(g); mapped != nil {
				out.IncludedGroups = append(out.IncludedGroups, *mapped)
			}
		}
	}
	return out
}

func userSubscriptionEntitiesToService(models []*dbent.UserSubscription) []service.UserSubscription {
	out := make([]service.UserSubscription, 0, len(models))
	for i := range models {
		if s := userSubscriptionEntityToService(models[i]); s != nil {
			out = append(out, *s)
		}
	}
	return out
}

func applyUserSubscriptionEntityToService(dst *service.UserSubscription, src *dbent.UserSubscription) {
	if dst == nil || src == nil {
		return
	}
	dst.ID = src.ID
	dst.PlanID = src.PlanID
	dst.CycleQuotaUSD = src.CycleQuotaUsd
	dst.ResetIntervalSeconds = src.ResetIntervalSeconds
	dst.CycleStartedAt = src.CycleStartedAt
	dst.CycleUsageUSD = src.CycleUsageUsd
	dst.CycleReservedUSD = src.CycleReservedUsd
	dst.TotalQuotaUSD = src.TotalQuotaUsd
	dst.TotalUsageUSD = src.TotalUsageUsd
	dst.TotalReservedUSD = src.TotalReservedUsd
	dst.WalletFallbackEnabled = src.WalletFallbackEnabled
	dst.CreatedAt = src.CreatedAt
	dst.UpdatedAt = src.UpdatedAt
}
