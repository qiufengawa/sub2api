//go:build unit

package repository

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/require"

	"github.com/Wei-Shaw/sub2api/internal/service"
)

const (
	conditionalBalanceDeductSQL = `(?s)UPDATE users\s+SET balance = balance - \$1,\s+updated_at = NOW\(\)\s+WHERE id = \$2 AND deleted_at IS NULL AND balance >= \$1\s+RETURNING balance`
	overdraftBalanceDeductSQL   = `(?s)UPDATE users\s+SET balance = balance - \$1,\s+updated_at = NOW\(\)\s+WHERE id = \$2 AND deleted_at IS NULL\s+RETURNING balance`
	reserveBatchImageHoldSQL    = `(?s)UPDATE users\s+SET balance = balance - \$1,\s+frozen_balance = COALESCE\(frozen_balance, 0\) \+ \$1,\s+updated_at = NOW\(\)\s+WHERE id = \$2 AND deleted_at IS NULL AND balance >= \$1\s+RETURNING balance, frozen_balance`
	captureBatchImageHoldSQL    = `(?s)UPDATE users\s+SET balance = balance\s+\+ CASE WHEN \$1 > \$2 THEN \$1 - \$2 ELSE 0 END\s+- CASE WHEN \$2 > \$1 THEN \$2 - \$1 ELSE 0 END,\s+frozen_balance = COALESCE\(frozen_balance, 0\) - \$1,\s+updated_at = NOW\(\)\s+WHERE id = \$3 AND deleted_at IS NULL AND COALESCE\(frozen_balance, 0\) >= \$1\s+RETURNING balance, frozen_balance`
	releaseBatchImageHoldSQL    = `(?s)UPDATE users\s+SET balance = balance \+ \$1,\s+frozen_balance = COALESCE\(frozen_balance, 0\) - \$1,\s+updated_at = NOW\(\)\s+WHERE id = \$2 AND deleted_at IS NULL AND COALESCE\(frozen_balance, 0\) >= \$1\s+RETURNING balance, frozen_balance`
	userExistsForBillingSQL     = `(?s)SELECT 1\s+FROM users\s+WHERE id = \$1 AND deleted_at IS NULL`
)

