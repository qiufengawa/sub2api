//go:build integration

package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"github.com/Wei-Shaw/sub2api/internal/service"
)

type integrationUsageBillingRepository interface {
	service.UsageBillingRepository
	service.UsageBillingReservationRepository
}

type integrationSubscriptionBillingFixture struct {
	repo           integrationUsageBillingRepository
	userID         int64
	groupID        int64
	apiKeyID       int64
	subscriptionID int64
}

func newIntegrationSubscriptionBillingFixture(t *testing.T, quota float64) integrationSubscriptionBillingFixture {
	t.Helper()
	ctx := context.Background()
	client := testEntClient(t)
	repo, ok := NewUsageBillingRepository(client, integrationDB).(integrationUsageBillingRepository)
	require.True(t, ok)
	user := mustCreateUser(t, client, &service.User{
		Email:        fmt.Sprintf("reservation-sub-user-%d-%s@example.com", time.Now().UnixNano(), uuid.NewString()),
		PasswordHash: "hash",
	})
	_, err := integrationDB.ExecContext(ctx, "UPDATE users SET billing_preference = $1 WHERE id = $2", service.BillingPreferenceSubscriptionOnly, user.ID)
	require.NoError(t, err)
	group := mustCreateGroup(t, client, &service.Group{
		Name:             "reservation-real-group-" + uuid.NewString(),
		Platform:         service.PlatformOpenAI,
		SubscriptionType: service.SubscriptionTypeStandard,
	})
	apiKey := mustCreateApiKey(t, client, &service.APIKey{
		UserID:  user.ID,
		GroupID: &group.ID,
		Key:     "sk-reservation-sub-" + uuid.NewString(),
		Name:    "reservation-sub",
	})
	plan, err := client.SubscriptionPlan.Create().
		AddGroupIDs(group.ID).
		SetName("reservation-plan-" + uuid.NewString()).
		SetPrice(1).
		SetCycleQuotaUsd(quota).
		SetResetIntervalSeconds(604800).
		SetWalletFallbackEnabled(false).
		SetValidityDays(28).
		SetValidityUnit("days").
		Save(ctx)
	require.NoError(t, err)
	now := time.Now().UTC()
	subscription, err := client.UserSubscription.Create().
		SetUserID(user.ID).
		SetPlanID(plan.ID).
		SetStartsAt(now).
		SetExpiresAt(now.Add(28 * 24 * time.Hour)).
		SetStatus(service.SubscriptionStatusActive).
		SetCycleQuotaUsd(quota).
		SetResetIntervalSeconds(604800).
		SetCycleStartedAt(now).
		SetWalletFallbackEnabled(false).
		Save(ctx)
	require.NoError(t, err)
	return integrationSubscriptionBillingFixture{
		repo: repo, userID: user.ID, groupID: group.ID, apiKeyID: apiKey.ID, subscriptionID: subscription.ID,
	}
}

