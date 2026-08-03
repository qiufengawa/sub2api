package repository

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	dbent "github.com/Wei-Shaw/sub2api/ent"
	"github.com/Wei-Shaw/sub2api/internal/pkg/logger"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/shopspring/decimal"
)

type usageBillingRepository struct {
	db *sql.DB
}

func NewUsageBillingRepository(_ *dbent.Client, sqlDB *sql.DB) service.UsageBillingRepository {
	return &usageBillingRepository{db: sqlDB}
}

func (r *usageBillingRepository) Apply(ctx context.Context, cmd *service.UsageBillingCommand) (_ *service.UsageBillingApplyResult, err error) {
	if cmd == nil {
		return &service.UsageBillingApplyResult{}, nil
	}
	if r == nil || r.db == nil {
		return nil, errors.New("usage billing repository db is nil")
	}

	cmd.Normalize()
	if cmd.RequestID == "" {
		return nil, service.ErrUsageBillingRequestIDRequired
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer func() {
		if tx != nil {
			_ = tx.Rollback()
		}
	}()

	applied, err := r.claimUsageBillingKey(ctx, tx, cmd)
	if err != nil {
		return nil, err
	}
	if !applied {
		return &service.UsageBillingApplyResult{Applied: false}, nil
	}

	result := &service.UsageBillingApplyResult{Applied: true}
	if err := r.applyUsageBillingEffects(ctx, tx, cmd, result); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	tx = nil
	return result, nil
}

func (r *usageBillingRepository) claimUsageBillingKey(ctx context.Context, tx *sql.Tx, cmd *service.UsageBillingCommand) (bool, error) {
	return r.claimUsageBillingRequest(ctx, tx, cmd.RequestID, cmd.APIKeyID, cmd.RequestFingerprint)
}

func (r *usageBillingRepository) claimUsageBillingRequest(ctx context.Context, tx *sql.Tx, requestID string, apiKeyID int64, requestFingerprint string) (bool, error) {
	var id int64
	err := tx.QueryRowContext(ctx, `
		INSERT INTO usage_billing_dedup (request_id, api_key_id, request_fingerprint)
		VALUES ($1, $2, $3)
		ON CONFLICT (request_id, api_key_id) DO NOTHING
		RETURNING id
	`, requestID, apiKeyID, requestFingerprint).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		var existingFingerprint string
		if err := tx.QueryRowContext(ctx, `
			SELECT request_fingerprint
			FROM usage_billing_dedup
			WHERE request_id = $1 AND api_key_id = $2
		`, requestID, apiKeyID).Scan(&existingFingerprint); err != nil {
			return false, err
		}
		if strings.TrimSpace(existingFingerprint) != strings.TrimSpace(requestFingerprint) {
			return false, service.ErrUsageBillingRequestConflict
		}
		return false, nil
	}
	if err != nil {
		return false, err
	}
	var archivedFingerprint string
	err = tx.QueryRowContext(ctx, `
		SELECT request_fingerprint
		FROM usage_billing_dedup_archive
		WHERE request_id = $1 AND api_key_id = $2
	`, requestID, apiKeyID).Scan(&archivedFingerprint)
	if err == nil {
		if strings.TrimSpace(archivedFingerprint) != strings.TrimSpace(requestFingerprint) {
			return false, service.ErrUsageBillingRequestConflict
		}
		return false, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return false, err
	}
	return true, nil
}

func (r *usageBillingRepository) ReserveBatchImageBalance(ctx context.Context, cmd *service.BatchImageBalanceHoldCommand) (*service.BatchImageBalanceHoldResult, error) {
	apply := reserveUsageBillingBatchImageBalance
	if cmd != nil && cmd.ResolveBillingSource {
		apply = reserveUsageBillingBatchImageFunding
	}
	return r.applyBatchImageBalanceHold(ctx, cmd, apply)
}

func (r *usageBillingRepository) CaptureBatchImageBalance(ctx context.Context, cmd *service.BatchImageBalanceHoldCommand) (*service.BatchImageBalanceHoldResult, error) {
	return r.applyBatchImageBalanceHold(ctx, cmd, captureUsageBillingBatchImageFunding)
}

func (r *usageBillingRepository) ReleaseBatchImageBalance(ctx context.Context, cmd *service.BatchImageBalanceHoldCommand) (*service.BatchImageBalanceHoldResult, error) {
	return r.applyBatchImageBalanceHold(ctx, cmd, releaseUsageBillingBatchImageFunding)
}