func TestDeductUsageBillingBalance_UsesSufficientBalanceGuard(t *testing.T) {
	ctx := context.Background()
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer func() { _ = db.Close() }()

	mock.ExpectBegin()
	tx, err := db.BeginTx(ctx, nil)
	require.NoError(t, err)
	mock.ExpectQuery(conditionalBalanceDeductSQL).
		WithArgs(service.BillingAmountFromFloat(2.5), int64(42)).
		WillReturnRows(sqlmock.NewRows([]string{"balance"}).AddRow(7.5))
	mock.ExpectCommit()

	newBalance, sufficient, err := deductUsageBillingBalance(ctx, tx, 42, service.BillingAmountFromFloat(2.5))
	require.NoError(t, err)
	require.True(t, sufficient)
	require.True(t, newBalance.Equal(service.BillingAmountFromFloat(7.5)))
	require.NoError(t, tx.Commit())
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestDeductUsageBillingBalance_RecordsOverdraftWhenGuardMisses(t *testing.T) {
	ctx := context.Background()
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer func() { _ = db.Close() }()

	mock.ExpectBegin()
	tx, err := db.BeginTx(ctx, nil)
	require.NoError(t, err)
	mock.ExpectQuery(conditionalBalanceDeductSQL).
		WithArgs(service.BillingAmountFromFloat(10), int64(42)).
		WillReturnError(sql.ErrNoRows)
	mock.ExpectQuery(overdraftBalanceDeductSQL).
		WithArgs(service.BillingAmountFromFloat(10), int64(42)).
		WillReturnRows(sqlmock.NewRows([]string{"balance"}).AddRow(-5.0))
	mock.ExpectCommit()

	newBalance, sufficient, err := deductUsageBillingBalance(ctx, tx, 42, service.BillingAmountFromFloat(10))
	require.NoError(t, err)
	require.False(t, sufficient)
	require.True(t, newBalance.Equal(service.BillingAmountFromFloat(-5)))
	require.NoError(t, tx.Commit())
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestApplyUsageBillingEffects_FlagsBalanceOverdraft(t *testing.T) {
	ctx := context.Background()
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer func() { _ = db.Close() }()

	mock.ExpectBegin()
	tx, err := db.BeginTx(ctx, nil)
	require.NoError(t, err)
	mock.ExpectQuery(conditionalBalanceDeductSQL).
		WithArgs(service.BillingAmountFromFloat(10), int64(42)).
		WillReturnError(sql.ErrNoRows)
	mock.ExpectQuery(overdraftBalanceDeductSQL).
		WithArgs(service.BillingAmountFromFloat(10), int64(42)).
		WillReturnRows(sqlmock.NewRows([]string{"balance"}).AddRow(-5.0))
	mock.ExpectCommit()

	result := &service.UsageBillingApplyResult{Applied: true}
	err = (&usageBillingRepository{}).applyUsageBillingEffects(ctx, tx, &service.UsageBillingCommand{
		UserID:      42,
		BalanceCost: service.BillingAmountFromFloat(10),
	}, result)
	require.NoError(t, err)
	require.NotNil(t, result.NewBalance)
	require.True(t, result.NewBalance.Equal(service.BillingAmountFromFloat(-5)))
	require.True(t, result.BalanceOverdrafted)
	require.NoError(t, tx.Commit())
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestDeductUsageBillingBalance_ReturnsUserNotFoundWhenNoUserUpdated(t *testing.T) {
	ctx := context.Background()
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer func() { _ = db.Close() }()

	mock.ExpectBegin()
	tx, err := db.BeginTx(ctx, nil)
	require.NoError(t, err)
	mock.ExpectQuery(conditionalBalanceDeductSQL).
		WithArgs(service.BillingAmountFromFloat(10), int64(42)).
		WillReturnError(sql.ErrNoRows)
	mock.ExpectQuery(overdraftBalanceDeductSQL).
		WithArgs(service.BillingAmountFromFloat(10), int64(42)).
		WillReturnError(sql.ErrNoRows)
	mock.ExpectRollback()

	_, _, err = deductUsageBillingBalance(ctx, tx, 42, service.BillingAmountFromFloat(10))
	require.ErrorIs(t, err, service.ErrUserNotFound)
	require.NoError(t, tx.Rollback())
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestReserveUsageBillingBatchImageBalance_MovesAvailableToFrozen(t *testing.T) {
	ctx := context.Background()
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer func() { _ = db.Close() }()

	mock.ExpectBegin()
	tx, err := db.BeginTx(ctx, nil)
	require.NoError(t, err)
	mock.ExpectQuery(reserveBatchImageHoldSQL).
		WithArgs(service.BillingAmountFromFloat(2.5), int64(42)).
		WillReturnRows(sqlmock.NewRows([]string{"balance", "frozen_balance"}).AddRow(7.5, 2.5))
	mock.ExpectCommit()

	result, err := reserveUsageBillingBatchImageBalance(ctx, tx, &service.BatchImageBalanceHoldCommand{UserID: 42, HoldAmount: service.BillingAmountFromFloat(2.5)})
	require.NoError(t, err)
	require.NotNil(t, result.NewBalance)
	require.NotNil(t, result.FrozenBalance)
	require.True(t, result.NewBalance.Equal(service.BillingAmountFromFloat(7.5)))
	require.True(t, result.FrozenBalance.Equal(service.BillingAmountFromFloat(2.5)))
	require.NoError(t, tx.Commit())
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestReserveUsageBillingBatchImageBalance_InsufficientBalance(t *testing.T) {
	ctx := context.Background()
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer func() { _ = db.Close() }()

	mock.ExpectBegin()
	tx, err := db.BeginTx(ctx, nil)
	require.NoError(t, err)
	mock.ExpectQuery(reserveBatchImageHoldSQL).
		WithArgs(service.BillingAmountFromFloat(10), int64(42)).
		WillReturnError(sql.ErrNoRows)
	mock.ExpectQuery(userExistsForBillingSQL).
		WithArgs(int64(42)).
		WillReturnRows(sqlmock.NewRows([]string{"?column?"}).AddRow(1))
	mock.ExpectRollback()

	_, err = reserveUsageBillingBatchImageBalance(ctx, tx, &service.BatchImageBalanceHoldCommand{UserID: 42, HoldAmount: service.BillingAmountFromFloat(10)})
	require.ErrorIs(t, err, service.ErrBatchImageInsufficientBalance)
	require.NoError(t, tx.Rollback())
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestCaptureUsageBillingBatchImageBalance_ReleasesRemainder(t *testing.T) {
	ctx := context.Background()
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer func() { _ = db.Close() }()

	mock.ExpectBegin()
	tx, err := db.BeginTx(ctx, nil)
	require.NoError(t, err)
	mock.ExpectQuery(captureBatchImageHoldSQL).
		WithArgs(service.BillingAmountFromFloat(1), service.BillingAmountFromFloat(0.25), int64(42)).
		WillReturnRows(sqlmock.NewRows([]string{"balance", "frozen_balance"}).AddRow(9.75, 0.0))
	mock.ExpectCommit()

	result, err := captureUsageBillingBatchImageBalance(ctx, tx, &service.BatchImageBalanceHoldCommand{UserID: 42, HoldAmount: service.BillingAmountFromFloat(1), ActualAmount: service.BillingAmountFromFloat(0.25)})
	require.NoError(t, err)
	require.True(t, result.NewBalance.Equal(service.BillingAmountFromFloat(9.75)))
	require.True(t, result.FrozenBalance.IsZero())
	require.NoError(t, tx.Commit())
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestCaptureUsageBillingBatchImageBalance_RejectsActualCostOverHold(t *testing.T) {
	ctx := context.Background()
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer func() { _ = db.Close() }()

	mock.ExpectBegin()
	tx, err := db.BeginTx(ctx, nil)
	require.NoError(t, err)
	mock.ExpectRollback()

	_, err = captureUsageBillingBatchImageBalance(ctx, tx, &service.BatchImageBalanceHoldCommand{UserID: 42, HoldAmount: service.BillingAmountFromFloat(0.5), ActualAmount: service.BillingAmountFromFloat(1)})
	require.ErrorIs(t, err, service.ErrBatchImageSettlementCostExceedsHold)
	require.NoError(t, tx.Rollback())
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestReleaseUsageBillingBatchImageBalance_ReturnsFrozenToAvailable(t *testing.T) {
	ctx := context.Background()
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer func() { _ = db.Close() }()

	mock.ExpectBegin()
	tx, err := db.BeginTx(ctx, nil)
	require.NoError(t, err)
	mock.ExpectQuery(`SELECT 1\s+FROM usage_billing_dedup\s+WHERE request_id = \$1 AND api_key_id = \$2`).
		WithArgs(service.BatchImageHoldRequestID("imgbatch_release"), int64(7)).
		WillReturnRows(sqlmock.NewRows([]string{"?column?"}).AddRow(1))
	mock.ExpectQuery(releaseBatchImageHoldSQL).
		WithArgs(service.BillingAmountFromFloat(1), int64(42)).
		WillReturnRows(sqlmock.NewRows([]string{"balance", "frozen_balance"}).AddRow(10.0, 0.0))
	mock.ExpectCommit()

	result, err := releaseUsageBillingBatchImageBalance(ctx, tx, &service.BatchImageBalanceHoldCommand{UserID: 42, APIKeyID: 7, BatchID: "imgbatch_release", HoldAmount: service.BillingAmountFromFloat(1)})
	require.NoError(t, err)
	require.True(t, result.NewBalance.Equal(service.BillingAmountFromFloat(10)))
	require.True(t, result.FrozenBalance.IsZero())
	require.NoError(t, tx.Commit())
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestReleaseUsageBillingBatchImageBalance_SkipsWhenHoldNeverReserved(t *testing.T) {
	ctx := context.Background()
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer func() { _ = db.Close() }()

	mock.ExpectBegin()
	tx, err := db.BeginTx(ctx, nil)
	require.NoError(t, err)
	// dedup 与归档表均无 hold claim：说明该 job 从未成功冻结，
	// 释放必须跳过，不得从他人冻结资金池中凭空生成余额。
	mock.ExpectQuery(`SELECT 1\s+FROM usage_billing_dedup\s+WHERE request_id = \$1 AND api_key_id = \$2`).
		WithArgs(service.BatchImageHoldRequestID("imgbatch_phantom"), int64(7)).
		WillReturnError(sql.ErrNoRows)
	mock.ExpectQuery(`SELECT 1\s+FROM usage_billing_dedup_archive\s+WHERE request_id = \$1 AND api_key_id = \$2`).
		WithArgs(service.BatchImageHoldRequestID("imgbatch_phantom"), int64(7)).
		WillReturnError(sql.ErrNoRows)
	mock.ExpectCommit()

	result, err := releaseUsageBillingBatchImageBalance(ctx, tx, &service.BatchImageBalanceHoldCommand{UserID: 42, APIKeyID: 7, BatchID: "imgbatch_phantom", HoldAmount: service.BillingAmountFromFloat(1)})
	require.NoError(t, err)
	require.Nil(t, result.NewBalance)
	require.Nil(t, result.FrozenBalance)
	require.NoError(t, tx.Commit())
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestReserveBatchImageFunding_SubscriptionFirstCreatesPendingReservation(t *testing.T) {
	ctx := context.Background()
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer func() { _ = db.Close() }()

	now := time.Now().UTC()
	mock.ExpectBegin()
	tx, err := db.BeginTx(ctx, nil)
	require.NoError(t, err)
	mock.ExpectQuery(`(?s)SELECT billing_preference, balance.*FROM users.*FOR UPDATE`).
		WithArgs(int64(42)).
		WillReturnRows(sqlmock.NewRows([]string{"billing_preference", "balance"}).AddRow(service.BillingPreferenceSubscriptionFirst, 20.0))
	mock.ExpectQuery(`(?s)SELECT\s+us.id,.*us.cycle_reserved_usd.*FROM user_subscriptions us.*FOR UPDATE OF us`).
		WithArgs(int64(42), int64(9), sqlmock.AnyArg()).
		WillReturnRows(subscriptionBillingCandidateRows().
			AddRow(int64(71), now.Add(24*time.Hour), nil, now, 0.0, 0.0, 10.0, 604800, now, 2.0, 1.0, 20.0, 5.0, 1.0, true))
	mock.ExpectExec(`(?s)UPDATE user_subscriptions.*SET five_hour_reserved_usd = five_hour_reserved_usd \+ \$1.*cycle_reserved_usd = cycle_reserved_usd \+ \$1.*cycle_usage_usd \+ cycle_reserved_usd \+ \$1 <= cycle_quota_usd`).
		WithArgs(service.BillingAmountFromFloat(3), int64(71)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec(`(?s)INSERT INTO billing_reservations.*status.*last_heartbeat_at.*lease_expires_at.*pending`).
		WithArgs(service.BatchImageHoldRequestID("batch-1"), int64(7), int64(42), int64(9), int64(71), service.BillingSourceSubscription, service.BillingPreferenceSubscriptionFirst, "", service.BillingAmountFromFloat(3)).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	groupID := int64(9)
	result, err := reserveUsageBillingBatchImageFunding(ctx, tx, &service.BatchImageBalanceHoldCommand{
		RequestID: service.BatchImageHoldRequestID("batch-1"), APIKeyID: 7, UserID: 42, GroupID: &groupID, BatchID: "batch-1", HoldAmount: service.BillingAmountFromFloat(3),
	})
	require.NoError(t, err)
	require.Equal(t, service.BillingSourceSubscription, result.BillingSource)
	require.Equal(t, service.BillingPreferenceSubscriptionFirst, result.BillingPreference)
	require.NotNil(t, result.SubscriptionID)
	require.Equal(t, int64(71), *result.SubscriptionID)
	require.NoError(t, tx.Commit())
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestReserveBatchImageFunding_SubscriptionOnlyDoesNotSplitAcrossWallet(t *testing.T) {
	ctx := context.Background()
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer func() { _ = db.Close() }()

	now := time.Now().UTC()
	mock.ExpectBegin()
	tx, err := db.BeginTx(ctx, nil)
	require.NoError(t, err)
	mock.ExpectQuery(`(?s)SELECT billing_preference, balance.*FROM users.*FOR UPDATE`).
		WithArgs(int64(42)).
		WillReturnRows(sqlmock.NewRows([]string{"billing_preference", "balance"}).AddRow(service.BillingPreferenceSubscriptionOnly, 100.0))
	mock.ExpectQuery(`(?s)SELECT\s+us.id,.*us.cycle_reserved_usd.*FROM user_subscriptions us.*FOR UPDATE OF us`).
		WithArgs(int64(42), int64(9), sqlmock.AnyArg()).
		WillReturnRows(subscriptionBillingCandidateRows().
			AddRow(int64(71), now.Add(24*time.Hour), nil, now, 0.0, 0.0, 10.0, 604800, now, 8.0, 0.0, 20.0, 0.0, 0.0, true))
	mock.ExpectRollback()

	groupID := int64(9)
	_, err = reserveUsageBillingBatchImageFunding(ctx, tx, &service.BatchImageBalanceHoldCommand{UserID: 42, GroupID: &groupID, HoldAmount: service.BillingAmountFromFloat(3)})
	require.ErrorIs(t, err, service.ErrSubscriptionQuotaExceeded)
	require.NoError(t, tx.Rollback())
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestCaptureBatchImageFunding_UsesReservedSubscriptionSnapshot(t *testing.T) {
	ctx := context.Background()
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer func() { _ = db.Close() }()

	mock.ExpectBegin()
	tx, err := db.BeginTx(ctx, nil)
	require.NoError(t, err)
	mock.ExpectQuery(`(?s)SELECT id, user_id, group_id, subscription_id, billing_source,.*FROM billing_reservations.*FOR UPDATE`).
		WithArgs(service.BatchImageHoldRequestID("batch-2"), int64(7)).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "user_id", "group_id", "subscription_id", "billing_source", "billing_preference", "fallback_reason", "reserved_amount", "final_amount", "status",
		}).AddRow(int64(88), int64(42), int64(9), int64(71), service.BillingSourceSubscription, service.BillingPreferenceSubscriptionFirst, nil, 3.0, 0.0, "pending"))
	mock.ExpectExec(`(?s)UPDATE user_subscriptions.*five_hour_reserved_usd = five_hour_reserved_usd - \$1.*five_hour_usage_usd = CASE.*cycle_reserved_usd = cycle_reserved_usd - \$1.*cycle_usage_usd = CASE.*total_reserved_usd = total_reserved_usd - \$1.*total_usage_usd = total_usage_usd \+ \$2`).
		WithArgs(service.BillingAmountFromFloat(3), service.BillingAmountFromFloat(2), int64(71)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec(`(?s)UPDATE billing_reservations.*status = 'settled'.*WHERE id = \$2 AND status = 'pending'`).
		WithArgs(service.BillingAmountFromFloat(2), int64(88)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	result, err := captureUsageBillingBatchImageFunding(ctx, tx, &service.BatchImageBalanceHoldCommand{APIKeyID: 7, UserID: 42, BatchID: "batch-2", HoldAmount: service.BillingAmountFromFloat(3), ActualAmount: service.BillingAmountFromFloat(2)})
	require.NoError(t, err)
	require.Equal(t, service.BillingSourceSubscription, result.BillingSource)
	require.Equal(t, service.BillingPreferenceSubscriptionFirst, result.BillingPreference)
	require.NoError(t, tx.Commit())
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestReleaseBatchImageFunding_ReturnsSubscriptionReservationWithoutUsage(t *testing.T) {
	ctx := context.Background()
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer func() { _ = db.Close() }()

	mock.ExpectBegin()
	tx, err := db.BeginTx(ctx, nil)
	require.NoError(t, err)
	mock.ExpectQuery(`(?s)SELECT id, user_id, group_id, subscription_id, billing_source,.*FROM billing_reservations.*FOR UPDATE`).
		WithArgs(service.BatchImageHoldRequestID("batch-3"), int64(7)).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "user_id", "group_id", "subscription_id", "billing_source", "billing_preference", "fallback_reason", "reserved_amount", "final_amount", "status",
		}).AddRow(int64(89), int64(42), int64(9), int64(71), service.BillingSourceSubscription, service.BillingPreferenceWalletFirst, "wallet_insufficient", 3.0, 0.0, "pending"))
	mock.ExpectExec(`(?s)UPDATE user_subscriptions.*cycle_reserved_usd = cycle_reserved_usd - \$1.*WHERE id = \$2`).
		WithArgs(service.BillingAmountFromFloat(3), int64(71)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec(`(?s)UPDATE billing_reservations.*status = 'released'.*WHERE id = \$1 AND status = 'pending'`).
		WithArgs(int64(89)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	result, err := releaseUsageBillingBatchImageFunding(ctx, tx, &service.BatchImageBalanceHoldCommand{APIKeyID: 7, UserID: 42, BatchID: "batch-3", HoldAmount: service.BillingAmountFromFloat(3)})
	require.NoError(t, err)
	require.Equal(t, service.BillingSourceSubscription, result.BillingSource)
	require.Equal(t, "wallet_insufficient", result.BillingFallbackReason)
	require.NoError(t, tx.Commit())
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestBatchImageFundingReservation_StateTransitionsAreExplicit(t *testing.T) {
	tests := []struct {
		name       string
		operation  string
		status     string
		wantErr    error
		wantSource string
	}{
		{name: "capture settled is idempotent", operation: "capture", status: "settled", wantSource: service.BillingSourceSubscription},
		{name: "capture released is rejected", operation: "capture", status: "released", wantErr: service.ErrBatchImageBillingReservationReleased},
		{name: "release settled is a safe no-op", operation: "release", status: "settled", wantSource: service.BillingSourceSubscription},
		{name: "release released is idempotent", operation: "release", status: "released", wantSource: service.BillingSourceSubscription},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			db, mock, err := sqlmock.New()
			require.NoError(t, err)
			defer func() { _ = db.Close() }()

			mock.ExpectBegin()
			tx, err := db.BeginTx(ctx, nil)
			require.NoError(t, err)
			mock.ExpectQuery(`(?s)SELECT id, user_id, group_id, subscription_id, billing_source,.*FROM billing_reservations.*FOR UPDATE`).
				WithArgs(service.BatchImageHoldRequestID("batch-state"), int64(7)).
				WillReturnRows(sqlmock.NewRows([]string{
					"id", "user_id", "group_id", "subscription_id", "billing_source", "billing_preference", "fallback_reason", "reserved_amount", "final_amount", "status",
				}).AddRow(int64(90), int64(42), int64(9), int64(71), service.BillingSourceSubscription, service.BillingPreferenceSubscriptionFirst, nil, 3.0, 2.0, tt.status))

			cmd := &service.BatchImageBalanceHoldCommand{APIKeyID: 7, UserID: 42, BatchID: "batch-state", HoldAmount: service.BillingAmountFromFloat(3), ActualAmount: service.BillingAmountFromFloat(2)}
			var result *service.BatchImageBalanceHoldResult
			if tt.operation == "capture" {
				result, err = captureUsageBillingBatchImageFunding(ctx, tx, cmd)
			} else {
				result, err = releaseUsageBillingBatchImageFunding(ctx, tx, cmd)
			}

			if tt.wantErr != nil {
				require.ErrorIs(t, err, tt.wantErr)
				mock.ExpectRollback()
				require.NoError(t, tx.Rollback())
			} else {
				require.NoError(t, err)
				require.Equal(t, tt.wantSource, result.BillingSource)
				mock.ExpectCommit()
				require.NoError(t, tx.Commit())
			}
			require.NoError(t, mock.ExpectationsWereMet())
		})
	}
}

func TestReserveBatchImageFunding_WalletFirstUsesAvailableWallet(t *testing.T) {
	ctx := context.Background()
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer func() { _ = db.Close() }()

	mock.ExpectBegin()
	tx, err := db.BeginTx(ctx, nil)
	require.NoError(t, err)
	mock.ExpectQuery(`(?s)SELECT billing_preference, balance.*FROM users.*FOR UPDATE`).
		WithArgs(int64(42)).
		WillReturnRows(sqlmock.NewRows([]string{"billing_preference", "balance"}).AddRow(service.BillingPreferenceWalletFirst, 20.0))
	mock.ExpectQuery(`(?s)SELECT\s+us.id,.*us.cycle_reserved_usd.*FROM user_subscriptions us.*FOR UPDATE OF us`).
		WithArgs(int64(42), int64(9), sqlmock.AnyArg()).
		WillReturnRows(emptySubscriptionBillingCandidateRows())
	mock.ExpectQuery(reserveBatchImageHoldSQL).
		WithArgs(service.BillingAmountFromFloat(3), int64(42)).
		WillReturnRows(sqlmock.NewRows([]string{"balance", "frozen_balance"}).AddRow(17.0, 3.0))
	mock.ExpectExec(`(?s)INSERT INTO billing_reservations.*status.*pending`).
		WithArgs(service.BatchImageHoldRequestID("batch-wallet"), int64(7), int64(42), int64(9), nil, service.BillingSourceWallet, service.BillingPreferenceWalletFirst, "", service.BillingAmountFromFloat(3)).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	groupID := int64(9)
	result, err := reserveUsageBillingBatchImageFunding(ctx, tx, &service.BatchImageBalanceHoldCommand{
		RequestID: service.BatchImageHoldRequestID("batch-wallet"), APIKeyID: 7, UserID: 42, GroupID: &groupID, BatchID: "batch-wallet", HoldAmount: service.BillingAmountFromFloat(3),
	})
	require.NoError(t, err)
	require.Equal(t, service.BillingSourceWallet, result.BillingSource)
	require.Equal(t, service.BillingPreferenceWalletFirst, result.BillingPreference)
	require.True(t, result.NewBalance.Equal(service.BillingAmountFromFloat(17)))
	require.NoError(t, tx.Commit())
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestReserveBatchImageFunding_WalletFirstFallsBackToSubscription(t *testing.T) {
	ctx := context.Background()
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer func() { _ = db.Close() }()

	now := time.Now().UTC()
	mock.ExpectBegin()
	tx, err := db.BeginTx(ctx, nil)
	require.NoError(t, err)
	mock.ExpectQuery(`(?s)SELECT billing_preference, balance.*FROM users.*FOR UPDATE`).
		WithArgs(int64(42)).
		WillReturnRows(sqlmock.NewRows([]string{"billing_preference", "balance"}).AddRow(service.BillingPreferenceWalletFirst, 1.0))
	mock.ExpectQuery(`(?s)SELECT\s+us.id,.*us.cycle_reserved_usd.*FROM user_subscriptions us.*FOR UPDATE OF us`).
		WithArgs(int64(42), int64(9), sqlmock.AnyArg()).
		WillReturnRows(subscriptionBillingCandidateRows().AddRow(int64(71), now.Add(24*time.Hour), nil, now, 0.0, 0.0, 10.0, 604800, now, 2.0, 1.0, nil, 0.0, 0.0, true))
	mock.ExpectExec(`(?s)UPDATE user_subscriptions.*SET five_hour_reserved_usd = five_hour_reserved_usd \+ \$1.*cycle_reserved_usd = cycle_reserved_usd \+ \$1`).
		WithArgs(service.BillingAmountFromFloat(3), int64(71)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec(`(?s)INSERT INTO billing_reservations.*status.*pending`).
		WithArgs(service.BatchImageHoldRequestID("batch-sub-fallback"), int64(7), int64(42), int64(9), int64(71), service.BillingSourceSubscription, service.BillingPreferenceWalletFirst, "wallet_insufficient", service.BillingAmountFromFloat(3)).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	groupID := int64(9)
	result, err := reserveUsageBillingBatchImageFunding(ctx, tx, &service.BatchImageBalanceHoldCommand{
		RequestID: service.BatchImageHoldRequestID("batch-sub-fallback"), APIKeyID: 7, UserID: 42, GroupID: &groupID, BatchID: "batch-sub-fallback", HoldAmount: service.BillingAmountFromFloat(3),
	})
	require.NoError(t, err)
	require.Equal(t, service.BillingSourceSubscription, result.BillingSource)
	require.Equal(t, "wallet_insufficient", result.BillingFallbackReason)
	require.NoError(t, tx.Commit())
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestReserveBatchImageFunding_SubscriptionFirstHonorsWalletFallbackFlag(t *testing.T) {
	for _, tt := range []struct {
		name            string
		fallbackEnabled bool
		wantErr         bool
	}{
		{name: "disabled", fallbackEnabled: false, wantErr: true},
		{name: "enabled", fallbackEnabled: true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			db, mock, err := sqlmock.New()
			require.NoError(t, err)
			defer func() { _ = db.Close() }()

			now := time.Now().UTC()
			mock.ExpectBegin()
			tx, err := db.BeginTx(ctx, nil)
			require.NoError(t, err)
			mock.ExpectQuery(`(?s)SELECT billing_preference, balance.*FROM users.*FOR UPDATE`).
				WithArgs(int64(42)).
				WillReturnRows(sqlmock.NewRows([]string{"billing_preference", "balance"}).AddRow(service.BillingPreferenceSubscriptionFirst, 20.0))
			mock.ExpectQuery(`(?s)SELECT\s+us.id,.*us.cycle_reserved_usd.*FROM user_subscriptions us.*FOR UPDATE OF us`).
				WithArgs(int64(42), int64(9), sqlmock.AnyArg()).
				WillReturnRows(subscriptionBillingCandidateRows().AddRow(int64(71), now.Add(24*time.Hour), nil, now, 0.0, 0.0, 10.0, 604800, now, 8.0, 1.0, nil, 0.0, 0.0, tt.fallbackEnabled))

			groupID := int64(9)
			cmd := &service.BatchImageBalanceHoldCommand{
				RequestID: service.BatchImageHoldRequestID("batch-fallback-" + tt.name), APIKeyID: 7, UserID: 42, GroupID: &groupID, BatchID: "batch-fallback-" + tt.name, HoldAmount: service.BillingAmountFromFloat(2),
			}
			if tt.wantErr {
				mock.ExpectRollback()
				_, err = reserveUsageBillingBatchImageFunding(ctx, tx, cmd)
				require.ErrorIs(t, err, service.ErrSubscriptionQuotaExceeded)
				require.NoError(t, tx.Rollback())
			} else {
				mock.ExpectQuery(reserveBatchImageHoldSQL).
					WithArgs(service.BillingAmountFromFloat(2), int64(42)).
					WillReturnRows(sqlmock.NewRows([]string{"balance", "frozen_balance"}).AddRow(18.0, 2.0))
				mock.ExpectExec(`(?s)INSERT INTO billing_reservations.*status.*pending`).
					WithArgs(cmd.RequestID, int64(7), int64(42), int64(9), nil, service.BillingSourceWallet, service.BillingPreferenceSubscriptionFirst, "subscription_cycle_quota_exhausted", service.BillingAmountFromFloat(2)).
					WillReturnResult(sqlmock.NewResult(1, 1))
				mock.ExpectCommit()
				result, reserveErr := reserveUsageBillingBatchImageFunding(ctx, tx, cmd)
				require.NoError(t, reserveErr)
				require.Equal(t, service.BillingSourceWallet, result.BillingSource)
				require.Equal(t, "subscription_cycle_quota_exhausted", result.BillingFallbackReason)
				require.NoError(t, tx.Commit())
			}
			require.NoError(t, mock.ExpectationsWereMet())
		})
	}
}

func TestApplySubscriptionGroupBillingDecision_CountsPendingReservations(t *testing.T) {
	ctx := context.Background()
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer func() { _ = db.Close() }()

	now := time.Now().UTC()
	mock.ExpectBegin()
	tx, err := db.BeginTx(ctx, nil)
	require.NoError(t, err)
	mock.ExpectQuery(`(?s)SELECT billing_preference, balance.*FROM users.*FOR UPDATE`).
		WithArgs(int64(42)).
		WillReturnRows(sqlmock.NewRows([]string{"billing_preference", "balance"}).AddRow(service.BillingPreferenceSubscriptionFirst, 20.0))
	mock.ExpectQuery(`(?s)SELECT\s+us.id,.*us.cycle_reserved_usd.*FROM user_subscriptions us.*FOR UPDATE OF us`).
		WithArgs(int64(42), int64(9), sqlmock.AnyArg()).
		WillReturnRows(subscriptionBillingCandidateRows().AddRow(int64(71), now.Add(24*time.Hour), nil, now, 0.0, 0.0, 10.0, 604800, now, 7.0, 2.0, nil, 0.0, 0.0, false))
	mock.ExpectRollback()

	groupID := int64(9)
	err = applyPlanCoverageBillingDecision(ctx, tx, &service.UsageBillingCommand{
		RequestID: "req-reserved", APIKeyID: 7, UserID: 42, GroupID: &groupID, BillableCost: service.BillingAmountFromFloat(2),
	}, &service.UsageBillingApplyResult{})
	require.ErrorIs(t, err, service.ErrSubscriptionQuotaExceeded)
	require.NoError(t, tx.Rollback())
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestApplySubscriptionGroupBillingDecision_WalletOnly(t *testing.T) {
	ctx := context.Background()
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer func() { _ = db.Close() }()

	mock.ExpectBegin()
	tx, err := db.BeginTx(ctx, nil)
	require.NoError(t, err)
	expectBillingDecisionUserAndCandidates(mock, service.BillingPreferenceWalletOnly, 5, emptySubscriptionBillingCandidateRows())
	mock.ExpectQuery(conditionalBalanceDeductSQL).
		WithArgs(service.BillingAmountFromFloat(2), int64(42)).
		WillReturnRows(sqlmock.NewRows([]string{"balance"}).AddRow(3.0))
	mock.ExpectExec(`(?s)INSERT INTO billing_reservations.*status, settled_at`).
		WithArgs("req-wallet-only", int64(7), int64(42), int64(9), nil, service.BillingSourceWallet, service.BillingPreferenceWalletOnly, "", service.BillingAmountFromFloat(2)).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	result := &service.UsageBillingApplyResult{}
	err = applyPlanCoverageBillingDecision(ctx, tx, newBillingDecisionCommand("req-wallet-only", 2), result)
	require.NoError(t, err)
	require.Equal(t, service.BillingSourceWallet, result.BillingSource)
	require.True(t, result.NewBalance.Equal(service.BillingAmountFromFloat(3)))
	require.NoError(t, tx.Commit())
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestApplySubscriptionGroupBillingDecision_WalletFirstFallsBackToSubscription(t *testing.T) {
	ctx := context.Background()
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer func() { _ = db.Close() }()

	now := time.Now().UTC()
	mock.ExpectBegin()
	tx, err := db.BeginTx(ctx, nil)
	require.NoError(t, err)
	expectBillingDecisionUserAndCandidates(mock, service.BillingPreferenceWalletFirst, 1,
		subscriptionBillingCandidateRows().AddRow(int64(71), now.Add(time.Hour), nil, now, 0.0, 0.0, 10.0, 604800, now, 3.0, 0.0, nil, 0.0, 0.0, true))
	mock.ExpectExec(`(?s)UPDATE user_subscriptions.*SET five_hour_usage_usd = five_hour_usage_usd \+ \$1.*cycle_usage_usd = cycle_usage_usd \+ \$1`).
		WithArgs(service.BillingAmountFromFloat(2), int64(71)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec(`(?s)INSERT INTO billing_reservations.*status, settled_at`).
		WithArgs("req-wallet-first", int64(7), int64(42), int64(9), int64(71), service.BillingSourceSubscription, service.BillingPreferenceWalletFirst, "wallet_insufficient", service.BillingAmountFromFloat(2)).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	result := &service.UsageBillingApplyResult{}
	err = applyPlanCoverageBillingDecision(ctx, tx, newBillingDecisionCommand("req-wallet-first", 2), result)
	require.NoError(t, err)
	require.Equal(t, service.BillingSourceSubscription, result.BillingSource)
	require.Equal(t, "wallet_insufficient", result.BillingFallbackReason)
	require.Equal(t, int64(71), *result.SubscriptionID)
	require.NoError(t, tx.Commit())
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestApplySubscriptionGroupBillingDecision_SubscriptionOnlyRejectsExhaustedQuota(t *testing.T) {
	ctx := context.Background()
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer func() { _ = db.Close() }()

	now := time.Now().UTC()
	mock.ExpectBegin()
	tx, err := db.BeginTx(ctx, nil)
	require.NoError(t, err)
	expectBillingDecisionUserAndCandidates(mock, service.BillingPreferenceSubscriptionOnly, 20,
		subscriptionBillingCandidateRows().AddRow(int64(71), now.Add(time.Hour), nil, now, 0.0, 0.0, 10.0, 604800, now, 9.0, 1.0, nil, 0.0, 0.0, true))
	mock.ExpectRollback()

	err = applyPlanCoverageBillingDecision(ctx, tx, newBillingDecisionCommand("req-sub-only", 1), &service.UsageBillingApplyResult{})
	require.ErrorIs(t, err, service.ErrSubscriptionQuotaExceeded)
	require.NoError(t, tx.Rollback())
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestApplySubscriptionGroupBillingDecision_RejectsWhenTermQuotaIsExhausted(t *testing.T) {
	ctx := context.Background()
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer func() { _ = db.Close() }()

	now := time.Now().UTC()
	mock.ExpectBegin()
	tx, err := db.BeginTx(ctx, nil)
	require.NoError(t, err)
	// The weekly window still has room, but the complete subscription term
	// has no remaining allowance. The term limit must win.
	expectBillingDecisionUserAndCandidates(mock, service.BillingPreferenceSubscriptionOnly, 20,
		subscriptionBillingCandidateRows().AddRow(int64(72), now.Add(time.Hour), nil, now, 0.0, 0.0, 10.0, 604800, now, 2.0, 0.0, 20.0, 20.0, 0.0, true))
	mock.ExpectRollback()

	err = applyPlanCoverageBillingDecision(ctx, tx, newBillingDecisionCommand("req-term-exhausted", 1), &service.UsageBillingApplyResult{})
	require.ErrorIs(t, err, service.ErrSubscriptionQuotaExceeded)
	require.NoError(t, tx.Rollback())
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestApplySubscriptionGroupBillingDecision_SubscriptionFirstSelectsEarliestEligibleQuota(t *testing.T) {
	ctx := context.Background()
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer func() { _ = db.Close() }()

	now := time.Now().UTC()
	mock.ExpectBegin()
	tx, err := db.BeginTx(ctx, nil)
	require.NoError(t, err)
	expectBillingDecisionUserAndCandidates(mock, service.BillingPreferenceSubscriptionFirst, 20,
		subscriptionBillingCandidateRows().
			AddRow(int64(71), now.Add(time.Hour), nil, now, 0.0, 0.0, 10.0, 604800, now, 9.0, 1.0, nil, 0.0, 0.0, false).
			AddRow(int64(72), now.Add(2*time.Hour), nil, now, 0.0, 0.0, 10.0, 604800, now, 8.0, 1.0, nil, 0.0, 0.0, false))
	mock.ExpectExec(`(?s)UPDATE user_subscriptions.*SET five_hour_usage_usd = five_hour_usage_usd \+ \$1.*cycle_usage_usd = cycle_usage_usd \+ \$1`).
		WithArgs(service.BillingAmountFromFloat(1), int64(72)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec(`(?s)INSERT INTO billing_reservations.*status, settled_at`).
		WithArgs("req-sub-first", int64(7), int64(42), int64(9), int64(72), service.BillingSourceSubscription, service.BillingPreferenceSubscriptionFirst, "", service.BillingAmountFromFloat(1)).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	result := &service.UsageBillingApplyResult{}
	err = applyPlanCoverageBillingDecision(ctx, tx, newBillingDecisionCommand("req-sub-first", 1), result)
	require.NoError(t, err)
	require.Equal(t, service.BillingSourceSubscription, result.BillingSource)
	require.Equal(t, int64(72), *result.SubscriptionID)
	require.NoError(t, tx.Commit())
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestApplySubscriptionGroupBillingDecision_SubscriptionFirstWithoutCoverageUsesWallet(t *testing.T) {
	ctx := context.Background()
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer func() { _ = db.Close() }()

	mock.ExpectBegin()
	tx, err := db.BeginTx(ctx, nil)
	require.NoError(t, err)
	expectBillingDecisionUserAndCandidates(mock, service.BillingPreferenceSubscriptionFirst, 5, emptySubscriptionBillingCandidateRows())
	mock.ExpectQuery(conditionalBalanceDeductSQL).
		WithArgs(service.BillingAmountFromFloat(2), int64(42)).
		WillReturnRows(sqlmock.NewRows([]string{"balance"}).AddRow(3.0))
	mock.ExpectExec(`(?s)INSERT INTO billing_reservations.*status, settled_at`).
		WithArgs("req-no-coverage", int64(7), int64(42), int64(9), nil, service.BillingSourceWallet, service.BillingPreferenceSubscriptionFirst, "subscription_unavailable", service.BillingAmountFromFloat(2)).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	result := &service.UsageBillingApplyResult{}
	err = applyPlanCoverageBillingDecision(ctx, tx, newBillingDecisionCommand("req-no-coverage", 2), result)
	require.NoError(t, err)
	require.Equal(t, service.BillingSourceWallet, result.BillingSource)
	require.Equal(t, "subscription_unavailable", result.BillingFallbackReason)
	require.NoError(t, tx.Commit())
	require.NoError(t, mock.ExpectationsWereMet())
}

func expectBillingDecisionUserAndCandidates(mock sqlmock.Sqlmock, preference string, balance float64, candidates *sqlmock.Rows) {
	mock.ExpectQuery(`(?s)SELECT billing_preference, balance.*FROM users.*FOR UPDATE`).
		WithArgs(int64(42)).
		WillReturnRows(sqlmock.NewRows([]string{"billing_preference", "balance"}).AddRow(preference, balance))
	mock.ExpectQuery(`(?s)SELECT\s+us.id,.*us.cycle_reserved_usd.*FROM user_subscriptions us.*FOR UPDATE OF us`).
		WithArgs(int64(42), int64(9), sqlmock.AnyArg()).
		WillReturnRows(candidates)
}

func newBillingDecisionCommand(requestID string, amount float64) *service.UsageBillingCommand {
	groupID := int64(9)
	return &service.UsageBillingCommand{
		RequestID:    requestID,
		APIKeyID:     7,
		UserID:       42,
		GroupID:      &groupID,
		BillableCost: service.BillingAmountFromFloat(amount),
	}
}

func emptySubscriptionBillingCandidateRows() *sqlmock.Rows {
	return subscriptionBillingCandidateRows()
}

func subscriptionBillingCandidateRows() *sqlmock.Rows {
	return sqlmock.NewRows([]string{
		"id", "expires_at", "five_hour_quota_usd", "five_hour_started_at", "five_hour_usage_usd", "five_hour_reserved_usd",
		"cycle_quota_usd", "reset_interval_seconds", "cycle_started_at", "cycle_usage_usd", "cycle_reserved_usd",
		"total_quota_usd", "total_usage_usd", "total_reserved_usd", "wallet_fallback_enabled",
	})
}