func TestUsageBillingRepositoryApply_DeduplicatesBalanceBilling(t *testing.T) {
	ctx := context.Background()
	client := testEntClient(t)
	repo := NewUsageBillingRepository(client, integrationDB)

	user := mustCreateUser(t, client, &service.User{
		Email:        fmt.Sprintf("usage-billing-user-%d@example.com", time.Now().UnixNano()),
		PasswordHash: "hash",
		Balance:      100,
	})
	apiKey := mustCreateApiKey(t, client, &service.APIKey{
		UserID: user.ID,
		Key:    "sk-usage-billing-" + uuid.NewString(),
		Name:   "billing",
		Quota:  1,
	})
	account := mustCreateAccount(t, client, &service.Account{
		Name: "usage-billing-account-" + uuid.NewString(),
		Type: service.AccountTypeAPIKey,
	})

	requestID := uuid.NewString()
	cmd := &service.UsageBillingCommand{
		RequestID:           requestID,
		APIKeyID:            apiKey.ID,
		UserID:              user.ID,
		AccountID:           account.ID,
		AccountType:         service.AccountTypeAPIKey,
		BalanceCost:         service.BillingAmountFromFloat(1.25),
		APIKeyQuotaCost:     service.BillingAmountFromFloat(1.25),
		APIKeyRateLimitCost: service.BillingAmountFromFloat(1.25),
	}

	result1, err := repo.Apply(ctx, cmd)
	require.NoError(t, err)
	require.NotNil(t, result1)
	require.True(t, result1.Applied)
	require.True(t, result1.APIKeyQuotaExhausted)

	result2, err := repo.Apply(ctx, cmd)
	require.NoError(t, err)
	require.NotNil(t, result2)
	require.False(t, result2.Applied)

	var balance float64
	require.NoError(t, integrationDB.QueryRowContext(ctx, "SELECT balance FROM users WHERE id = $1", user.ID).Scan(&balance))
	require.InDelta(t, 98.75, balance, 0.000001)

	var quotaUsed float64
	require.NoError(t, integrationDB.QueryRowContext(ctx, "SELECT quota_used FROM api_keys WHERE id = $1", apiKey.ID).Scan(&quotaUsed))
	require.InDelta(t, 1.25, quotaUsed, 0.000001)

	var usage5h float64
	require.NoError(t, integrationDB.QueryRowContext(ctx, "SELECT usage_5h FROM api_keys WHERE id = $1", apiKey.ID).Scan(&usage5h))
	require.InDelta(t, 1.25, usage5h, 0.000001)

	var status string
	require.NoError(t, integrationDB.QueryRowContext(ctx, "SELECT status FROM api_keys WHERE id = $1", apiKey.ID).Scan(&status))
	require.Equal(t, service.StatusAPIKeyQuotaExhausted, status)

	var dedupCount int
	require.NoError(t, integrationDB.QueryRowContext(ctx, "SELECT COUNT(*) FROM usage_billing_dedup WHERE request_id = $1 AND api_key_id = $2", requestID, apiKey.ID).Scan(&dedupCount))
	require.Equal(t, 1, dedupCount)
}

func TestUsageBillingRepositoryApply_DeduplicatesSubscriptionBilling(t *testing.T) {
	ctx := context.Background()
	client := testEntClient(t)
	repo := NewUsageBillingRepository(client, integrationDB)

	user := mustCreateUser(t, client, &service.User{
		Email:        fmt.Sprintf("usage-billing-sub-user-%d@example.com", time.Now().UnixNano()),
		PasswordHash: "hash",
	})
	group := mustCreateGroup(t, client, &service.Group{
		Name:             "usage-billing-group-" + uuid.NewString(),
		Platform:         service.PlatformAnthropic,
		SubscriptionType: service.SubscriptionTypeStandard,
	})
	apiKey := mustCreateApiKey(t, client, &service.APIKey{
		UserID:  user.ID,
		GroupID: &group.ID,
		Key:     "sk-usage-billing-sub-" + uuid.NewString(),
		Name:    "billing-sub",
	})
	plan, err := client.SubscriptionPlan.Create().
		SetName("usage-billing-plan-" + uuid.NewString()).
		SetPrice(0).
		AddGroupIDs(group.ID).
		Save(ctx)
	require.NoError(t, err)
	subscription := mustCreateSubscription(t, client, &service.UserSubscription{
		UserID: user.ID,
		PlanID: plan.ID,
	})

	requestID := uuid.NewString()
	cmd := &service.UsageBillingCommand{
		RequestID:        requestID,
		APIKeyID:         apiKey.ID,
		UserID:           user.ID,
		AccountID:        0,
		SubscriptionID:   &subscription.ID,
		SubscriptionCost: service.BillingAmountFromFloat(2.5),
	}

	result1, err := repo.Apply(ctx, cmd)
	require.NoError(t, err)
	require.True(t, result1.Applied)

	result2, err := repo.Apply(ctx, cmd)
	require.NoError(t, err)
	require.False(t, result2.Applied)

	var dailyUsage float64
	require.NoError(t, integrationDB.QueryRowContext(ctx, "SELECT daily_usage_usd FROM user_subscriptions WHERE id = $1", subscription.ID).Scan(&dailyUsage))
	require.InDelta(t, 2.5, dailyUsage, 0.000001)
}