func (r *usageBillingRepository) applyBatchImageBalanceHold(
	ctx context.Context,
	cmd *service.BatchImageBalanceHoldCommand,
	apply func(context.Context, *sql.Tx, *service.BatchImageBalanceHoldCommand) (*service.BatchImageBalanceHoldResult, error),
) (_ *service.BatchImageBalanceHoldResult, err error) {
	if cmd == nil {
		return &service.BatchImageBalanceHoldResult{}, nil
	}
	if r == nil || r.db == nil {
		return nil, errors.New("usage billing repository db is nil")
	}
	cmd.Normalize()
	if cmd.RequestID == "" {
		return nil, service.ErrUsageBillingRequestIDRequired
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer func() {
		if tx != nil {
			_ = tx.Rollback()
		}
	}()

	applied, err := r.claimUsageBillingRequest(ctx, tx, cmd.RequestID, cmd.APIKeyID, cmd.RequestFingerprint)
	if err != nil {
		return nil, err
	}
	if !applied {
		reservation, found, loadErr := loadBatchImageBillingReservation(ctx, tx, service.BatchImageHoldRequestID(cmd.BatchID), cmd.APIKeyID)
		if loadErr != nil {
			return nil, loadErr
		}
		if found {
			return batchImageReservationResult(reservation, false), nil
		}
		return &service.BatchImageBalanceHoldResult{Applied: false}, nil
	}

	result, err := apply(ctx, tx, cmd)
	if err != nil {
		return nil, err
	}
	if result == nil {
		result = &service.BatchImageBalanceHoldResult{}
	}
	result.Applied = true

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	tx = nil
	return result, nil
}

func (r *usageBillingRepository) applyUsageBillingEffects(ctx context.Context, tx *sql.Tx, cmd *service.UsageBillingCommand, result *service.UsageBillingApplyResult) error {
	if cmd.ResolveBillingSource {
		settledReservation, err := settlePendingUsageBillingReservation(ctx, tx, cmd, result)
		if err != nil {
			return err
		}
		if !settledReservation {
			if err := applyPlanCoverageBillingDecision(ctx, tx, cmd, result); err != nil {
				return err
			}
		}
	} else {
		if cmd.SubscriptionCost.IsPositive() && cmd.SubscriptionID != nil {
			if err := incrementUsageBillingSubscription(ctx, tx, *cmd.SubscriptionID, cmd.SubscriptionCost); err != nil {
				return err
			}
		}

		if cmd.BalanceCost.IsPositive() {
			newBalance, sufficient, err := deductUsageBillingBalance(ctx, tx, cmd.UserID, cmd.BalanceCost)
			if err != nil {
				return err
			}
			result.NewBalance = &newBalance
			result.BalanceOverdrafted = !sufficient
		}
	}

	if cmd.APIKeyQuotaCost.IsPositive() {
		exhausted, err := incrementUsageBillingAPIKeyQuota(ctx, tx, cmd.APIKeyID, cmd.APIKeyQuotaCost)
		if err != nil {
			return err
		}
		result.APIKeyQuotaExhausted = exhausted
	}

	if cmd.APIKeyRateLimitCost.IsPositive() {
		if err := incrementUsageBillingAPIKeyRateLimit(ctx, tx, cmd.APIKeyID, cmd.APIKeyRateLimitCost); err != nil {
			return err
		}
	}

	if cmd.AccountQuotaCost.IsPositive() && (strings.EqualFold(cmd.AccountType, service.AccountTypeAPIKey) || strings.EqualFold(cmd.AccountType, service.AccountTypeBedrock)) {
		quotaState, err := incrementUsageBillingAccountQuota(ctx, tx, cmd.AccountID, cmd.AccountQuotaCost)
		if err != nil {
			return err
		}
		result.QuotaState = quotaState
	}

	return nil
}

type subscriptionBillingCandidate struct {
	id                    int64
	expiresAt             time.Time
	cycleQuotaUSD         *decimal.Decimal
	resetIntervalSeconds  int
	cycleStartedAt        *time.Time
	cycleUsageUSD         decimal.Decimal
	cycleReservedUSD      decimal.Decimal
	totalQuotaUSD         *decimal.Decimal
	totalUsageUSD         decimal.Decimal
	totalReservedUSD      decimal.Decimal
	walletFallbackEnabled bool
}

func (c *subscriptionBillingCandidate) canFund(amount decimal.Decimal) bool {
	if c == nil {
		return false
	}
	cycleAvailable := c.cycleQuotaUSD == nil || !c.cycleQuotaUSD.IsPositive() ||
		c.cycleUsageUSD.Add(c.cycleReservedUSD).Add(amount).LessThanOrEqual(*c.cycleQuotaUSD)
	totalAvailable := c.totalQuotaUSD == nil || !c.totalQuotaUSD.IsPositive() ||
		c.totalUsageUSD.Add(c.totalReservedUSD).Add(amount).LessThanOrEqual(*c.totalQuotaUSD)
	return cycleAvailable && totalAvailable
}

func applyPlanCoverageBillingDecision(
	ctx context.Context,
	tx *sql.Tx,
	cmd *service.UsageBillingCommand,
	result *service.UsageBillingApplyResult,
) error {
	preference, balance, err := lockUsageBillingUser(ctx, tx, cmd.UserID)
	if err != nil {
		return err
	}
	if requested := strings.TrimSpace(cmd.BillingPreference); requested != "" {
		// The locked database value remains authoritative. The command snapshot is
		// retained in the fingerprint only to detect conflicting retries.
		_ = requested
	}
	preference = service.NormalizeBillingPreference(preference)
	result.BillingPreference = preference

	candidates, err := listSubscriptionBillingCandidates(ctx, tx, cmd.UserID, cmd.GroupID, time.Now().UTC())
	if err != nil {
		return err
	}
	amount := cmd.BillableCost
	if amount.IsNegative() {
		amount = decimal.Zero
	}

	chooseSubscription := func() *subscriptionBillingCandidate {
		for i := range candidates {
			candidate := &candidates[i]
			if candidate.canFund(amount) {
				return candidate
			}
		}
		return nil
	}
	useSubscription := func(candidate *subscriptionBillingCandidate, fallbackReason string) error {
		if candidate == nil {
			return service.ErrSubscriptionQuotaExceeded
		}
		if amount.IsPositive() {
			if err := incrementSelectedUsageBillingSubscription(ctx, tx, candidate.id, amount); err != nil {
				return err
			}
		}
		result.BillingSource = service.BillingSourceSubscription
		result.BillingFallbackReason = fallbackReason
		result.SubscriptionID = &candidate.id
		return nil
	}
	useWallet := func(fallbackReason string) error {
		result.BillingSource = service.BillingSourceWallet
		result.BillingFallbackReason = fallbackReason
		if !amount.IsPositive() {
			return nil
		}
		newBalance, sufficient, err := deductUsageBillingBalance(ctx, tx, cmd.UserID, amount)
		if err != nil {
			return err
		}
		result.NewBalance = &newBalance
		result.BalanceOverdrafted = !sufficient
		return nil
	}

	switch preference {
	case service.BillingPreferenceWalletOnly:
		err = useWallet("")
	case service.BillingPreferenceWalletFirst:
		if balance.GreaterThanOrEqual(amount) {
			err = useWallet("")
		} else if candidate := chooseSubscription(); candidate != nil {
			err = useSubscription(candidate, "wallet_insufficient")
		} else {
			err = useWallet("wallet_insufficient_subscription_unavailable")
		}
	case service.BillingPreferenceSubscriptionOnly:
		err = useSubscription(chooseSubscription(), "")
	default:
		if candidate := chooseSubscription(); candidate != nil {
			err = useSubscription(candidate, "")
		} else {
			fallbackAllowed := len(candidates) == 0
			for i := range candidates {
				if candidates[i].walletFallbackEnabled {
					fallbackAllowed = true
					break
				}
			}
			if !fallbackAllowed {
				return service.ErrSubscriptionQuotaExceeded
			}
			reason := "subscription_unavailable"
			if len(candidates) > 0 {
				reason = "subscription_quota_exhausted"
			}
			err = useWallet(reason)
		}
	}
	if err != nil {
		return err
	}

	return insertSettledBillingReservation(ctx, tx, cmd, result, amount)
}

func lockUsageBillingUser(ctx context.Context, tx *sql.Tx, userID int64) (string, decimal.Decimal, error) {
	var preference string
	var balance decimal.Decimal
	err := tx.QueryRowContext(ctx, `
		SELECT billing_preference, balance
		FROM users
		WHERE id = $1 AND deleted_at IS NULL
		FOR UPDATE
	`, userID).Scan(&preference, &balance)
	if errors.Is(err, sql.ErrNoRows) {
		return "", decimal.Zero, service.ErrUserNotFound
	}
	return preference, balance, err
}

func listSubscriptionBillingCandidates(
	ctx context.Context,
	tx *sql.Tx,
	userID int64,
	groupID *int64,
	now time.Time,
) ([]subscriptionBillingCandidate, error) {
	if groupID == nil || *groupID <= 0 {
		return nil, nil
	}
	rows, err := tx.QueryContext(ctx, `
		SELECT
			us.id,
			us.expires_at,
			us.cycle_quota_usd,
			us.reset_interval_seconds,
			us.cycle_started_at,
				us.cycle_usage_usd,
				us.cycle_reserved_usd,
				us.total_quota_usd,
				us.total_usage_usd,
				us.total_reserved_usd,
				us.wallet_fallback_enabled
		FROM user_subscriptions us
		WHERE us.user_id = $1
			AND us.deleted_at IS NULL
			AND us.status = 'active'
			AND us.expires_at > $3
			AND EXISTS (
				SELECT 1
				FROM subscription_plan_groups spg
				WHERE spg.plan_id = us.plan_id AND spg.group_id = $2
			)
		ORDER BY us.expires_at ASC, us.id ASC
		FOR UPDATE OF us
	`, userID, *groupID, now)
	if err != nil {
		return nil, err
	}
	candidates := make([]subscriptionBillingCandidate, 0)
	resetIndexes := make([]int, 0)
	for rows.Next() {
		var candidate subscriptionBillingCandidate
		var cycleQuota, totalQuota decimal.NullDecimal
		var cycleStart sql.NullTime
		if err := rows.Scan(
			&candidate.id,
			&candidate.expiresAt,
			&cycleQuota,
			&candidate.resetIntervalSeconds,
			&cycleStart,
			&candidate.cycleUsageUSD,
			&candidate.cycleReservedUSD,
			&totalQuota,
			&candidate.totalUsageUSD,
			&candidate.totalReservedUSD,
			&candidate.walletFallbackEnabled,
		); err != nil {
			return nil, err
		}
		if cycleQuota.Valid {
			value := cycleQuota.Decimal
			candidate.cycleQuotaUSD = &value
		}
		if totalQuota.Valid {
			value := totalQuota.Decimal
			candidate.totalQuotaUSD = &value
		}
		if cycleStart.Valid {
			value := cycleStart.Time
			candidate.cycleStartedAt = &value
		}
		needsReset := resetSubscriptionBillingCycle(&candidate, now)
		candidates = append(candidates, candidate)
		if needsReset {
			resetIndexes = append(resetIndexes, len(candidates)-1)
		}
	}
	if err := rows.Err(); err != nil {
		_ = rows.Close()
		return nil, err
	}
	if err := rows.Close(); err != nil {
		return nil, err
	}
	for _, index := range resetIndexes {
		candidate := &candidates[index]
		if _, err := tx.ExecContext(ctx, `
			UPDATE user_subscriptions
			SET cycle_started_at = $1, cycle_usage_usd = 0, updated_at = NOW()
			WHERE id = $2 AND deleted_at IS NULL
		`, *candidate.cycleStartedAt, candidate.id); err != nil {
			return nil, err
		}
	}
	return candidates, nil
}

func resetSubscriptionBillingCycle(candidate *subscriptionBillingCandidate, now time.Time) bool {
	if candidate == nil || candidate.resetIntervalSeconds <= 0 {
		return false
	}
	period := time.Duration(candidate.resetIntervalSeconds) * time.Second
	if candidate.cycleStartedAt == nil {
		candidate.cycleStartedAt = &now
		candidate.cycleUsageUSD = decimal.Zero
		return true
	}
	start := *candidate.cycleStartedAt
	if now.Before(start.Add(period)) {
		return false
	}
	periods := now.Sub(start) / period
	start = start.Add(periods * period)
	candidate.cycleStartedAt = &start
	candidate.cycleUsageUSD = decimal.Zero
	return true
}

func incrementSelectedUsageBillingSubscription(ctx context.Context, tx *sql.Tx, subscriptionID int64, amount decimal.Decimal) error {
	res, err := tx.ExecContext(ctx, `
		UPDATE user_subscriptions
			SET cycle_usage_usd = cycle_usage_usd + $1,
				total_usage_usd = total_usage_usd + $1,
			daily_usage_usd = daily_usage_usd + $1,
			weekly_usage_usd = weekly_usage_usd + $1,
			monthly_usage_usd = monthly_usage_usd + $1,
			updated_at = NOW()
		WHERE id = $2 AND deleted_at IS NULL
	`, amount, subscriptionID)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return service.ErrSubscriptionNotFound
	}
	return nil
}

