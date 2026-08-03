package repository

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/shopspring/decimal"
)

const (
	usageBillingReservationPending             = "pending"
	usageBillingReservationSettled             = "settled"
	usageBillingReservationReleased            = "released"
	defaultUsageBillingReservationLeaseSeconds = 900
)

type usageBillingReservation struct {
	id                 int64
	requestFingerprint string
	requestPayloadHash string
	userID             int64
	groupID            *int64
	subscriptionID     *int64
	billingSource      string
	preference         string
	fallbackReason     string
	reservedAmount     decimal.Decimal
	finalAmount        decimal.Decimal
	status             string
	leaseOwner         string
}

func (r *usageBillingRepository) ReserveRequestBilling(ctx context.Context, cmd *service.UsageBillingReservationCommand) (_ *service.UsageBillingReservationResult, err error) {
	if cmd == nil {
		return &service.UsageBillingReservationResult{}, nil
	}
	if r == nil || r.db == nil {
		return nil, errors.New("usage billing repository db is nil")
	}
	cmd.Normalize()
	if cmd.RequestID == "" {
		return nil, service.ErrUsageBillingRequestIDRequired
	}
	if !cmd.EstimatedAmount.IsPositive() {
		return &service.UsageBillingReservationResult{}, nil
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

	existing, found, err := loadUsageBillingReservation(ctx, tx, cmd.RequestID, cmd.APIKeyID)
	if err != nil {
		return nil, err
	}
	if found {
		if err := validateUsageBillingReservationCommand(existing, cmd); err != nil {
			return nil, err
		}
		if existing.status == usageBillingReservationPending {
			owner, err := refreshUsageBillingReservationLease(ctx, tx, existing.id, existing.leaseOwner, cmd.LeaseOwner, cmd.LeaseDurationSecs)
			if err != nil {
				return nil, err
			}
			existing.leaseOwner = owner
		}
		if err := tx.Commit(); err != nil {
			return nil, err
		}
		tx = nil
		return usageBillingReservationResult(existing, false), nil
	}

	preference, balance, err := lockUsageBillingUser(ctx, tx, cmd.UserID)
	if err != nil {
		return nil, err
	}
	result, err := reserveUsageBillingFunding(ctx, tx, cmd.UserID, cmd.GroupID, cmd.EstimatedAmount, preference, balance)
	if err != nil {
		return nil, err
	}
	result.Applied = true
	result.Status = usageBillingReservationPending
	result.LeaseOwner = strings.TrimSpace(cmd.LeaseOwner)
	if err := insertPendingUsageBillingReservation(ctx, tx, cmd, result); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	tx = nil
	return result, nil
}

func reserveUsageBillingFunding(
	ctx context.Context,
	tx *sql.Tx,
	userID int64,
	groupID *int64,
	amount decimal.Decimal,
	preference string,
	balance decimal.Decimal,
) (*service.UsageBillingReservationResult, error) {
	preference = service.NormalizeBillingPreference(preference)
	candidates, err := listSubscriptionBillingCandidates(ctx, tx, userID, groupID, time.Now().UTC())
	if err != nil {
		return nil, err
	}
	result := &service.UsageBillingReservationResult{
		BillingPreference: preference,
		GroupID:           cloneRepositoryOptionalInt64(groupID),
		ReservedAmount:    amount,
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
		if err := reserveSelectedUsageBillingSubscription(ctx, tx, candidate.id, amount); err != nil {
			return err
		}
		result.BillingSource = service.BillingSourceSubscription
		result.BillingFallbackReason = fallbackReason
		result.SubscriptionID = &candidate.id
		return nil
	}
	useWallet := func(fallbackReason string) error {
		if balance.LessThan(amount) {
			return service.ErrInsufficientBalance
		}
		newBalance, frozenBalance, err := reserveUsageBillingRequestBalance(ctx, tx, userID, amount)
		if err != nil {
			return err
		}
		result.BillingSource = service.BillingSourceWallet
		result.BillingFallbackReason = fallbackReason
		result.NewBalance = &newBalance
		result.FrozenBalance = &frozenBalance
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
			err = service.ErrInsufficientBalance
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
	return result, nil
}

func (r *usageBillingRepository) RebindRequestBilling(ctx context.Context, cmd *service.UsageBillingReservationRebindCommand) (_ *service.UsageBillingReservationResult, err error) {
	if cmd == nil {
		return &service.UsageBillingReservationResult{}, nil
	}
	if r == nil || r.db == nil {
		return nil, errors.New("usage billing repository db is nil")
	}
	cmd.Normalize()
	if cmd.RequestID == "" {
		return nil, service.ErrUsageBillingRequestIDRequired
	}
	if !cmd.EstimatedAmount.IsPositive() {
		return nil, service.ErrUsageBillingReservationInvalidState
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

	reservation, found, err := loadUsageBillingReservation(ctx, tx, cmd.RequestID, cmd.APIKeyID)
	if err != nil {
		return nil, err
	}
	if !found {
		return nil, service.ErrUsageBillingReservationNotFound
	}
	if reservation.userID != cmd.UserID || validateUsageBillingPayloadHash(reservation.requestPayloadHash, cmd.RequestPayloadHash) != nil {
		return nil, service.ErrUsageBillingRequestConflict
	}
	if reservation.status != usageBillingReservationPending {
		return nil, service.ErrUsageBillingReservationInvalidState
	}
	if reservation.leaseOwner != "" && cmd.LeaseOwner != "" && reservation.leaseOwner != cmd.LeaseOwner {
		return nil, service.ErrUsageBillingRequestConflict
	}
	if sameOptionalInt64(reservation.groupID, cmd.GroupID) {
		if strings.TrimSpace(reservation.requestFingerprint) != strings.TrimSpace(cmd.RequestFingerprint) {
			return nil, service.ErrUsageBillingRequestConflict
		}
		owner, err := refreshUsageBillingReservationLease(ctx, tx, reservation.id, reservation.leaseOwner, cmd.LeaseOwner, cmd.LeaseDurationSecs)
		if err != nil {
			return nil, err
		}
		reservation.leaseOwner = owner
		if err := tx.Commit(); err != nil {
			return nil, err
		}
		tx = nil
		return usageBillingReservationResult(reservation, false), nil
	}
	if !sameOptionalInt64(reservation.groupID, cmd.ExpectedGroupID) {
		return nil, service.ErrUsageBillingRequestConflict
	}

	preference, balance, err := lockUsageBillingUser(ctx, tx, cmd.UserID)
	if err != nil {
		return nil, err
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
		newBalance, _, err := releaseUsageBillingRequestBalance(ctx, tx, reservation.userID, reservation.reservedAmount)
		if err != nil {
			return nil, err
		}
		balance = newBalance
	default:
		return nil, service.ErrUsageBillingReservationInvalidState
	}

	result, err := reserveUsageBillingFunding(ctx, tx, cmd.UserID, cmd.GroupID, cmd.EstimatedAmount, preference, balance)
	if err != nil {
		return nil, err
	}
	result.Applied = true
	result.Status = usageBillingReservationPending
	result.LeaseOwner = strings.TrimSpace(cmd.LeaseOwner)
	if result.LeaseOwner == "" {
		result.LeaseOwner = reservation.leaseOwner
	}
	if err := updateReboundUsageBillingReservation(ctx, tx, reservation.id, cmd, result); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	tx = nil
	return result, nil
}

func (r *usageBillingRepository) ReleaseRequestBilling(ctx context.Context, cmd *service.UsageBillingReservationReleaseCommand) (_ *service.UsageBillingReservationResult, err error) {
	if cmd == nil {
		return &service.UsageBillingReservationResult{}, nil
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

	reservation, found, err := loadUsageBillingReservation(ctx, tx, cmd.RequestID, cmd.APIKeyID)
	if err != nil {
		return nil, err
	}
	if !found {
		if err := tx.Commit(); err != nil {
			return nil, err
		}
		tx = nil
		return &service.UsageBillingReservationResult{}, nil
	}
	if err := validateUsageBillingReservationRelease(reservation, cmd); err != nil {
		return nil, err
	}
	result := usageBillingReservationResult(reservation, false)
	switch reservation.status {
	case usageBillingReservationSettled, usageBillingReservationReleased:
		// Both terminal states are idempotent release no-ops.
	case usageBillingReservationPending:
		switch reservation.billingSource {
		case service.BillingSourceSubscription:
			if reservation.subscriptionID == nil {
				return nil, service.ErrSubscriptionNotFound
			}
			if err := releaseSelectedUsageBillingSubscription(ctx, tx, *reservation.subscriptionID, reservation.reservedAmount); err != nil {
				return nil, err
			}
		case service.BillingSourceWallet:
			newBalance, frozenBalance, err := releaseUsageBillingRequestBalance(ctx, tx, reservation.userID, reservation.reservedAmount)
			if err != nil {
				return nil, err
			}
			result.NewBalance = &newBalance
			result.FrozenBalance = &frozenBalance
		default:
			return nil, service.ErrUsageBillingReservationInvalidState
		}
		if err := markUsageBillingReservationReleased(ctx, tx, reservation.id); err != nil {
			return nil, err
		}
		result.Applied = true
		result.Status = usageBillingReservationReleased
	default:
		return nil, service.ErrUsageBillingReservationInvalidState
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	tx = nil
	return result, nil
}

func (r *usageBillingRepository) HeartbeatRequestBilling(ctx context.Context, cmd *service.UsageBillingReservationHeartbeatCommand) (bool, error) {
	if cmd == nil {
		return false, nil
	}
	if r == nil || r.db == nil {
		return false, errors.New("usage billing repository db is nil")
	}
	cmd.Normalize()
	if cmd.RequestID == "" || cmd.LeaseOwner == "" {
		return false, service.ErrUsageBillingRequestConflict
	}
	result, err := r.db.ExecContext(ctx, `
		UPDATE billing_reservations
		SET last_heartbeat_at = NOW(),
			lease_expires_at = NOW() + ($1 * INTERVAL '1 second')
		WHERE request_id = $2
			AND api_key_id = $3
			AND status = 'pending'
			AND lease_owner = $4
	`, usageBillingReservationLeaseSeconds(cmd.LeaseDurationSecs), cmd.RequestID, cmd.APIKeyID, cmd.LeaseOwner)
	if err != nil {
		return false, err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return false, err
	}
	return affected > 0, nil
}

func (r *usageBillingRepository) ReleaseExpiredRequestBilling(ctx context.Context, batchSize int) (_ int, err error) {
	if r == nil || r.db == nil {
		return 0, errors.New("usage billing repository db is nil")
	}
	if batchSize <= 0 {
		batchSize = 100
	}
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer func() {
		if tx != nil {
			_ = tx.Rollback()
		}
	}()

	rows, err := tx.QueryContext(ctx, `
		SELECT id, user_id, subscription_id, billing_source, reserved_amount
		FROM billing_reservations
		WHERE status = 'pending'
			AND lease_expires_at IS NOT NULL
			AND lease_expires_at <= NOW()
		ORDER BY lease_expires_at ASC, id ASC
		FOR UPDATE SKIP LOCKED
		LIMIT $1
	`, batchSize)
	if err != nil {
		return 0, err
	}
	type expiredReservation struct {
		id             int64
		userID         int64
		subscriptionID *int64
		billingSource  string
		reservedAmount decimal.Decimal
	}
	reservations := make([]expiredReservation, 0, batchSize)
	for rows.Next() {
		var reservation expiredReservation
		var subscriptionID sql.NullInt64
		if err := rows.Scan(&reservation.id, &reservation.userID, &subscriptionID, &reservation.billingSource, &reservation.reservedAmount); err != nil {
			_ = rows.Close()
			return 0, err
		}
		if subscriptionID.Valid {
			value := subscriptionID.Int64
			reservation.subscriptionID = &value
		}
		reservations = append(reservations, reservation)
	}
	if err := rows.Err(); err != nil {
		_ = rows.Close()
		return 0, err
	}
	if err := rows.Close(); err != nil {
		return 0, err
	}

	for i := range reservations {
		reservation := &reservations[i]
		switch reservation.billingSource {
		case service.BillingSourceSubscription:
			if reservation.subscriptionID == nil {
				return 0, service.ErrSubscriptionNotFound
			}
			if err := releaseSelectedUsageBillingSubscription(ctx, tx, *reservation.subscriptionID, reservation.reservedAmount); err != nil {
				return 0, err
			}
		case service.BillingSourceWallet:
			if _, _, err := releaseUsageBillingRequestBalance(ctx, tx, reservation.userID, reservation.reservedAmount); err != nil {
				return 0, err
			}
		default:
			return 0, service.ErrUsageBillingReservationInvalidState
		}
		if err := markUsageBillingReservationReleased(ctx, tx, reservation.id); err != nil {
			return 0, err
		}
	}
	if err := tx.Commit(); err != nil {
		return 0, err
	}
	tx = nil
	return len(reservations), nil
}

func settlePendingUsageBillingReservation(ctx context.Context, tx *sql.Tx, cmd *service.UsageBillingCommand, result *service.UsageBillingApplyResult) (bool, error) {
	reservation, found, err := loadUsageBillingReservation(ctx, tx, cmd.RequestID, cmd.APIKeyID)
	if err != nil || !found {
		return found, err
	}
	if err := validateUsageBillingSettlement(reservation, cmd); err != nil {
		return true, err
	}
	if reservation.status == usageBillingReservationReleased {
		return true, service.ErrUsageBillingReservationReleased
	}
	if reservation.status != usageBillingReservationPending {
		return true, service.ErrUsageBillingReservationInvalidState
	}

	amount := cmd.BillableCost.Round(service.BillingAmountScale)
	if amount.IsNegative() {
		amount = decimal.Zero
	}
	result.BillingSource = reservation.billingSource
	result.BillingPreference = reservation.preference
	result.BillingFallbackReason = reservation.fallbackReason
	result.SubscriptionID = reservation.subscriptionID

	switch reservation.billingSource {
	case service.BillingSourceSubscription:
		if reservation.subscriptionID == nil {
			return true, service.ErrSubscriptionNotFound
		}
		if err := settleSelectedUsageBillingSubscription(ctx, tx, *reservation.subscriptionID, reservation.reservedAmount, amount); err != nil {
			return true, err
		}
	case service.BillingSourceWallet:
		newBalance, frozenBalance, err := settleUsageBillingRequestBalance(ctx, tx, reservation.userID, reservation.reservedAmount, amount)
		if err != nil {
			return true, err
		}
		result.NewBalance = &newBalance
		result.BalanceOverdrafted = newBalance.IsNegative()
		_ = frozenBalance
	default:
		return true, service.ErrUsageBillingReservationInvalidState
	}
	if err := markUsageBillingReservationSettled(ctx, tx, reservation.id, amount); err != nil {
		return true, err
	}
	return true, nil
}

func loadUsageBillingReservation(ctx context.Context, tx *sql.Tx, requestID string, apiKeyID int64) (*usageBillingReservation, bool, error) {
	var reservation usageBillingReservation
	var groupID, subscriptionID sql.NullInt64
	var fallbackReason, leaseOwner sql.NullString
	err := tx.QueryRowContext(ctx, `
		SELECT id, request_fingerprint, request_payload_hash, user_id, group_id,
			subscription_id, billing_source, billing_preference, fallback_reason,
			reserved_amount, final_amount, status, lease_owner
		FROM billing_reservations
		WHERE request_id = $1 AND api_key_id = $2
		FOR UPDATE
	`, requestID, apiKeyID).Scan(
		&reservation.id,
		&reservation.requestFingerprint,
		&reservation.requestPayloadHash,
		&reservation.userID,
		&groupID,
		&subscriptionID,
		&reservation.billingSource,
		&reservation.preference,
		&fallbackReason,
		&reservation.reservedAmount,
		&reservation.finalAmount,
		&reservation.status,
		&leaseOwner,
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
	if leaseOwner.Valid {
		reservation.leaseOwner = leaseOwner.String
	}
	return &reservation, true, nil
}

func validateUsageBillingReservationCommand(reservation *usageBillingReservation, cmd *service.UsageBillingReservationCommand) error {
	if reservation == nil || cmd == nil || reservation.userID != cmd.UserID || !sameOptionalInt64(reservation.groupID, cmd.GroupID) {
		return service.ErrUsageBillingRequestConflict
	}
	if strings.TrimSpace(reservation.requestFingerprint) != strings.TrimSpace(cmd.RequestFingerprint) {
		return service.ErrUsageBillingRequestConflict
	}
	return nil
}

func validateUsageBillingReservationRelease(reservation *usageBillingReservation, cmd *service.UsageBillingReservationReleaseCommand) error {
	if reservation == nil || cmd == nil || (cmd.UserID > 0 && reservation.userID != cmd.UserID) {
		return service.ErrUsageBillingRequestConflict
	}
	return validateUsageBillingPayloadHash(reservation.requestPayloadHash, cmd.RequestPayloadHash)
}

func validateUsageBillingSettlement(reservation *usageBillingReservation, cmd *service.UsageBillingCommand) error {
	if reservation == nil || cmd == nil || reservation.userID != cmd.UserID || !sameOptionalInt64(reservation.groupID, cmd.GroupID) {
		return service.ErrUsageBillingRequestConflict
	}
	return validateUsageBillingPayloadHash(reservation.requestPayloadHash, cmd.RequestPayloadHash)
}

func validateUsageBillingPayloadHash(stored, provided string) error {
	stored = strings.TrimSpace(stored)
	provided = strings.TrimSpace(provided)
	if stored != "" && provided != "" && stored != provided {
		return service.ErrUsageBillingRequestConflict
	}
	return nil
}

func sameOptionalInt64(left, right *int64) bool {
	if left == nil || right == nil {
		return left == nil && right == nil
	}
	return *left == *right
}

func usageBillingReservationResult(reservation *usageBillingReservation, applied bool) *service.UsageBillingReservationResult {
	if reservation == nil {
		return &service.UsageBillingReservationResult{Applied: applied}
	}
	return &service.UsageBillingReservationResult{
		Applied:               applied,
		Status:                reservation.status,
		BillingSource:         reservation.billingSource,
		BillingPreference:     reservation.preference,
		BillingFallbackReason: reservation.fallbackReason,
		SubscriptionID:        reservation.subscriptionID,
		GroupID:               reservation.groupID,
		ReservedAmount:        reservation.reservedAmount,
		FinalAmount:           reservation.finalAmount,
		LeaseOwner:            reservation.leaseOwner,
	}
}

func updateReboundUsageBillingReservation(
	ctx context.Context,
	tx *sql.Tx,
	id int64,
	cmd *service.UsageBillingReservationRebindCommand,
	result *service.UsageBillingReservationResult,
) error {
	updateResult, err := tx.ExecContext(ctx, `
		UPDATE billing_reservations
		SET request_fingerprint = $1,
			request_payload_hash = $2,
			group_id = $3,
			subscription_id = $4,
			billing_source = $5,
			billing_preference = $6,
			fallback_reason = NULLIF($7, ''),
			reserved_amount = $8,
			lease_owner = COALESCE(NULLIF($9, ''), lease_owner),
			last_heartbeat_at = NOW(),
			lease_expires_at = NOW() + ($10 * INTERVAL '1 second')
		WHERE id = $11 AND status = 'pending'
	`,
		cmd.RequestFingerprint,
		cmd.RequestPayloadHash,
		cmd.GroupID,
		result.SubscriptionID,
		result.BillingSource,
		result.BillingPreference,
		result.BillingFallbackReason,
		cmd.EstimatedAmount,
		result.LeaseOwner,
		usageBillingReservationLeaseSeconds(cmd.LeaseDurationSecs),
		id,
	)
	if err != nil {
		return err
	}
	affected, err := updateResult.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return service.ErrUsageBillingReservationInvalidState
	}
	return nil
}

func refreshUsageBillingReservationLease(
	ctx context.Context,
	tx *sql.Tx,
	id int64,
	storedOwner string,
	requestedOwner string,
	leaseDurationSeconds int,
) (string, error) {
	storedOwner = strings.TrimSpace(storedOwner)
	requestedOwner = strings.TrimSpace(requestedOwner)
	if storedOwner != "" && requestedOwner != "" && storedOwner != requestedOwner {
		return "", service.ErrUsageBillingRequestConflict
	}
	owner := storedOwner
	if owner == "" {
		owner = requestedOwner
	}
	result, err := tx.ExecContext(ctx, `
		UPDATE billing_reservations
		SET lease_owner = NULLIF($1, ''),
			last_heartbeat_at = NOW(),
			lease_expires_at = NOW() + ($2 * INTERVAL '1 second')
		WHERE id = $3 AND status = 'pending'
	`, owner, usageBillingReservationLeaseSeconds(leaseDurationSeconds), id)
	if err != nil {
		return "", err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return "", err
	}
	if affected == 0 {
		return "", service.ErrUsageBillingReservationInvalidState
	}
	return owner, nil
}

func usageBillingReservationLeaseSeconds(value int) int {
	if value <= 0 {
		return defaultUsageBillingReservationLeaseSeconds
	}
	return value
}

func cloneRepositoryOptionalInt64(value *int64) *int64 {
	if value == nil {
		return nil
	}
	copyValue := *value
	return &copyValue
}

func insertPendingUsageBillingReservation(ctx context.Context, tx *sql.Tx, cmd *service.UsageBillingReservationCommand, result *service.UsageBillingReservationResult) error {
	_, err := tx.ExecContext(ctx, `
		INSERT INTO billing_reservations (
			request_id, api_key_id, request_fingerprint, request_payload_hash,
			user_id, group_id, subscription_id, billing_source,
			billing_preference, fallback_reason, reserved_amount, final_amount, status,
			lease_owner, last_heartbeat_at, lease_expires_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, NULLIF($10, ''), $11, 0, 'pending',
			NULLIF($12, ''), NOW(), NOW() + ($13 * INTERVAL '1 second')
		)
	`,
		cmd.RequestID,
		cmd.APIKeyID,
		cmd.RequestFingerprint,
		cmd.RequestPayloadHash,
		cmd.UserID,
		cmd.GroupID,
		result.SubscriptionID,
		result.BillingSource,
		result.BillingPreference,
		result.BillingFallbackReason,
		cmd.EstimatedAmount,
		cmd.LeaseOwner,
		usageBillingReservationLeaseSeconds(cmd.LeaseDurationSecs),
	)
	return err
}

func settleSelectedUsageBillingSubscription(ctx context.Context, tx *sql.Tx, subscriptionID int64, reservedAmount, actualAmount decimal.Decimal) error {
	// Admission is quota-gated when the reservation is created. Once the
	// upstream request succeeds, always record its actual cost even when the
	// estimate was low; otherwise a failed settlement could later release the
	// reservation and turn a successful request into an unbilled request.
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
			AND deleted_at IS NULL
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
		return service.ErrSubscriptionQuotaExceeded
	}
	return nil
}

func reserveUsageBillingRequestBalance(ctx context.Context, tx *sql.Tx, userID int64, amount decimal.Decimal) (decimal.Decimal, decimal.Decimal, error) {
	var balance, frozen decimal.Decimal
	err := tx.QueryRowContext(ctx, `
		UPDATE users
		SET balance = balance - $1,
			frozen_balance = COALESCE(frozen_balance, 0) + $1,
			updated_at = NOW()
		WHERE id = $2 AND deleted_at IS NULL AND balance >= $1
		RETURNING balance, frozen_balance
	`, amount, userID).Scan(&balance, &frozen)
	if err == nil {
		return balance, frozen, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return decimal.Zero, decimal.Zero, err
	}
	if exists, existsErr := userExistsForBilling(ctx, tx, userID); existsErr != nil {
		return decimal.Zero, decimal.Zero, existsErr
	} else if !exists {
		return decimal.Zero, decimal.Zero, service.ErrUserNotFound
	}
	return decimal.Zero, decimal.Zero, service.ErrInsufficientBalance
}

func settleUsageBillingRequestBalance(ctx context.Context, tx *sql.Tx, userID int64, reservedAmount, actualAmount decimal.Decimal) (decimal.Decimal, decimal.Decimal, error) {
	// Balance sufficiency is enforced before the request starts. Settlement may
	// legitimately exceed the estimate, so preserve the existing debt-recording
	// semantics and let the post-settlement balance become negative.
	var balance, frozen decimal.Decimal
	err := tx.QueryRowContext(ctx, `
		UPDATE users
		SET balance = balance + $1 - $2,
			frozen_balance = COALESCE(frozen_balance, 0) - $1,
			updated_at = NOW()
		WHERE id = $3
			AND deleted_at IS NULL
			AND COALESCE(frozen_balance, 0) >= $1
		RETURNING balance, frozen_balance
	`, reservedAmount, actualAmount, userID).Scan(&balance, &frozen)
	if err == nil {
		return balance, frozen, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return decimal.Zero, decimal.Zero, err
	}
	if exists, existsErr := userExistsForBilling(ctx, tx, userID); existsErr != nil {
		return decimal.Zero, decimal.Zero, existsErr
	} else if !exists {
		return decimal.Zero, decimal.Zero, service.ErrUserNotFound
	}
	return decimal.Zero, decimal.Zero, service.ErrInsufficientBalance
}

func releaseUsageBillingRequestBalance(ctx context.Context, tx *sql.Tx, userID int64, reservedAmount decimal.Decimal) (decimal.Decimal, decimal.Decimal, error) {
	var balance, frozen decimal.Decimal
	err := tx.QueryRowContext(ctx, `
		UPDATE users
		SET balance = balance + $1,
			frozen_balance = COALESCE(frozen_balance, 0) - $1,
			updated_at = NOW()
		WHERE id = $2 AND deleted_at IS NULL AND COALESCE(frozen_balance, 0) >= $1
		RETURNING balance, frozen_balance
	`, reservedAmount, userID).Scan(&balance, &frozen)
	if err == nil {
		return balance, frozen, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return decimal.Zero, decimal.Zero, err
	}
	if exists, existsErr := userExistsForBilling(ctx, tx, userID); existsErr != nil {
		return decimal.Zero, decimal.Zero, existsErr
	} else if !exists {
		return decimal.Zero, decimal.Zero, service.ErrUserNotFound
	}
	return decimal.Zero, decimal.Zero, errors.New("usage billing frozen balance is insufficient")
}

func markUsageBillingReservationSettled(ctx context.Context, tx *sql.Tx, id int64, finalAmount decimal.Decimal) error {
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
		return service.ErrUsageBillingReservationInvalidState
	}
	return nil
}

func markUsageBillingReservationReleased(ctx context.Context, tx *sql.Tx, id int64) error {
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
		return service.ErrUsageBillingReservationInvalidState
	}
	return nil
}