func TestUsageBillingReservation_ConcurrentRequestsDoNotExceedCycleQuota(t *testing.T) {
	ctx := context.Background()
	fixture := newIntegrationSubscriptionBillingFixture(t, 10)
	const workers = 10
	estimated := service.BillingAmountFromFloat(3)
	start := make(chan struct{})
	results := make(chan error, workers)
	requestIDs := make(chan string, workers)
	var wg sync.WaitGroup
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			requestID := uuid.NewString()
			_, err := fixture.repo.ReserveRequestBilling(ctx, &service.UsageBillingReservationCommand{
				RequestID: requestID, APIKeyID: fixture.apiKeyID, UserID: fixture.userID,
				GroupID: &fixture.groupID, EstimatedAmount: estimated,
			})
			if err == nil {
				requestIDs <- requestID
			}
			results <- err
		}()
	}
	close(start)
	wg.Wait()
	close(results)
	close(requestIDs)

	successes := 0
	quotaErrors := 0
	for err := range results {
		switch {
		case err == nil:
			successes++
		case errors.Is(err, service.ErrSubscriptionQuotaExceeded):
			quotaErrors++
		default:
			t.Fatalf("unexpected reservation error: %v", err)
		}
	}
	require.Equal(t, 3, successes)
	require.Equal(t, workers-successes, quotaErrors)

	var reserved float64
	require.NoError(t, integrationDB.QueryRowContext(ctx, "SELECT cycle_reserved_usd FROM user_subscriptions WHERE id = $1", fixture.subscriptionID).Scan(&reserved))
	require.InDelta(t, 9, reserved, 0.000001)
	var pending int
	require.NoError(t, integrationDB.QueryRowContext(ctx, "SELECT COUNT(*) FROM billing_reservations WHERE subscription_id = $1 AND status = 'pending'", fixture.subscriptionID).Scan(&pending))
	require.Equal(t, 3, pending)

	for requestID := range requestIDs {
		_, err := fixture.repo.ReleaseRequestBilling(ctx, &service.UsageBillingReservationReleaseCommand{
			RequestID: requestID, APIKeyID: fixture.apiKeyID, UserID: fixture.userID,
		})
		require.NoError(t, err)
	}
}

func TestUsageBillingReservation_SettlesActualCostAboveSubscriptionEstimate(t *testing.T) {
	ctx := context.Background()
	fixture := newIntegrationSubscriptionBillingFixture(t, 5)
	requestID := uuid.NewString()
	payloadHash := service.HashUsageRequestPayload([]byte("subscription-overage"))
	_, err := fixture.repo.ReserveRequestBilling(ctx, &service.UsageBillingReservationCommand{
		RequestID: requestID, APIKeyID: fixture.apiKeyID, RequestPayloadHash: payloadHash,
		UserID: fixture.userID, GroupID: &fixture.groupID, EstimatedAmount: service.BillingAmountFromFloat(5),
	})
	require.NoError(t, err)

	result, err := fixture.repo.Apply(ctx, &service.UsageBillingCommand{
		RequestID: requestID, APIKeyID: fixture.apiKeyID, RequestPayloadHash: payloadHash,
		UserID: fixture.userID, GroupID: &fixture.groupID, ResolveBillingSource: true,
		BillableCost: service.BillingAmountFromFloat(7),
	})
	require.NoError(t, err)
	require.True(t, result.Applied)
	require.Equal(t, service.BillingSourceSubscription, result.BillingSource)

	var usage, reserved float64
	require.NoError(t, integrationDB.QueryRowContext(ctx, "SELECT cycle_usage_usd, cycle_reserved_usd FROM user_subscriptions WHERE id = $1", fixture.subscriptionID).Scan(&usage, &reserved))
	require.InDelta(t, 7, usage, 0.000001)
	require.InDelta(t, 0, reserved, 0.000001)
	var status string
	require.NoError(t, integrationDB.QueryRowContext(ctx, "SELECT status FROM billing_reservations WHERE request_id = $1 AND api_key_id = $2", requestID, fixture.apiKeyID).Scan(&status))
	require.Equal(t, "settled", status)
}