func insertSettledBillingReservation(
	ctx context.Context,
	tx *sql.Tx,
	cmd *service.UsageBillingCommand,
	result *service.UsageBillingApplyResult,
	amount decimal.Decimal,
) error {
	_, err := tx.ExecContext(ctx, `
		INSERT INTO billing_reservations (
			request_id, api_key_id, user_id, group_id, subscription_id,
			billing_source, billing_preference, fallback_reason,
			reserved_amount, final_amount, status, settled_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, NULLIF($8, ''), $9, $9, 'settled', NOW())
	`,
		cmd.RequestID,
		cmd.APIKeyID,
		cmd.UserID,
		cmd.GroupID,
		result.SubscriptionID,
		result.BillingSource,
		result.BillingPreference,
		result.BillingFallbackReason,
		amount,
	)
	return err
}

func incrementUsageBillingSubscription(ctx context.Context, tx *sql.Tx, subscriptionID int64, costUSD decimal.Decimal) error {
	const updateSQL = `
		UPDATE user_subscriptions us
		SET
			daily_usage_usd = us.daily_usage_usd + $1,
			weekly_usage_usd = us.weekly_usage_usd + $1,
			monthly_usage_usd = us.monthly_usage_usd + $1,
			cycle_started_at = CASE
				WHEN us.reset_interval_seconds > 0 AND (
					us.cycle_started_at IS NULL OR
					NOW() >= us.cycle_started_at + us.reset_interval_seconds * INTERVAL '1 second'
				) THEN NOW()
				ELSE us.cycle_started_at
			END,
				cycle_usage_usd = CASE
				WHEN us.reset_interval_seconds > 0 AND (
					us.cycle_started_at IS NULL OR
					NOW() >= us.cycle_started_at + us.reset_interval_seconds * INTERVAL '1 second'
				) THEN $1
				ELSE us.cycle_usage_usd + $1
				END,
				total_usage_usd = us.total_usage_usd + $1,
				updated_at = NOW()
		WHERE us.id = $2
			AND us.deleted_at IS NULL
	`
	res, err := tx.ExecContext(ctx, updateSQL, costUSD, subscriptionID)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected > 0 {
		return nil
	}
	return service.ErrSubscriptionNotFound
}

