//go:build unit

package service

import (
	"context"
	"fmt"
	"testing"
	"time"

	dbent "github.com/Wei-Shaw/sub2api/ent"
	"github.com/Wei-Shaw/sub2api/internal/payment"
	"github.com/stretchr/testify/require"
)

func validV5SubscriptionOrderSnapshot(mode string, targetID int64) map[string]any {
	return map[string]any{
		"schema_version":             subscriptionPlanOrderSnapshotMultiInstanceVersion,
		"plan_id":                    int64(7),
		"plan_name":                  "Pro",
		"included_group_ids":         []int64{3},
		"validity_days":              30,
		"purchase_mode":              mode,
		"target_subscription_id":     targetID,
		"max_subscriptions_per_user": 2,
	}
}

func TestSubscriptionPlanOrderSnapshotFromOrderV5Validation(t *testing.T) {
	valid := []struct {
		name   string
		mode   string
		target int64
	}{
		{name: "new instance", mode: PurchaseModeNewInstance},
		{name: "renew instance", mode: PurchaseModeRenewInstance, target: 42},
	}
	for _, test := range valid {
		t.Run(test.name, func(t *testing.T) {
			snapshot, ok, err := subscriptionPlanOrderSnapshotFromOrder(&dbent.PaymentOrder{
				SubscriptionPlanSnapshot: validV5SubscriptionOrderSnapshot(test.mode, test.target),
			})
			require.NoError(t, err)
			require.True(t, ok)
			require.Equal(t, test.mode, snapshot.PurchaseMode)
			require.Equal(t, test.target, snapshot.TargetSubscriptionID)
			require.Equal(t, 2, snapshot.MaxSubscriptionsPerUser)
		})
	}

	invalid := []struct {
		name   string
		mutate func(map[string]any)
	}{
		{name: "zero limit", mutate: func(snapshot map[string]any) { snapshot["max_subscriptions_per_user"] = 0 }},
		{name: "missing mode", mutate: func(snapshot map[string]any) { snapshot["purchase_mode"] = "" }},
		{name: "unknown mode", mutate: func(snapshot map[string]any) { snapshot["purchase_mode"] = "replace_instance" }},
		{name: "new with target", mutate: func(snapshot map[string]any) { snapshot["target_subscription_id"] = int64(1) }},
		{name: "renew without target", mutate: func(snapshot map[string]any) {
			snapshot["purchase_mode"] = PurchaseModeRenewInstance
			snapshot["target_subscription_id"] = int64(0)
		}},
	}
	for _, test := range invalid {
		t.Run(test.name, func(t *testing.T) {
			raw := validV5SubscriptionOrderSnapshot(PurchaseModeNewInstance, 0)
			test.mutate(raw)
			_, ok, err := subscriptionPlanOrderSnapshotFromOrder(&dbent.PaymentOrder{SubscriptionPlanSnapshot: raw})
			require.Error(t, err)
			require.False(t, ok)
		})
	}
}

func newSubscriptionOrderSlotFixture(t *testing.T, max int) (*PaymentService, *subscriptionUserSubRepoStub, *dbent.Client, context.Context, int64, int64) {
	t.Helper()
	client := newPaymentConfigServiceTestClient(t)
	ctx := context.Background()
	user, err := client.User.Create().
		SetEmail(fmt.Sprintf("%s@example.com", t.Name())).
		SetPasswordHash("hash").
		Save(ctx)
	require.NoError(t, err)
	group, err := client.Group.Create().SetName("slot-group").SetStatus(StatusActive).Save(ctx)
	require.NoError(t, err)
	plan, err := client.SubscriptionPlan.Create().
		SetName("slot-plan").
		SetPrice(10).
		SetValidityDays(30).
		SetValidityUnit("days").
		SetMaxSubscriptionsPerUser(max).
		AddGroupIDs(group.ID).
		Save(ctx)
	require.NoError(t, err)
	repo := newSubscriptionUserSubRepoStub()
	subscriptionSvc := NewSubscriptionService(nil, repo, nil, nil, nil)
	t.Cleanup(subscriptionSvc.Stop)
	return &PaymentService{entClient: client, subscriptionSvc: subscriptionSvc}, repo, client, ctx, user.ID, plan.ID
}