func TestUsageBillingReservation_SettlesWalletOverageAsDebt(t *testing.T) {
	ctx := context.Background()
	client := testEntClient(t)
	repo := NewUsageBillingRepository(client, integrationDB).(integrationUsageBillingRepository)
	user := mustCreateUser(t, client, &service.User{
		Email: fmt.Sprintf("reservation-wallet-user-%d@example.com", time.Now().UnixNano()), PasswordHash: "hash", Balance: 5,
	})
	_, err := integrationDB.ExecContext(ctx, "UPDATE users SET billing_preference = $1 WHERE id = $2", service.BillingPreferenceWalletOnly, user.ID)
	require.NoError(t, err)
	apiKey := mustCreateApiKey(t, client, &service.APIKey{UserID: user.ID, Key: "sk-reservation-wallet-" + uuid.NewString(), Name: "wallet"})
	requestID := uuid.NewString()
	payloadHash := service.HashUsageRequestPayload([]byte("wallet-overage"))
	_, err = repo.ReserveRequestBilling(ctx, &service.UsageBillingReservationCommand{
		RequestID: requestID, APIKeyID: apiKey.ID, RequestPayloadHash: payloadHash,
		UserID: user.ID, EstimatedAmount: service.BillingAmountFromFloat(5),
	})
	require.NoError(t, err)
	result, err := repo.Apply(ctx, &service.UsageBillingCommand{
		RequestID: requestID, APIKeyID: apiKey.ID, RequestPayloadHash: payloadHash,
		UserID: user.ID, ResolveBillingSource: true, BillableCost: service.BillingAmountFromFloat(7),
	})
	require.NoError(t, err)
	require.True(t, result.BalanceOverdrafted)
	require.NotNil(t, result.NewBalance)
	require.True(t, result.NewBalance.Equal(service.BillingAmountFromFloat(-2)))

	var balance, frozen float64
	require.NoError(t, integrationDB.QueryRowContext(ctx, "SELECT balance, frozen_balance FROM users WHERE id = $1", user.ID).Scan(&balance, &frozen))
	require.InDelta(t, -2, balance, 0.000001)
	require.InDelta(t, 0, frozen, 0.000001)
}

func TestUsageBillingReservation_SettleAndCleanupHaveOneTerminalState(t *testing.T) {
	ctx := context.Background()
	client := testEntClient(t)
	repo := NewUsageBillingRepository(client, integrationDB).(integrationUsageBillingRepository)
	user := mustCreateUser(t, client, &service.User{
		Email: fmt.Sprintf("reservation-race-user-%d@example.com", time.Now().UnixNano()), PasswordHash: "hash", Balance: 10,
	})
	_, err := integrationDB.ExecContext(ctx, "UPDATE users SET billing_preference = $1 WHERE id = $2", service.BillingPreferenceWalletOnly, user.ID)
	require.NoError(t, err)
	apiKey := mustCreateApiKey(t, client, &service.APIKey{UserID: user.ID, Key: "sk-reservation-race-" + uuid.NewString(), Name: "race"})
	requestID := uuid.NewString()
	payloadHash := service.HashUsageRequestPayload([]byte("settle-cleanup-race"))
	_, err = repo.ReserveRequestBilling(ctx, &service.UsageBillingReservationCommand{
		RequestID: requestID, APIKeyID: apiKey.ID, RequestPayloadHash: payloadHash,
		UserID: user.ID, EstimatedAmount: service.BillingAmountFromFloat(5),
	})
	require.NoError(t, err)
	_, err = integrationDB.ExecContext(ctx, "UPDATE billing_reservations SET lease_expires_at = NOW() - INTERVAL '1 second' WHERE request_id = $1 AND api_key_id = $2", requestID, apiKey.ID)
	require.NoError(t, err)

	start := make(chan struct{})
	var applyErr, cleanupErr error
	var released int
	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		<-start
		_, applyErr = repo.Apply(ctx, &service.UsageBillingCommand{
			RequestID: requestID, APIKeyID: apiKey.ID, RequestPayloadHash: payloadHash,
			UserID: user.ID, ResolveBillingSource: true, BillableCost: service.BillingAmountFromFloat(2),
		})
	}()
	go func() {
		defer wg.Done()
		<-start
		released, cleanupErr = repo.ReleaseExpiredRequestBilling(ctx, 1)
	}()
	close(start)
	wg.Wait()
	require.NoError(t, cleanupErr)

	var status string
	var balance, frozen float64
	require.NoError(t, integrationDB.QueryRowContext(ctx, "SELECT status FROM billing_reservations WHERE request_id = $1 AND api_key_id = $2", requestID, apiKey.ID).Scan(&status))
	require.NoError(t, integrationDB.QueryRowContext(ctx, "SELECT balance, frozen_balance FROM users WHERE id = $1", user.ID).Scan(&balance, &frozen))
	require.InDelta(t, 0, frozen, 0.000001)
	switch status {
	case "settled":
		require.NoError(t, applyErr)
		require.Equal(t, 0, released)
		require.InDelta(t, 8, balance, 0.000001)
	case "released":
		require.ErrorIs(t, applyErr, service.ErrUsageBillingReservationReleased)
		require.Equal(t, 1, released)
		require.InDelta(t, 10, balance, 0.000001)
	default:
		t.Fatalf("unexpected reservation status %q", status)
	}
}