func deductUsageBillingBalance(ctx context.Context, tx *sql.Tx, userID int64, amount decimal.Decimal) (decimal.Decimal, bool, error) {
	var newBalance decimal.Decimal
	err := tx.QueryRowContext(ctx, `
		UPDATE users
		SET balance = balance - $1,
			updated_at = NOW()
		WHERE id = $2 AND deleted_at IS NULL AND balance >= $1
		RETURNING balance
	`, amount, userID).Scan(&newBalance)
	if err == nil {
		return newBalance, true, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return decimal.Zero, false, err
	}

	err = tx.QueryRowContext(ctx, `
		UPDATE users
		SET balance = balance - $1,
			updated_at = NOW()
		WHERE id = $2 AND deleted_at IS NULL
		RETURNING balance
	`, amount, userID).Scan(&newBalance)
	if errors.Is(err, sql.ErrNoRows) {
		return decimal.Zero, false, service.ErrUserNotFound
	}
	if err != nil {
		return decimal.Zero, false, err
	}
	return newBalance, false, nil
}

type batchImageBillingReservation struct {
	id             int64
	userID         int64
	groupID        *int64
	subscriptionID *int64
	billingSource  string
	preference     string
	fallbackReason string
	reservedAmount decimal.Decimal
	finalAmount    decimal.Decimal
	status         string
}

func reserveUsageBillingBatchImageFunding(ctx context.Context, tx *sql.Tx, cmd *service.BatchImageBalanceHoldCommand) (*service.BatchImageBalanceHoldResult, error) {
	if !cmd.HoldAmount.IsPositive() {
		return &service.BatchImageBalanceHoldResult{}, nil
	}
	preference, balance, err := lockUsageBillingUser(ctx, tx, cmd.UserID)
	if err != nil {
		return nil, err
	}
	preference = service.NormalizeBillingPreference(preference)
	candidates, err := listSubscriptionBillingCandidates(ctx, tx, cmd.UserID, cmd.GroupID, time.Now().UTC())
	if err != nil {
		return nil, err
	}

	chooseSubscription := func() *subscriptionBillingCandidate {
		for i := range candidates {
			candidate := &candidates[i]
			if candidate.canFund(cmd.HoldAmount) {
				return candidate
			}
		}
		return nil
	}
	result := &service.BatchImageBalanceHoldResult{
		BillingPreference: preference,
		GroupID:           cmd.GroupID,
	}
	useSubscription := func(candidate *subscriptionBillingCandidate, fallbackReason string) error {
		if candidate == nil {
			return service.ErrSubscriptionQuotaExceeded
		}
		if err := reserveSelectedUsageBillingSubscription(ctx, tx, candidate.id, cmd.HoldAmount); err != nil {
			return err
		}
		result.BillingSource = service.BillingSourceSubscription
		result.BillingFallbackReason = fallbackReason
		result.SubscriptionID = &candidate.id
		return nil
	}
	useWallet := func(fallbackReason string) error {
		if balance.LessThan(cmd.HoldAmount) {
			return service.ErrBatchImageInsufficientBalance
		}
		walletResult, err := reserveUsageBillingBatchImageBalance(ctx, tx, cmd)
		if err != nil {
			return err
		}
		result.BillingSource = service.BillingSourceWallet
		result.BillingFallbackReason = fallbackReason
		result.NewBalance = walletResult.NewBalance
		result.FrozenBalance = walletResult.FrozenBalance
		return nil
	}

	switch preference {
	case service.BillingPreferenceWalletOnly:
		err = useWallet("")
	case service.BillingPreferenceWalletFirst:
		if balance.GreaterThanOrEqual(cmd.HoldAmount) {
			err = useWallet("")
		} else if candidate := chooseSubscription(); candidate != nil {
			err = useSubscription(candidate, "wallet_insufficient")
		} else {
			err = service.ErrBatchImageInsufficientBalance
		}
	case service.BillingPreferenceSubscriptionOnly:
		err = useSubscription(chooseSubscription(), "")
	default:
		if candidate := chooseSubscription(); candidate != nil {
			err = useSubscription(candidate, "")
		} else {
			fallbackAllowed := len(candidates) == 0
			for i := range candidates {
				if candidates[i].walletFallbackEnabled {
					fallbackAllowed = true
					break
				}
			}
			if !fallbackAllowed {
				return nil, service.ErrSubscriptionQuotaExceeded
			}
			reason := "subscription_unavailable"
			if len(candidates) > 0 {
				reason = "subscription_quota_exhausted"
			}
			err = useWallet(reason)
		}
	}
	if err != nil {
		return nil, err
	}
	if err := insertPendingBatchImageBillingReservation(ctx, tx, cmd, result); err != nil {
		return nil, err
	}
	return result, nil
}