func prepareSubscriptionOrderSlotForTest(t *testing.T, svc *PaymentService, client *dbent.Client, ctx context.Context, req CreateOrderRequest, planID int64) (string, int64, error) {
	t.Helper()
	tx, err := client.Tx(ctx)
	require.NoError(t, err)
	defer func() { _ = tx.Rollback() }()
	_, mode, targetID, err := svc.prepareSubscriptionOrderSlot(dbent.NewTxContext(ctx, tx), tx, req, planID)
	return mode, targetID, err
}

func TestPrepareSubscriptionOrderSlotDefaultModeAndTargetScope(t *testing.T) {
	t.Run("single limit renews active instance", func(t *testing.T) {
		svc, repo, client, ctx, userID, planID := newSubscriptionOrderSlotFixture(t, 1)
		repo.seed(&UserSubscription{ID: 11, UserID: userID, PlanID: planID, Status: SubscriptionStatusActive, ExpiresAt: time.Now().Add(time.Hour)})
		mode, targetID, err := prepareSubscriptionOrderSlotForTest(t, svc, client, ctx, CreateOrderRequest{UserID: userID}, planID)
		require.NoError(t, err)
		require.Equal(t, PurchaseModeRenewInstance, mode)
		require.Equal(t, int64(11), targetID)
	})

	t.Run("single limit renews suspended instance", func(t *testing.T) {
		svc, repo, client, ctx, userID, planID := newSubscriptionOrderSlotFixture(t, 1)
		repo.seed(&UserSubscription{ID: 12, UserID: userID, PlanID: planID, Status: SubscriptionStatusSuspended, ExpiresAt: time.Now().Add(time.Hour)})
		mode, targetID, err := prepareSubscriptionOrderSlotForTest(t, svc, client, ctx, CreateOrderRequest{UserID: userID}, planID)
		require.NoError(t, err)
		require.Equal(t, PurchaseModeRenewInstance, mode)
		require.Equal(t, int64(12), targetID)
	})

	t.Run("multi limit defaults to new instance", func(t *testing.T) {
		svc, repo, client, ctx, userID, planID := newSubscriptionOrderSlotFixture(t, 2)
		repo.seed(&UserSubscription{ID: 13, UserID: userID, PlanID: planID, Status: SubscriptionStatusActive, ExpiresAt: time.Now().Add(time.Hour)})
		mode, targetID, err := prepareSubscriptionOrderSlotForTest(t, svc, client, ctx, CreateOrderRequest{UserID: userID}, planID)
		require.NoError(t, err)
		require.Equal(t, PurchaseModeNewInstance, mode)
		require.Zero(t, targetID)
	})

	t.Run("explicit renewal rejects foreign target", func(t *testing.T) {
		svc, repo, client, ctx, userID, planID := newSubscriptionOrderSlotFixture(t, 2)
		repo.seed(&UserSubscription{ID: 14, UserID: userID + 1, PlanID: planID, Status: SubscriptionStatusActive, ExpiresAt: time.Now().Add(time.Hour)})
		_, _, err := prepareSubscriptionOrderSlotForTest(t, svc, client, ctx, CreateOrderRequest{
			UserID: userID, PurchaseMode: PurchaseModeRenewInstance, TargetSubscriptionID: 14,
		}, planID)
		require.ErrorIs(t, err, ErrSubscriptionTargetMismatch)
	})
}