func TestUsageBillingReservation_ConcurrentCleanupDoesNotDoubleRefund(t *testing.T) {
	ctx := context.Background()
	client := testEntClient(t)
	repo := NewUsageBillingRepository(client, integrationDB).(integrationUsageBillingRepository)
	user := mustCreateUser(t, client, &service.User{
		Email: fmt.Sprintf("reservation-cleanup-user-%d@example.com", time.Now().UnixNano()), PasswordHash: "hash", Balance: 10,
	})
	_, err := integrationDB.ExecContext(ctx, "UPDATE users SET billing_preference = $1 WHERE id = $2", service.BillingPreferenceWalletOnly, user.ID)
	require.NoError(t, err)
	apiKey := mustCreateApiKey(t, client, &service.APIKey{UserID: user.ID, Key: "sk-reservation-cleanup-" + uuid.NewString(), Name: "cleanup"})
	requestID := uuid.NewString()
	_, err = repo.ReserveRequestBilling(ctx, &service.UsageBillingReservationCommand{
		RequestID: requestID, APIKeyID: apiKey.ID, UserID: user.ID, EstimatedAmount: service.BillingAmountFromFloat(4),
	})
	require.NoError(t, err)
	_, err = integrationDB.ExecContext(ctx, "UPDATE billing_reservations SET lease_expires_at = NOW() - INTERVAL '1 second' WHERE request_id = $1 AND api_key_id = $2", requestID, apiKey.ID)
	require.NoError(t, err)

	start := make(chan struct{})
	counts := make(chan int, 2)
	errs := make(chan error, 2)
	var wg sync.WaitGroup
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			count, cleanupErr := repo.ReleaseExpiredRequestBilling(ctx, 1)
			counts <- count
			errs <- cleanupErr
		}()
	}
	close(start)
	wg.Wait()
	close(counts)
	close(errs)
	totalReleased := 0
	for count := range counts {
		totalReleased += count
	}
	for cleanupErr := range errs {
		require.NoError(t, cleanupErr)
	}
	require.Equal(t, 1, totalReleased)

	var balance, frozen float64
	require.NoError(t, integrationDB.QueryRowContext(ctx, "SELECT balance, frozen_balance FROM users WHERE id = $1", user.ID).Scan(&balance, &frozen))
	require.InDelta(t, 10, balance, 0.000001)
	require.InDelta(t, 0, frozen, 0.000001)
}

func TestUsageBillingRepositoryApply_RequestFingerprintConflict(t *testing.T) {
	ctx := context.Background()
	client := testEntClient(t)
	repo := NewUsageBillingRepository(client, integrationDB)

	user := mustCreateUser(t, client, &service.User{
		Email:        fmt.Sprintf("usage-billing-conflict-user-%d@example.com", time.Now().UnixNano()),
		PasswordHash: "hash",
		Balance:      100,
	})
	apiKey := mustCreateApiKey(t, client, &service.APIKey{
		UserID: user.ID,
		Key:    "sk-usage-billing-conflict-" + uuid.NewString(),
		Name:   "billing-conflict",
	})

	requestID := uuid.NewString()
	_, err := repo.Apply(ctx, &service.UsageBillingCommand{
		RequestID:   requestID,
		APIKeyID:    apiKey.ID,
		UserID:      user.ID,
		BalanceCost: service.BillingAmountFromFloat(1.25),
	})
	require.NoError(t, err)

	_, err = repo.Apply(ctx, &service.UsageBillingCommand{
		RequestID:   requestID,
		APIKeyID:    apiKey.ID,
		UserID:      user.ID,
		BalanceCost: service.BillingAmountFromFloat(2.50),
	})
	require.ErrorIs(t, err, service.ErrUsageBillingRequestConflict)
}