func reserveSelectedUsageBillingSubscription(ctx context.Context, tx *sql.Tx, subscriptionID int64, amount decimal.Decimal) error {
	res, err := tx.ExecContext(ctx, `
		UPDATE user_subscriptions
			SET cycle_reserved_usd = cycle_reserved_usd + $1,
				total_reserved_usd = total_reserved_usd + $1,
			updated_at = NOW()
		WHERE id = $2
			AND deleted_at IS NULL
			AND (
				cycle_quota_usd IS NULL
				OR cycle_quota_usd <= 0
					OR cycle_usage_usd + cycle_reserved_usd + $1 <= cycle_quota_usd
				)
				AND (
					total_quota_usd IS NULL
					OR total_quota_usd <= 0
					OR total_usage_usd + total_reserved_usd + $1 <= total_quota_usd
				)
	`, amount, subscriptionID)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return service.ErrSubscriptionQuotaExceeded
	}
	return nil
}

func insertPendingBatchImageBillingReservation(ctx context.Context, tx *sql.Tx, cmd *service.BatchImageBalanceHoldCommand, result *service.BatchImageBalanceHoldResult) error {
	_, err := tx.ExecContext(ctx, `
		INSERT INTO billing_reservations (
			request_id, api_key_id, user_id, group_id, subscription_id,
			billing_source, billing_preference, fallback_reason,
			reserved_amount, final_amount, status,
			last_heartbeat_at, lease_expires_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, NULLIF($8, ''), $9, 0, 'pending',
			NOW(), NOW() + INTERVAL '24 hours'
		)
	`,
		cmd.RequestID,
		cmd.APIKeyID,
		cmd.UserID,
		cmd.GroupID,
		result.SubscriptionID,
		result.BillingSource,
		result.BillingPreference,
		result.BillingFallbackReason,
		cmd.HoldAmount,
	)
	return err
}

func captureUsageBillingBatchImageFunding(ctx context.Context, tx *sql.Tx, cmd *service.BatchImageBalanceHoldCommand) (*service.BatchImageBalanceHoldResult, error) {
	reservation, found, err := loadBatchImageBillingReservation(ctx, tx, service.BatchImageHoldRequestID(cmd.BatchID), cmd.APIKeyID)
	if err != nil {
		return nil, err
	}
	if !found {
		result, err := captureUsageBillingBatchImageBalance(ctx, tx, cmd)
		if result != nil {
			result.BillingSource = service.BillingSourceWallet
		}
		return result, err
	}
	result := batchImageReservationResult(reservation, true)
	switch reservation.status {
	case "settled":
		return result, nil
	case "released":
		return nil, service.ErrBatchImageBillingReservationReleased
	case "pending":
		// Continue with the only valid state transition: pending -> settled.
	default:
		return nil, errors.New("batch image billing reservation has invalid status")
	}
	if cmd.ActualAmount.GreaterThan(reservation.reservedAmount) {
		return nil, service.ErrBatchImageSettlementCostExceedsHold
	}
	switch reservation.billingSource {
	case service.BillingSourceSubscription:
		if reservation.subscriptionID == nil {
			return nil, service.ErrSubscriptionNotFound
		}
		if err := captureSelectedUsageBillingSubscription(ctx, tx, *reservation.subscriptionID, reservation.reservedAmount, cmd.ActualAmount); err != nil {
			return nil, err
		}
	case service.BillingSourceWallet:
		walletResult, err := captureUsageBillingBatchImageBalance(ctx, tx, &service.BatchImageBalanceHoldCommand{
			UserID:       reservation.userID,
			HoldAmount:   reservation.reservedAmount,
			ActualAmount: cmd.ActualAmount,
		})
		if err != nil {
			return nil, err
		}
		result.NewBalance = walletResult.NewBalance
		result.FrozenBalance = walletResult.FrozenBalance
	default:
		return nil, errors.New("batch image billing reservation has invalid source")
	}
	if err := settleBatchImageBillingReservation(ctx, tx, reservation.id, cmd.ActualAmount); err != nil {
		return nil, err
	}
	return result, nil
}

func captureSelectedUsageBillingSubscription(ctx context.Context, tx *sql.Tx, subscriptionID int64, reservedAmount, actualAmount decimal.Decimal) error {
	res, err := tx.ExecContext(ctx, `
		UPDATE user_subscriptions
			SET cycle_reserved_usd = cycle_reserved_usd - $1,
				total_reserved_usd = total_reserved_usd - $1,
				cycle_usage_usd = cycle_usage_usd + $2,
				total_usage_usd = total_usage_usd + $2,
			daily_usage_usd = daily_usage_usd + $2,
			weekly_usage_usd = weekly_usage_usd + $2,
			monthly_usage_usd = monthly_usage_usd + $2,
			updated_at = NOW()
			WHERE id = $3
				AND cycle_reserved_usd >= $1
				AND total_reserved_usd >= $1
	`, reservedAmount, actualAmount, subscriptionID)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return errors.New("batch image subscription reservation is insufficient")
	}
	return nil
}

func releaseUsageBillingBatchImageFunding(ctx context.Context, tx *sql.Tx, cmd *service.BatchImageBalanceHoldCommand) (*service.BatchImageBalanceHoldResult, error) {
	reservation, found, err := loadBatchImageBillingReservation(ctx, tx, service.BatchImageHoldRequestID(cmd.BatchID), cmd.APIKeyID)
	if err != nil {
		return nil, err
	}
	if !found {
		result, err := releaseUsageBillingBatchImageBalance(ctx, tx, cmd)
		if result != nil {
			result.BillingSource = service.BillingSourceWallet
		}
		return result, err
	}
	result := batchImageReservationResult(reservation, true)
	switch reservation.status {
	case "settled", "released":
		return result, nil
	case "pending":
		// Continue with the only state transition that releases funds.
	default:
		return nil, errors.New("batch image billing reservation has invalid status")
	}
	switch reservation.billingSource {
	case service.BillingSourceSubscription:
		if reservation.subscriptionID == nil {
			return nil, service.ErrSubscriptionNotFound
		}
		if err := releaseSelectedUsageBillingSubscription(ctx, tx, *reservation.subscriptionID, reservation.reservedAmount); err != nil {
			return nil, err
		}
	case service.BillingSourceWallet:
		walletResult, err := releaseUsageBillingBatchImageBalance(ctx, tx, &service.BatchImageBalanceHoldCommand{
			APIKeyID:   cmd.APIKeyID,
			UserID:     reservation.userID,
			BatchID:    cmd.BatchID,
			HoldAmount: reservation.reservedAmount,
		})
		if err != nil {
			return nil, err
		}
		result.NewBalance = walletResult.NewBalance
		result.FrozenBalance = walletResult.FrozenBalance
	default:
		return nil, errors.New("batch image billing reservation has invalid source")
	}
	if err := releaseBatchImageBillingReservation(ctx, tx, reservation.id); err != nil {
		return nil, err
	}
	return result, nil
}

