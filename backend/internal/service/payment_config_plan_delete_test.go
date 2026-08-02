package service

import (
	"context"
	"net/http"
	"testing"
	"time"

	dbent "github.com/Wei-Shaw/sub2api/ent"
	infraerrors "github.com/Wei-Shaw/sub2api/internal/pkg/errors"
	"github.com/stretchr/testify/require"
)

func TestPaymentConfigServiceDeletePlanWithoutSubscriptions(t *testing.T) {
	ctx := context.Background()
	client := newPaymentConfigServiceTestClient(t)
	svc := &PaymentConfigService{entClient: client}
	plan, _ := createPlanDeleteFixture(t, ctx, client, false)

	require.NoError(t, svc.DeletePlan(ctx, plan.ID))
	_, err := client.SubscriptionPlan.Get(ctx, plan.ID)
	require.True(t, dbent.IsNotFound(err))
}

func TestPaymentConfigServiceDeletePlanRejectsExistingSubscriptions(t *testing.T) {
	for _, tc := range []struct {
		name       string
		softDelete bool
	}{
		{name: "active subscription"},
		{name: "soft-deleted subscription history", softDelete: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx := context.Background()
			client := newPaymentConfigServiceTestClient(t)
			svc := &PaymentConfigService{entClient: client}
			plan, subscription := createPlanDeleteFixture(t, ctx, client, true)
			if tc.softDelete {
				require.NoError(t, client.UserSubscription.DeleteOneID(subscription.ID).Exec(ctx))
			}

			err := svc.DeletePlan(ctx, plan.ID)
			require.Error(t, err)
			require.Equal(t, "PLAN_HAS_SUBSCRIPTIONS", infraerrors.Reason(err))
			_, getErr := client.SubscriptionPlan.Get(ctx, plan.ID)
			require.NoError(t, getErr)
		})
	}
}

func TestPaymentConfigServiceUpdatePlanRequiresGroupRemovalConfirmation(t *testing.T) {
	ctx := context.Background()
	client := newPaymentConfigServiceTestClient(t)
	svc := &PaymentConfigService{entClient: client}

	primaryGroup, err := client.Group.Create().SetName("plan-update-primary").Save(ctx)
	require.NoError(t, err)
	removedGroup, err := client.Group.Create().SetName("plan-update-removed").Save(ctx)
	require.NoError(t, err)
	plan, err := client.SubscriptionPlan.Create().
		SetName("plan-update-test").
		SetPrice(10).
		AddGroupIDs(primaryGroup.ID, removedGroup.ID).
		Save(ctx)
	require.NoError(t, err)
	user, err := client.User.Create().
		SetEmail("plan-update@example.com").
		SetPasswordHash("hash").
		Save(ctx)
	require.NoError(t, err)
	now := time.Now().UTC()
	_, err = client.UserSubscription.Create().
		SetUserID(user.ID).
		SetPlanID(plan.ID).
		SetStartsAt(now).
		SetExpiresAt(now.Add(24 * time.Hour)).
		SetStatus(SubscriptionStatusActive).
		Save(ctx)
	require.NoError(t, err)

	includedGroupIDs := []int64{primaryGroup.ID}
	request := UpdatePlanRequest{IncludedGroupIDs: &includedGroupIDs}
	_, err = svc.UpdatePlan(ctx, plan.ID, request)
	require.Error(t, err)
	require.Equal(t, http.StatusConflict, infraerrors.Code(err))
	require.Equal(t, "PLAN_GROUP_REMOVAL_CONFIRMATION_REQUIRED", infraerrors.Reason(err))
	require.Equal(t, "1", infraerrors.FromError(err).Metadata["affected_subscriptions"])

	unchanged, err := svc.GetPlan(ctx, plan.ID)
	require.NoError(t, err)
	require.ElementsMatch(t, []int64{primaryGroup.ID, removedGroup.ID}, planIncludedGroupIDs(unchanged))

	request.ConfirmGroupRemoval = true
	updated, err := svc.UpdatePlan(ctx, plan.ID, request)
	require.NoError(t, err)
	require.Equal(t, []int64{primaryGroup.ID}, planIncludedGroupIDs(updated))
}

func TestPaymentConfigServicePlanGroupsDoNotRequireAPrimarySelection(t *testing.T) {
	ctx := context.Background()
	client := newPaymentConfigServiceTestClient(t)
	svc := &PaymentConfigService{entClient: client}

	groupOne, err := client.Group.Create().SetName("plan-group-one").Save(ctx)
	require.NoError(t, err)
	groupTwo, err := client.Group.Create().SetName("plan-group-two").Save(ctx)
	require.NoError(t, err)

	created, err := svc.CreatePlan(ctx, CreatePlanRequest{
		IncludedGroupIDs: []int64{groupOne.ID, groupTwo.ID},
		Name:             "equal-groups-plan",
		Description:      "both groups use the same subscription quota",
		Price:            10,
		ValidityDays:     28,
		ValidityUnit:     "days",
		ForSale:          true,
	})
	require.NoError(t, err)
	require.ElementsMatch(t, []int64{groupOne.ID, groupTwo.ID}, planIncludedGroupIDs(created))

	includedGroupIDs := []int64{groupTwo.ID}
	updated, err := svc.UpdatePlan(ctx, created.ID, UpdatePlanRequest{
		IncludedGroupIDs:    &includedGroupIDs,
		ConfirmGroupRemoval: true,
	})
	require.NoError(t, err)
	require.Equal(t, []int64{groupTwo.ID}, planIncludedGroupIDs(updated))
}

func createPlanDeleteFixture(
	t *testing.T,
	ctx context.Context,
	client *dbent.Client,
	withSubscription bool,
) (*dbent.SubscriptionPlan, *dbent.UserSubscription) {
	t.Helper()
	group, err := client.Group.Create().SetName("plan-delete-group").Save(ctx)
	require.NoError(t, err)
	plan, err := client.SubscriptionPlan.Create().
		SetName("plan-delete-test").
		SetPrice(10).
		AddGroupIDs(group.ID).
		Save(ctx)
	require.NoError(t, err)
	if !withSubscription {
		return plan, nil
	}
	user, err := client.User.Create().
		SetEmail("plan-delete@example.com").
		SetPasswordHash("hash").
		Save(ctx)
	require.NoError(t, err)
	now := time.Now().UTC()
	subscription, err := client.UserSubscription.Create().
		SetUserID(user.ID).
		SetPlanID(plan.ID).
		SetStartsAt(now).
		SetExpiresAt(now.Add(24 * time.Hour)).
		Save(ctx)
	require.NoError(t, err)
	return plan, subscription
}
