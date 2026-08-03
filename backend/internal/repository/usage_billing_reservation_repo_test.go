package repository

import (
	"context"
	"database/sql"
	"regexp"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/require"
)

func newUsageBillingReservationRows() *sqlmock.Rows {
	return sqlmock.NewRows([]string{
		"id", "request_fingerprint", "request_payload_hash", "user_id", "group_id",
		"subscription_id", "billing_source", "billing_preference", "fallback_reason",
		"reserved_amount", "final_amount", "status", "lease_owner",
	})
}

func reservationSubscriptionBillingCandidateRows() *sqlmock.Rows {
	return sqlmock.NewRows([]string{
		"id", "expires_at", "five_hour_quota_usd", "five_hour_started_at", "five_hour_usage_usd", "five_hour_reserved_usd",
		"cycle_quota_usd", "reset_interval_seconds", "cycle_started_at",
		"cycle_usage_usd", "cycle_reserved_usd", "total_quota_usd", "total_usage_usd",
		"total_reserved_usd", "wallet_fallback_enabled",
	})
}

func TestReserveRequestBilling_WalletOnlyMovesBalanceToFrozen(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer func() { _ = db.Close() }()

	groupID := int64(9)
	amount := service.BillingAmountFromFloat(2)
	mock.ExpectBegin()
	mock.ExpectQuery(`(?s)SELECT id, request_fingerprint.*FROM billing_reservations.*FOR UPDATE`).
		WithArgs("request-1", int64(7)).
		WillReturnRows(newUsageBillingReservationRows())
	mock.ExpectQuery(`(?s)SELECT billing_preference, balance.*FROM users.*FOR UPDATE`).
		WithArgs(int64(42)).
		WillReturnRows(sqlmock.NewRows([]string{"billing_preference", "balance"}).AddRow(service.BillingPreferenceWalletOnly, 10))
	mock.ExpectQuery(`(?s)SELECT.*FROM user_subscriptions us.*FOR UPDATE OF us`).
		WithArgs(int64(42), groupID, sqlmock.AnyArg()).
		WillReturnRows(reservationSubscriptionBillingCandidateRows())
	mock.ExpectQuery(`(?s)UPDATE users.*frozen_balance = COALESCE\(frozen_balance, 0\) \+ \$1.*RETURNING balance, frozen_balance`).
		WithArgs(amount, int64(42)).
		WillReturnRows(sqlmock.NewRows([]string{"balance", "frozen_balance"}).AddRow(8, 2))
	mock.ExpectExec(`(?s)INSERT INTO billing_reservations.*lease_owner.*lease_expires_at`).
		WithArgs("request-1", int64(7), sqlmock.AnyArg(), "payload-1", int64(42), &groupID, nil, service.BillingSourceWallet, service.BillingPreferenceWalletOnly, "", amount, "owner-1", 900).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	repo := &usageBillingRepository{db: db}
	result, err := repo.ReserveRequestBilling(context.Background(), &service.UsageBillingReservationCommand{
		RequestID:          "request-1",
		APIKeyID:           7,
		RequestPayloadHash: "payload-1",
		UserID:             42,
		GroupID:            &groupID,
		EstimatedAmount:    amount,
		LeaseOwner:         "owner-1",
		LeaseDurationSecs:  900,
	})
	require.NoError(t, err)
	require.True(t, result.Applied)
	require.Equal(t, service.BillingSourceWallet, result.BillingSource)
	require.True(t, result.ReservedAmount.Equal(amount))
	require.Equal(t, "owner-1", result.LeaseOwner)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestRebindRequestBilling_ReleasesOldWalletAndReservesDestinationSubscription(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer func() { _ = db.Close() }()

	oldGroupID := int64(10)
	newGroupID := int64(20)
	oldAmount := service.BillingAmountFromFloat(2)
	newAmount := service.BillingAmountFromFloat(3)
	mock.ExpectBegin()
	mock.ExpectQuery(`(?s)SELECT id, request_fingerprint.*FROM billing_reservations.*FOR UPDATE`).
		WithArgs("request-rebind", int64(7)).
		WillReturnRows(newUsageBillingReservationRows().AddRow(
			int64(81), "old-fingerprint", "payload-rebind", int64(42), oldGroupID,
			nil, service.BillingSourceWallet, service.BillingPreferenceSubscriptionFirst, nil,
			oldAmount, decimal.Zero, usageBillingReservationPending, "owner-rebind",
		))
	mock.ExpectQuery(`(?s)SELECT billing_preference, balance.*FROM users.*FOR UPDATE`).
		WithArgs(int64(42)).
		WillReturnRows(sqlmock.NewRows([]string{"billing_preference", "balance"}).AddRow(service.BillingPreferenceSubscriptionFirst, 5))
	mock.ExpectQuery(`(?s)UPDATE users.*balance = balance \+ \$1.*frozen_balance.*- \$1.*RETURNING balance, frozen_balance`).
		WithArgs(oldAmount, int64(42)).
		WillReturnRows(sqlmock.NewRows([]string{"balance", "frozen_balance"}).AddRow(7, 0))
	mock.ExpectQuery(`(?s)SELECT.*FROM user_subscriptions us.*FOR UPDATE OF us`).
		WithArgs(int64(42), newGroupID, sqlmock.AnyArg()).
		WillReturnRows(reservationSubscriptionBillingCandidateRows().
			AddRow(int64(91), time.Now().Add(24*time.Hour), nil, time.Now(), 0, 0, 10, 604800, time.Now(), 1, 0, 12, 9, 0, true))
	mock.ExpectExec(`(?s)UPDATE user_subscriptions.*five_hour_reserved_usd = five_hour_reserved_usd \+ \$1.*cycle_reserved_usd = cycle_reserved_usd \+ \$1`).
		WithArgs(newAmount, int64(91)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec(`(?s)UPDATE billing_reservations.*request_fingerprint = \$1.*group_id = \$3.*lease_expires_at`).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	repo := &usageBillingRepository{db: db}
	result, err := repo.RebindRequestBilling(context.Background(), &service.UsageBillingReservationRebindCommand{
		RequestID:          "request-rebind",
		APIKeyID:           7,
		RequestPayloadHash: "payload-rebind",
		UserID:             42,
		ExpectedGroupID:    &oldGroupID,
		GroupID:            &newGroupID,
		EstimatedAmount:    newAmount,
		LeaseOwner:         "owner-rebind",
		LeaseDurationSecs:  900,
	})
	require.NoError(t, err)
	require.True(t, result.Applied)
	require.Equal(t, service.BillingSourceSubscription, result.BillingSource)
	require.Equal(t, int64(91), *result.SubscriptionID)
	require.Equal(t, newGroupID, *result.GroupID)
	require.True(t, result.ReservedAmount.Equal(newAmount))
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestHeartbeatRequestBilling_UsesLeaseOwnerCAS(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer func() { _ = db.Close() }()
	mock.ExpectExec(`(?s)UPDATE billing_reservations.*lease_expires_at.*status = 'pending'.*lease_owner = \$4`).
		WithArgs(120, "request-heartbeat", int64(7), "owner-heartbeat").
		WillReturnResult(sqlmock.NewResult(0, 1))

	repo := &usageBillingRepository{db: db}
	active, err := repo.HeartbeatRequestBilling(context.Background(), &service.UsageBillingReservationHeartbeatCommand{
		RequestID:         "request-heartbeat",
		APIKeyID:          7,
		LeaseOwner:        "owner-heartbeat",
		LeaseDurationSecs: 120,
	})
	require.NoError(t, err)
	require.True(t, active)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestReleaseExpiredRequestBilling_ReleasesWalletAtomically(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer func() { _ = db.Close() }()
	amount := service.BillingAmountFromFloat(4)
	mock.ExpectBegin()
	mock.ExpectQuery(`(?s)SELECT id, user_id, subscription_id, billing_source, reserved_amount.*FOR UPDATE SKIP LOCKED.*LIMIT \$1`).
		WithArgs(25).
		WillReturnRows(sqlmock.NewRows([]string{"id", "user_id", "subscription_id", "billing_source", "reserved_amount"}).
			AddRow(int64(71), int64(42), nil, service.BillingSourceWallet, amount))
	mock.ExpectQuery(`(?s)UPDATE users.*balance = balance \+ \$1.*frozen_balance.*- \$1.*RETURNING balance, frozen_balance`).
		WithArgs(amount, int64(42)).
		WillReturnRows(sqlmock.NewRows([]string{"balance", "frozen_balance"}).AddRow(9, 0))
	mock.ExpectExec(regexp.QuoteMeta("UPDATE billing_reservations") + `(?s).*status = 'released'.*lease_expires_at = NULL`).
		WithArgs(int64(71)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	repo := &usageBillingRepository{db: db}
	released, err := repo.ReleaseExpiredRequestBilling(context.Background(), 25)
	require.NoError(t, err)
	require.Equal(t, 1, released)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestApply_SettlesPendingWalletReservationWithActualAmount(t *testing.T) {
	for _, testCase := range []struct {
		name        string
		actual      decimal.Decimal
		newBalance  decimal.Decimal
		overdrafted bool
	}{
		{name: "refunds unused hold", actual: service.BillingAmountFromFloat(2), newBalance: service.BillingAmountFromFloat(3)},
		{name: "captures amount above hold into debt", actual: service.BillingAmountFromFloat(7), newBalance: service.BillingAmountFromFloat(-2), overdrafted: true},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			db, mock, err := sqlmock.New()
			require.NoError(t, err)
			defer func() { _ = db.Close() }()
			groupID := int64(9)
			reserved := service.BillingAmountFromFloat(5)
			mock.ExpectBegin()
			mock.ExpectQuery(`(?s)INSERT INTO usage_billing_dedup.*RETURNING id`).
				WithArgs("request-settle", int64(7), sqlmock.AnyArg()).
				WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(int64(1)))
			mock.ExpectQuery(`(?s)SELECT request_fingerprint.*FROM usage_billing_dedup_archive`).
				WithArgs("request-settle", int64(7)).
				WillReturnError(sql.ErrNoRows)
			mock.ExpectQuery(`(?s)SELECT id, request_fingerprint.*FROM billing_reservations.*FOR UPDATE`).
				WithArgs("request-settle", int64(7)).
				WillReturnRows(newUsageBillingReservationRows().AddRow(
					int64(81), "reservation-fingerprint", "payload-settle", int64(42), groupID,
					nil, service.BillingSourceWallet, service.BillingPreferenceWalletOnly, nil,
					reserved, decimal.Zero, usageBillingReservationPending, "owner-settle",
				))
			mock.ExpectQuery(`(?s)^\s*UPDATE users\s+SET balance = balance \+ \$1 - \$2,\s+frozen_balance = COALESCE\(frozen_balance, 0\) - \$1,\s+updated_at = NOW\(\)\s+WHERE id = \$3\s+AND deleted_at IS NULL\s+AND COALESCE\(frozen_balance, 0\) >= \$1\s+RETURNING balance, frozen_balance\s*$`).
				WithArgs(reserved, testCase.actual, int64(42)).
				WillReturnRows(sqlmock.NewRows([]string{"balance", "frozen_balance"}).AddRow(testCase.newBalance, 0))
			mock.ExpectExec(`(?s)UPDATE billing_reservations.*final_amount = \$1.*status = 'settled'.*lease_expires_at = NULL`).
				WithArgs(testCase.actual, int64(81)).
				WillReturnResult(sqlmock.NewResult(0, 1))
			mock.ExpectCommit()

			repo := &usageBillingRepository{db: db}
			result, err := repo.Apply(context.Background(), &service.UsageBillingCommand{
				RequestID:            "request-settle",
				APIKeyID:             7,
				RequestPayloadHash:   "payload-settle",
				UserID:               42,
				GroupID:              &groupID,
				ResolveBillingSource: true,
				BillableCost:         testCase.actual,
			})
			require.NoError(t, err)
			require.True(t, result.Applied)
			require.Equal(t, service.BillingSourceWallet, result.BillingSource)
			require.NotNil(t, result.NewBalance)
			require.True(t, result.NewBalance.Equal(testCase.newBalance))
			require.Equal(t, testCase.overdrafted, result.BalanceOverdrafted)
			require.NoError(t, mock.ExpectationsWereMet())
		})
	}
}

func TestApply_SettlesPendingSubscriptionAboveReservedQuota(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer func() { _ = db.Close() }()

	groupID := int64(9)
	subscriptionID := int64(71)
	reserved := service.BillingAmountFromFloat(5)
	actual := service.BillingAmountFromFloat(7)
	mock.ExpectBegin()
	mock.ExpectQuery(`(?s)INSERT INTO usage_billing_dedup.*RETURNING id`).
		WithArgs("request-subscription-settle", int64(7), sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(int64(1)))
	mock.ExpectQuery(`(?s)SELECT request_fingerprint.*FROM usage_billing_dedup_archive`).
		WithArgs("request-subscription-settle", int64(7)).
		WillReturnError(sql.ErrNoRows)
	mock.ExpectQuery(`(?s)SELECT id, request_fingerprint.*FROM billing_reservations.*FOR UPDATE`).
		WithArgs("request-subscription-settle", int64(7)).
		WillReturnRows(newUsageBillingReservationRows().AddRow(
			int64(81), "reservation-fingerprint", "payload-subscription-settle", int64(42), groupID,
			subscriptionID, service.BillingSourceSubscription, service.BillingPreferenceSubscriptionOnly, nil,
			reserved, decimal.Zero, usageBillingReservationPending, "owner-settle",
		))
	mock.ExpectExec(`(?s)^\s*UPDATE user_subscriptions\s+SET five_hour_started_at = CASE.*five_hour_reserved_usd = five_hour_reserved_usd - \$1.*five_hour_usage_usd = CASE.*cycle_started_at = CASE.*cycle_reserved_usd = cycle_reserved_usd - \$1.*total_reserved_usd = total_reserved_usd - \$1.*total_usage_usd = total_usage_usd \+ \$2.*WHERE id = \$3.*AND five_hour_reserved_usd >= \$1.*AND cycle_reserved_usd >= \$1.*AND total_reserved_usd >= \$1\s*$`).
		WithArgs(reserved, actual, subscriptionID).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec(`(?s)UPDATE billing_reservations.*final_amount = \$1.*status = 'settled'.*lease_expires_at = NULL`).
		WithArgs(actual, int64(81)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	repo := &usageBillingRepository{db: db}
	result, err := repo.Apply(context.Background(), &service.UsageBillingCommand{
		RequestID:            "request-subscription-settle",
		APIKeyID:             7,
		RequestPayloadHash:   "payload-subscription-settle",
		UserID:               42,
		GroupID:              &groupID,
		ResolveBillingSource: true,
		BillableCost:         actual,
	})
	require.NoError(t, err)
	require.True(t, result.Applied)
	require.Equal(t, service.BillingSourceSubscription, result.BillingSource)
	require.NotNil(t, result.SubscriptionID)
	require.Equal(t, subscriptionID, *result.SubscriptionID)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestReleaseRequestBilling_IsIdempotentAfterSettlement(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer func() { _ = db.Close() }()
	groupID := int64(9)
	mock.ExpectBegin()
	mock.ExpectQuery(`(?s)SELECT id, request_fingerprint.*FROM billing_reservations.*FOR UPDATE`).
		WithArgs("request-terminal", int64(7)).
		WillReturnRows(newUsageBillingReservationRows().AddRow(
			int64(81), "fingerprint", "payload-terminal", int64(42), groupID,
			nil, service.BillingSourceWallet, service.BillingPreferenceWalletOnly, nil,
			5, 2, usageBillingReservationSettled, nil,
		))
	mock.ExpectCommit()

	repo := &usageBillingRepository{db: db}
	result, err := repo.ReleaseRequestBilling(context.Background(), &service.UsageBillingReservationReleaseCommand{
		RequestID:          "request-terminal",
		APIKeyID:           7,
		UserID:             42,
		RequestPayloadHash: "payload-terminal",
	})
	require.NoError(t, err)
	require.False(t, result.Applied)
	require.Equal(t, usageBillingReservationSettled, result.Status)
	require.NoError(t, mock.ExpectationsWereMet())
}