func releaseSelectedUsageBillingSubscription(ctx context.Context, tx *sql.Tx, subscriptionID int64, reservedAmount decimal.Decimal) error {
	res, err := tx.ExecContext(ctx, `
		UPDATE user_subscriptions
			SET cycle_reserved_usd = cycle_reserved_usd - $1,
				total_reserved_usd = total_reserved_usd - $1,
				updated_at = NOW()
			WHERE id = $2
				AND cycle_reserved_usd >= $1
				AND total_reserved_usd >= $1
	`, reservedAmount, subscriptionID)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return errors.New("batch image subscription reservation is insufficient")
	}
	return nil
}

func loadBatchImageBillingReservation(ctx context.Context, tx *sql.Tx, requestID string, apiKeyID int64) (*batchImageBillingReservation, bool, error) {
	var reservation batchImageBillingReservation
	var groupID, subscriptionID sql.NullInt64
	var fallbackReason sql.NullString
	err := tx.QueryRowContext(ctx, `
		SELECT id, user_id, group_id, subscription_id, billing_source,
			billing_preference, fallback_reason, reserved_amount, final_amount, status
		FROM billing_reservations
		WHERE request_id = $1 AND api_key_id = $2
		FOR UPDATE
	`, requestID, apiKeyID).Scan(
		&reservation.id,
		&reservation.userID,
		&groupID,
		&subscriptionID,
		&reservation.billingSource,
		&reservation.preference,
		&fallbackReason,
		&reservation.reservedAmount,
		&reservation.finalAmount,
		&reservation.status,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, err
	}
	if groupID.Valid {
		value := groupID.Int64
		reservation.groupID = &value
	}
	if subscriptionID.Valid {
		value := subscriptionID.Int64
		reservation.subscriptionID = &value
	}
	if fallbackReason.Valid {
		reservation.fallbackReason = fallbackReason.String
	}
	return &reservation, true, nil
}

func batchImageReservationResult(reservation *batchImageBillingReservation, applied bool) *service.BatchImageBalanceHoldResult {
	if reservation == nil {
		return &service.BatchImageBalanceHoldResult{Applied: applied}
	}
	return &service.BatchImageBalanceHoldResult{
		Applied:               applied,
		BillingSource:         reservation.billingSource,
		BillingPreference:     reservation.preference,
		BillingFallbackReason: reservation.fallbackReason,
		SubscriptionID:        reservation.subscriptionID,
		GroupID:               reservation.groupID,
	}
}

func settleBatchImageBillingReservation(ctx context.Context, tx *sql.Tx, id int64, finalAmount decimal.Decimal) error {
	res, err := tx.ExecContext(ctx, `
		UPDATE billing_reservations
		SET final_amount = $1, status = 'settled', settled_at = NOW(),
			lease_owner = NULL, lease_expires_at = NULL
		WHERE id = $2 AND status = 'pending'
	`, finalAmount, id)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return errors.New("batch image billing reservation is no longer pending")
	}
	return nil
}

func releaseBatchImageBillingReservation(ctx context.Context, tx *sql.Tx, id int64) error {
	res, err := tx.ExecContext(ctx, `
		UPDATE billing_reservations
		SET status = 'released', released_at = NOW(),
			lease_owner = NULL, lease_expires_at = NULL
		WHERE id = $1 AND status = 'pending'
	`, id)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return errors.New("batch image billing reservation is no longer pending")
	}
	return nil
}