func createSubscriptionSlotOrder(t *testing.T, client *dbent.Client, ctx context.Context, userID, planID int64, status string, expiresAt time.Time, snapshot map[string]any, fulfilledID int64) {
	t.Helper()
	builder := client.PaymentOrder.Create().
		SetUserID(userID).
		SetUserEmail(fmt.Sprintf("%d@example.com", userID)).
		SetUserName("slot-user").
		SetAmount(10).
		SetPayAmount(10).
		SetRechargeCode(fmt.Sprintf("slot-%s-%d", status, time.Now().UnixNano())).
		SetOutTradeNo(fmt.Sprintf("slot_trade_%d", time.Now().UnixNano())).
		SetPaymentType(payment.TypeAlipay).
		SetPaymentTradeNo("").
		SetOrderType(payment.OrderTypeSubscription).
		SetPlanID(planID).
		SetSubscriptionDays(30).
		SetSubscriptionPlanSnapshot(snapshot).
		SetStatus(status).
		SetExpiresAt(expiresAt).
		SetClientIP("127.0.0.1").
		SetSrcHost("example.com")
	if fulfilledID > 0 {
		builder.SetFulfilledSubscriptionID(fulfilledID)
	}
	_, err := builder.Save(ctx)
	require.NoError(t, err)
}

func TestCountPendingSubscriptionInstanceSlotsStatusMatrix(t *testing.T) {
	now := time.Now()
	tests := []struct {
		name        string
		status      string
		expiresAt   time.Time
		snapshot    map[string]any
		fulfilledID int64
		want        int
	}{
		{name: "pending unexpired", status: OrderStatusPending, expiresAt: now.Add(time.Hour), snapshot: validV5SubscriptionOrderSnapshot(PurchaseModeNewInstance, 0), want: 1},
		{name: "pending expired", status: OrderStatusPending, expiresAt: now.Add(-time.Hour), snapshot: validV5SubscriptionOrderSnapshot(PurchaseModeNewInstance, 0)},
		{name: "paid ignores expiry", status: OrderStatusPaid, expiresAt: now.Add(-time.Hour), snapshot: validV5SubscriptionOrderSnapshot(PurchaseModeNewInstance, 0), want: 1},
		{name: "recharging ignores expiry", status: OrderStatusRecharging, expiresAt: now.Add(-time.Hour), snapshot: validV5SubscriptionOrderSnapshot(PurchaseModeNewInstance, 0), want: 1},
		{name: "failed", status: OrderStatusFailed, expiresAt: now.Add(time.Hour), snapshot: validV5SubscriptionOrderSnapshot(PurchaseModeNewInstance, 0)},
		{name: "cancelled", status: OrderStatusCancelled, expiresAt: now.Add(time.Hour), snapshot: validV5SubscriptionOrderSnapshot(PurchaseModeNewInstance, 0)},
		{name: "fulfilled", status: OrderStatusPaid, expiresAt: now.Add(time.Hour), snapshot: validV5SubscriptionOrderSnapshot(PurchaseModeNewInstance, 0), fulfilledID: 99},
		{name: "renewal", status: OrderStatusPaid, expiresAt: now.Add(time.Hour), snapshot: validV5SubscriptionOrderSnapshot(PurchaseModeRenewInstance, 42)},
		{name: "legacy v4", status: OrderStatusPaid, expiresAt: now.Add(time.Hour), want: 1, snapshot: map[string]any{
			"schema_version": 4, "plan_id": int64(7), "included_group_ids": []int64{3}, "validity_days": 30,
		}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			_, _, client, ctx, userID, planID := newSubscriptionOrderSlotFixture(t, 2)
			createSubscriptionSlotOrder(t, client, ctx, userID, planID, test.status, test.expiresAt, test.snapshot, test.fulfilledID)
			tx, err := client.Tx(ctx)
			require.NoError(t, err)
			defer func() { _ = tx.Rollback() }()
			got, err := countPendingSubscriptionInstanceSlots(dbent.NewTxContext(ctx, tx), tx, userID, planID, now)
			require.NoError(t, err)
			require.Equal(t, test.want, got)
		})
	}
}