func TestUsageBillingRepositoryApply_UpdatesAccountQuota(t *testing.T) {
	ctx := context.Background()
	client := testEntClient(t)
	repo := NewUsageBillingRepository(client, integrationDB)

	user := mustCreateUser(t, client, &service.User{
		Email:        fmt.Sprintf("usage-billing-account-user-%d@example.com", time.Now().UnixNano()),
		PasswordHash: "hash",
	})
	apiKey := mustCreateApiKey(t, client, &service.APIKey{
		UserID: user.ID,
		Key:    "sk-usage-billing-account-" + uuid.NewString(),
		Name:   "billing-account",
	})
	account := mustCreateAccount(t, client, &service.Account{
		Name: "usage-billing-account-quota-" + uuid.NewString(),
		Type: service.AccountTypeAPIKey,
		Extra: map[string]any{
			"quota_limit": 100.0,
		},
	})

	_, err := repo.Apply(ctx, &service.UsageBillingCommand{
		RequestID:        uuid.NewString(),
		APIKeyID:         apiKey.ID,
		UserID:           user.ID,
		AccountID:        account.ID,
		AccountType:      service.AccountTypeAPIKey,
		AccountQuotaCost: service.BillingAmountFromFloat(3.5),
	})
	require.NoError(t, err)

	var quotaUsed float64
	require.NoError(t, integrationDB.QueryRowContext(ctx, "SELECT COALESCE((extra->>'quota_used')::numeric, 0) FROM accounts WHERE id = $1", account.ID).Scan(&quotaUsed))
	require.InDelta(t, 3.5, quotaUsed, 0.000001)
}

func TestUsageBillingRepositoryApply_EnqueuesSchedulerOutboxOnQuotaCrossing(t *testing.T) {
	ctx := context.Background()
	client := testEntClient(t)
	repo := NewUsageBillingRepository(client, integrationDB)

	newFixture := func(t *testing.T, extra map[string]any) (int64, int64) {
		t.Helper()
		user := mustCreateUser(t, client, &service.User{
			Email:        fmt.Sprintf("usage-billing-outbox-user-%d-%s@example.com", time.Now().UnixNano(), uuid.NewString()),
			PasswordHash: "hash",
		})
		apiKey := mustCreateApiKey(t, client, &service.APIKey{
			UserID: user.ID,
			Key:    "sk-usage-billing-outbox-" + uuid.NewString(),
			Name:   "billing-outbox",
		})
		account := mustCreateAccount(t, client, &service.Account{
			Name:  "usage-billing-outbox-" + uuid.NewString(),
			Type:  service.AccountTypeAPIKey,
			Extra: extra,
		})
		return apiKey.ID, account.ID
	}

	outboxCountFor := func(t *testing.T, accountID int64) int {
		t.Helper()
		var count int
		require.NoError(t, integrationDB.QueryRowContext(ctx,
			"SELECT COUNT(*) FROM scheduler_outbox WHERE event_type = $1 AND account_id = $2",
			service.SchedulerOutboxEventAccountChanged, accountID,
		).Scan(&count))
		return count
	}

	t.Run("daily_first_crossing_enqueues", func(t *testing.T) {
		apiKeyID, accountID := newFixture(t, map[string]any{
			"quota_daily_limit": 10.0,
		})
		// 第一次低于日限额：不应入队 outbox
		_, err := repo.Apply(ctx, &service.UsageBillingCommand{
			RequestID:        uuid.NewString(),
			APIKeyID:         apiKeyID,
			AccountID:        accountID,
			AccountType:      service.AccountTypeAPIKey,
			AccountQuotaCost: service.BillingAmountFromFloat(4),
		})
		require.NoError(t, err)
		require.Equal(t, 0, outboxCountFor(t, accountID), "below limit should not enqueue")

		// 第二次跨越日限额：应入队一次 outbox
		_, err = repo.Apply(ctx, &service.UsageBillingCommand{
			RequestID:        uuid.NewString(),
			APIKeyID:         apiKeyID,
			AccountID:        accountID,
			AccountType:      service.AccountTypeAPIKey,
			AccountQuotaCost: service.BillingAmountFromFloat(8),
		})
		require.NoError(t, err)
		require.Equal(t, 1, outboxCountFor(t, accountID), "crossing daily limit should enqueue once")

		// 再次递增（已超）：不应重复入队
		_, err = repo.Apply(ctx, &service.UsageBillingCommand{
			RequestID:        uuid.NewString(),
			APIKeyID:         apiKeyID,
			AccountID:        accountID,
			AccountType:      service.AccountTypeAPIKey,
			AccountQuotaCost: service.BillingAmountFromFloat(2),
		})
		require.NoError(t, err)
		require.Equal(t, 1, outboxCountFor(t, accountID), "subsequent increments beyond limit should not re-enqueue")
	})

	t.Run("weekly_first_crossing_enqueues", func(t *testing.T) {
		apiKeyID, accountID := newFixture(t, map[string]any{
			"quota_weekly_limit": 10.0,
		})
		_, err := repo.Apply(ctx, &service.UsageBillingCommand{
			RequestID:        uuid.NewString(),
			APIKeyID:         apiKeyID,
			AccountID:        accountID,
			AccountType:      service.AccountTypeAPIKey,
			AccountQuotaCost: service.BillingAmountFromFloat(15), // 单次即跨越
		})
		require.NoError(t, err)
		require.Equal(t, 1, outboxCountFor(t, accountID), "single-shot crossing weekly limit should enqueue once")
	})
}