func reserveUsageBillingBatchImageBalance(ctx context.Context, tx *sql.Tx, cmd *service.BatchImageBalanceHoldCommand) (*service.BatchImageBalanceHoldResult, error) {
	if !cmd.HoldAmount.IsPositive() {
		return &service.BatchImageBalanceHoldResult{}, nil
	}
	var balance, frozen decimal.Decimal
	err := tx.QueryRowContext(ctx, `
		UPDATE users
		SET balance = balance - $1,
			frozen_balance = COALESCE(frozen_balance, 0) + $1,
			updated_at = NOW()
		WHERE id = $2 AND deleted_at IS NULL AND balance >= $1
		RETURNING balance, frozen_balance
	`, cmd.HoldAmount, cmd.UserID).Scan(&balance, &frozen)
	if err == nil {
		return &service.BatchImageBalanceHoldResult{NewBalance: &balance, FrozenBalance: &frozen}, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	if exists, existsErr := userExistsForBilling(ctx, tx, cmd.UserID); existsErr != nil {
		return nil, existsErr
	} else if !exists {
		return nil, service.ErrUserNotFound
	}
	return nil, service.ErrBatchImageInsufficientBalance
}

func captureUsageBillingBatchImageBalance(ctx context.Context, tx *sql.Tx, cmd *service.BatchImageBalanceHoldCommand) (*service.BatchImageBalanceHoldResult, error) {
	if !cmd.HoldAmount.IsPositive() && !cmd.ActualAmount.IsPositive() {
		return &service.BatchImageBalanceHoldResult{}, nil
	}
	if cmd.ActualAmount.GreaterThan(cmd.HoldAmount) {
		return nil, service.ErrBatchImageSettlementCostExceedsHold
	}
	var balance, frozen decimal.Decimal
	err := tx.QueryRowContext(ctx, `
		UPDATE users
		SET balance = balance
				+ CASE WHEN $1 > $2 THEN $1 - $2 ELSE 0 END
				- CASE WHEN $2 > $1 THEN $2 - $1 ELSE 0 END,
			frozen_balance = COALESCE(frozen_balance, 0) - $1,
			updated_at = NOW()
		WHERE id = $3 AND deleted_at IS NULL AND COALESCE(frozen_balance, 0) >= $1
		RETURNING balance, frozen_balance
	`, cmd.HoldAmount, cmd.ActualAmount, cmd.UserID).Scan(&balance, &frozen)
	if err == nil {
		return &service.BatchImageBalanceHoldResult{NewBalance: &balance, FrozenBalance: &frozen}, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	if exists, existsErr := userExistsForBilling(ctx, tx, cmd.UserID); existsErr != nil {
		return nil, existsErr
	} else if !exists {
		return nil, service.ErrUserNotFound
	}
	return nil, errors.New("batch image frozen balance is insufficient")
}

func releaseUsageBillingBatchImageBalance(ctx context.Context, tx *sql.Tx, cmd *service.BatchImageBalanceHoldCommand) (*service.BatchImageBalanceHoldResult, error) {
	if !cmd.HoldAmount.IsPositive() {
		return &service.BatchImageBalanceHoldResult{}, nil
	}
	// 释放前校验该 job 确实预留过 hold（hold request id 已被 claim），
	// 防止从未成功冻结的 job 触发"幻影释放"，从其他用户的冻结资金池中凭空生成余额。
	held, heldErr := batchImageHoldClaimExists(ctx, tx, service.BatchImageHoldRequestID(cmd.BatchID), cmd.APIKeyID)
	if heldErr != nil {
		return nil, heldErr
	}
	if !held {
		logger.LegacyPrintf("repository.usage_billing", "[BatchImage] release skipped, hold was never reserved: batch=%s", cmd.BatchID)
		return &service.BatchImageBalanceHoldResult{}, nil
	}
	var balance, frozen decimal.Decimal
	err := tx.QueryRowContext(ctx, `
		UPDATE users
		SET balance = balance + $1,
			frozen_balance = COALESCE(frozen_balance, 0) - $1,
			updated_at = NOW()
		WHERE id = $2 AND deleted_at IS NULL AND COALESCE(frozen_balance, 0) >= $1
		RETURNING balance, frozen_balance
	`, cmd.HoldAmount, cmd.UserID).Scan(&balance, &frozen)
	if err == nil {
		return &service.BatchImageBalanceHoldResult{NewBalance: &balance, FrozenBalance: &frozen}, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	if exists, existsErr := userExistsForBilling(ctx, tx, cmd.UserID); existsErr != nil {
		return nil, existsErr
	} else if !exists {
		return nil, service.ErrUserNotFound
	}
	return nil, errors.New("batch image frozen balance is insufficient")
}

// batchImageHoldClaimExists 检查 hold request id 是否已在 dedup（或归档）表中被 claim，
// 即该 batch 的冻结操作确实成功提交过。
func batchImageHoldClaimExists(ctx context.Context, tx *sql.Tx, holdRequestID string, apiKeyID int64) (bool, error) {
	var exists int
	err := tx.QueryRowContext(ctx, `
		SELECT 1
		FROM usage_billing_dedup
		WHERE request_id = $1 AND api_key_id = $2
	`, holdRequestID, apiKeyID).Scan(&exists)
	if err == nil {
		return true, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return false, err
	}
	err = tx.QueryRowContext(ctx, `
		SELECT 1
		FROM usage_billing_dedup_archive
		WHERE request_id = $1 AND api_key_id = $2
	`, holdRequestID, apiKeyID).Scan(&exists)
	if err == nil {
		return true, nil
	}
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	return false, err
}

func userExistsForBilling(ctx context.Context, tx *sql.Tx, userID int64) (bool, error) {
	var exists int
	err := tx.QueryRowContext(ctx, `
		SELECT 1
		FROM users
		WHERE id = $1 AND deleted_at IS NULL
	`, userID).Scan(&exists)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func incrementUsageBillingAPIKeyQuota(ctx context.Context, tx *sql.Tx, apiKeyID int64, amount decimal.Decimal) (bool, error) {
	var exhausted bool
	err := tx.QueryRowContext(ctx, `
		UPDATE api_keys
		SET quota_used = quota_used + $1,
			status = CASE
				WHEN quota > 0
					AND status = $3
					AND quota_used < quota
					AND quota_used + $1 >= quota
				THEN $4
				ELSE status
			END,
			updated_at = NOW()
		WHERE id = $2 AND deleted_at IS NULL
		RETURNING quota > 0 AND quota_used >= quota AND quota_used - $1 < quota
	`, amount, apiKeyID, service.StatusAPIKeyActive, service.StatusAPIKeyQuotaExhausted).Scan(&exhausted)
	if errors.Is(err, sql.ErrNoRows) {
		return false, service.ErrAPIKeyNotFound
	}
	if err != nil {
		return false, err
	}
	return exhausted, nil
}

func incrementUsageBillingAPIKeyRateLimit(ctx context.Context, tx *sql.Tx, apiKeyID int64, cost decimal.Decimal) error {
	res, err := tx.ExecContext(ctx, `
		UPDATE api_keys SET
			usage_5h = CASE WHEN window_5h_start IS NOT NULL AND window_5h_start + INTERVAL '5 hours' <= NOW() THEN $1 ELSE usage_5h + $1 END,
			usage_1d = CASE WHEN window_1d_start IS NOT NULL AND window_1d_start + INTERVAL '24 hours' <= NOW() THEN $1 ELSE usage_1d + $1 END,
			usage_7d = CASE WHEN window_7d_start IS NOT NULL AND window_7d_start + INTERVAL '7 days' <= NOW() THEN $1 ELSE usage_7d + $1 END,
			window_5h_start = CASE WHEN window_5h_start IS NULL OR window_5h_start + INTERVAL '5 hours' <= NOW() THEN NOW() ELSE window_5h_start END,
			window_1d_start = CASE WHEN window_1d_start IS NULL OR window_1d_start + INTERVAL '24 hours' <= NOW() THEN date_trunc('day', NOW()) ELSE window_1d_start END,
			window_7d_start = CASE WHEN window_7d_start IS NULL OR window_7d_start + INTERVAL '7 days' <= NOW() THEN date_trunc('day', NOW()) ELSE window_7d_start END,
			updated_at = NOW()
		WHERE id = $2 AND deleted_at IS NULL
	`, cost, apiKeyID)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return service.ErrAPIKeyNotFound
	}
	return nil
}

func incrementUsageBillingAccountQuota(ctx context.Context, tx *sql.Tx, accountID int64, amount decimal.Decimal) (*service.AccountQuotaState, error) {
	rows, err := tx.QueryContext(ctx,
		`UPDATE accounts SET extra = (
			COALESCE(extra, '{}'::jsonb)
			|| jsonb_build_object('quota_used', COALESCE((extra->>'quota_used')::numeric, 0) + $1)
			|| CASE WHEN COALESCE((extra->>'quota_daily_limit')::numeric, 0) > 0 THEN
				jsonb_build_object(
					'quota_daily_used',
					CASE WHEN `+dailyExpiredExpr+`
					THEN $1
					ELSE COALESCE((extra->>'quota_daily_used')::numeric, 0) + $1 END,
					'quota_daily_start',
					CASE WHEN `+dailyExpiredExpr+`
					THEN `+nowUTC+`
					ELSE COALESCE(extra->>'quota_daily_start', `+nowUTC+`) END
				)
				|| CASE WHEN `+dailyExpiredExpr+` AND `+nextDailyResetAtExpr+` IS NOT NULL
				   THEN jsonb_build_object('quota_daily_reset_at', `+nextDailyResetAtExpr+`)
				   ELSE '{}'::jsonb END
			ELSE '{}'::jsonb END
			|| CASE WHEN COALESCE((extra->>'quota_weekly_limit')::numeric, 0) > 0 THEN
				jsonb_build_object(
					'quota_weekly_used',
					CASE WHEN `+weeklyExpiredExpr+`
					THEN $1
					ELSE COALESCE((extra->>'quota_weekly_used')::numeric, 0) + $1 END,
					'quota_weekly_start',
					CASE WHEN `+weeklyExpiredExpr+`
					THEN `+nowUTC+`
					ELSE COALESCE(extra->>'quota_weekly_start', `+nowUTC+`) END
				)
				|| CASE WHEN `+weeklyExpiredExpr+` AND `+nextWeeklyResetAtExpr+` IS NOT NULL
				   THEN jsonb_build_object('quota_weekly_reset_at', `+nextWeeklyResetAtExpr+`)
				   ELSE '{}'::jsonb END
			ELSE '{}'::jsonb END
		), updated_at = NOW()
		WHERE id = $2 AND deleted_at IS NULL
		RETURNING
			COALESCE((extra->>'quota_used')::numeric, 0),
			COALESCE((extra->>'quota_limit')::numeric, 0),
			COALESCE((extra->>'quota_daily_used')::numeric, 0),
			COALESCE((extra->>'quota_daily_limit')::numeric, 0),
			COALESCE((extra->>'quota_weekly_used')::numeric, 0),
			COALESCE((extra->>'quota_weekly_limit')::numeric, 0)`,
		amount, accountID)
	if err != nil {
		return nil, err
	}

	var totalUsed, totalLimit decimal.Decimal
	var dailyUsed, dailyLimit decimal.Decimal
	var weeklyUsed, weeklyLimit decimal.Decimal
	if rows.Next() {
		if err := rows.Scan(
			&totalUsed, &totalLimit,
			&dailyUsed, &dailyLimit,
			&weeklyUsed, &weeklyLimit,
		); err != nil {
			_ = rows.Close()
			return nil, err
		}
	} else {
		if err := rows.Err(); err != nil {
			_ = rows.Close()
			return nil, err
		}
		_ = rows.Close()
		return nil, service.ErrAccountNotFound
	}
	if err := rows.Err(); err != nil {
		_ = rows.Close()
		return nil, err
	}
	// 必须在执行下一条 SQL 前显式关闭 rows：pq 驱动在同一连接上
	// 不允许前一条查询的结果集未耗尽时启动新查询，否则会返回
	// "unexpected Parse response" 错误。
	if err := rows.Close(); err != nil {
		return nil, err
	}
	// 任意维度额度在本次递增中从"未超"跨越到"已超"时，必须刷新调度快照，
	// 否则 Redis 中缓存的 Account 仍显示旧的 used 值，后续请求会继续选中本账号，
	// 最终观察到 daily_used / weekly_used 大幅超过配置的 limit。
	// 对于日/周额度，即使本次触发了周期重置（pre=0、post=amount），
	// 判定式 (post-amount) < limit 同样成立，逻辑与总额度保持一致。
	crossedTotal := totalLimit.IsPositive() && totalUsed.GreaterThanOrEqual(totalLimit) && totalUsed.Sub(amount).LessThan(totalLimit)
	crossedDaily := dailyLimit.IsPositive() && dailyUsed.GreaterThanOrEqual(dailyLimit) && dailyUsed.Sub(amount).LessThan(dailyLimit)
	crossedWeekly := weeklyLimit.IsPositive() && weeklyUsed.GreaterThanOrEqual(weeklyLimit) && weeklyUsed.Sub(amount).LessThan(weeklyLimit)
	if crossedTotal || crossedDaily || crossedWeekly {
		if err := enqueueSchedulerOutbox(ctx, tx, service.SchedulerOutboxEventAccountChanged, &accountID, nil, nil); err != nil {
			logger.LegacyPrintf("repository.usage_billing", "[SchedulerOutbox] enqueue quota exceeded failed: account=%d err=%v", accountID, err)
			return nil, err
		}
	}
	return &service.AccountQuotaState{
		TotalUsed:   totalUsed.InexactFloat64(),
		TotalLimit:  totalLimit.InexactFloat64(),
		DailyUsed:   dailyUsed.InexactFloat64(),
		DailyLimit:  dailyLimit.InexactFloat64(),
		WeeklyUsed:  weeklyUsed.InexactFloat64(),
		WeeklyLimit: weeklyLimit.InexactFloat64(),
	}, nil
}