func TestDashboardAggregationRepositoryCleanupUsageBillingDedup_BatchDeletesOldRows(t *testing.T) {
	ctx := context.Background()
	repo := newDashboardAggregationRepositoryWithSQL(integrationDB)

	oldRequestID := "dedup-old-" + uuid.NewString()
	newRequestID := "dedup-new-" + uuid.NewString()
	oldCreatedAt := time.Now().UTC().AddDate(0, 0, -400)
	newCreatedAt := time.Now().UTC().Add(-time.Hour)

	_, err := integrationDB.ExecContext(ctx, `
		INSERT INTO usage_billing_dedup (request_id, api_key_id, request_fingerprint, created_at)
		VALUES ($1, 1, $2, $3), ($4, 1, $5, $6)
	`,
		oldRequestID, strings.Repeat("a", 64), oldCreatedAt,
		newRequestID, strings.Repeat("b", 64), newCreatedAt,
	)
	require.NoError(t, err)

	require.NoError(t, repo.CleanupUsageBillingDedup(ctx, time.Now().UTC().AddDate(0, 0, -365)))

	var oldCount int
	require.NoError(t, integrationDB.QueryRowContext(ctx, "SELECT COUNT(*) FROM usage_billing_dedup WHERE request_id = $1", oldRequestID).Scan(&oldCount))
	require.Equal(t, 0, oldCount)

	var newCount int
	require.NoError(t, integrationDB.QueryRowContext(ctx, "SELECT COUNT(*) FROM usage_billing_dedup WHERE request_id = $1", newRequestID).Scan(&newCount))
	require.Equal(t, 1, newCount)

	var archivedCount int
	require.NoError(t, integrationDB.QueryRowContext(ctx, "SELECT COUNT(*) FROM usage_billing_dedup_archive WHERE request_id = $1", oldRequestID).Scan(&archivedCount))
	require.Equal(t, 1, archivedCount)
}

func TestUsageBillingRepositoryApply_DeduplicatesAgainstArchivedKey(t *testing.T) {
	ctx := context.Background()
	client := testEntClient(t)
	repo := NewUsageBillingRepository(client, integrationDB)
	aggRepo := newDashboardAggregationRepositoryWithSQL(integrationDB)

	user := mustCreateUser(t, client, &service.User{
		Email:        fmt.Sprintf("usage-billing-archive-user-%d@example.com", time.Now().UnixNano()),
		PasswordHash: "hash",
		Balance:      100,
	})
	apiKey := mustCreateApiKey(t, client, &service.APIKey{
		UserID: user.ID,
		Key:    "sk-usage-billing-archive-" + uuid.NewString(),
		Name:   "billing-archive",
	})

	requestID := uuid.NewString()
	cmd := &service.UsageBillingCommand{
		RequestID:   requestID,
		APIKeyID:    apiKey.ID,
		UserID:      user.ID,
		BalanceCost: service.BillingAmountFromFloat(1.25),
	}

	result1, err := repo.Apply(ctx, cmd)
	require.NoError(t, err)
	require.True(t, result1.Applied)

	_, err = integrationDB.ExecContext(ctx, `
		UPDATE usage_billing_dedup
		SET created_at = $1
		WHERE request_id = $2 AND api_key_id = $3
	`, time.Now().UTC().AddDate(0, 0, -400), requestID, apiKey.ID)
	require.NoError(t, err)
	require.NoError(t, aggRepo.CleanupUsageBillingDedup(ctx, time.Now().UTC().AddDate(0, 0, -365)))

	result2, err := repo.Apply(ctx, cmd)
	require.NoError(t, err)
	require.False(t, result2.Applied)

	var balance float64
	require.NoError(t, integrationDB.QueryRowContext(ctx, "SELECT balance FROM users WHERE id = $1", user.ID).Scan(&balance))
	require.InDelta(t, 98.75, balance, 0.000001)
}
