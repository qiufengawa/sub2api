//go:build unit

package service_test

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"entgo.io/ent/dialect"
	entsql "entgo.io/ent/dialect/sql"
	"github.com/stretchr/testify/require"
	_ "modernc.org/sqlite"

	dbent "github.com/Wei-Shaw/sub2api/ent"
	"github.com/Wei-Shaw/sub2api/ent/schema/mixins"
	"github.com/Wei-Shaw/sub2api/ent/usersubscription"
	"github.com/Wei-Shaw/sub2api/internal/repository"
	"github.com/Wei-Shaw/sub2api/internal/service"
)

func newMultiInstanceSubscriptionService(t *testing.T) (*service.SubscriptionService, *dbent.Client, context.Context, int64, int64) {
	t.Helper()
	db, err := sql.Open("sqlite", "file:"+t.Name()+"?mode=memory&cache=shared&_pragma=foreign_keys(1)")
	require.NoError(t, err)
	client := dbent.NewClient(dbent.Driver(entsql.OpenDB(dialect.SQLite, db)))
	t.Cleanup(func() { _ = client.Close() })
	ctx := context.Background()
	require.NoError(t, client.Schema.Create(ctx))
	user, err := client.User.Create().SetEmail(t.Name() + "@example.com").SetPasswordHash("hash").Save(ctx)
	require.NoError(t, err)
	group, err := client.Group.Create().SetName(t.Name() + "-group").SetStatus(service.StatusActive).Save(ctx)
	require.NoError(t, err)
	plan, err := client.SubscriptionPlan.Create().
		SetName(t.Name() + "-plan").
		SetPrice(10).
		SetValidityDays(30).
		SetValidityUnit("days").
		SetMaxSubscriptionsPerUser(2).
		AddGroupIDs(group.ID).
		Save(ctx)
	require.NoError(t, err)
	repo := repository.NewUserSubscriptionRepository(client)
	return service.NewSubscriptionService(nil, repo, nil, client, nil), client, ctx, user.ID, plan.ID
}

func TestCreateSubscriptionInstanceEnforcesIndependentLimit(t *testing.T) {
	svc, _, ctx, userID, planID := newMultiInstanceSubscriptionService(t)
	input := func(note string) *service.AssignSubscriptionInput {
		return &service.AssignSubscriptionInput{UserID: userID, PlanID: planID, ValidityDays: 30, Notes: note}
	}
	first, err := svc.CreateSubscriptionInstance(ctx, input("first"), true, false)
	require.NoError(t, err)
	second, err := svc.CreateSubscriptionInstance(ctx, input("second"), true, false)
	require.NoError(t, err)
	require.NotEqual(t, first.ID, second.ID)
	require.True(t, first.ExpiresAt.After(first.StartsAt))
	require.True(t, second.ExpiresAt.After(second.StartsAt))

	_, err = svc.CreateSubscriptionInstance(ctx, input("third"), true, false)
	require.ErrorIs(t, err, service.ErrSubscriptionInstanceLimit)

	instances, err := svc.ListUserSubscriptions(ctx, userID)
	require.NoError(t, err)
	require.Len(t, instances, 2)
}

func TestRenewSubscriptionInstanceOnlyChangesTarget(t *testing.T) {
	svc, client, ctx, userID, planID := newMultiInstanceSubscriptionService(t)
	first, err := svc.CreateSubscriptionInstance(ctx, &service.AssignSubscriptionInput{UserID: userID, PlanID: planID, ValidityDays: 30}, true, false)
	require.NoError(t, err)
	second, err := svc.CreateSubscriptionInstance(ctx, &service.AssignSubscriptionInput{UserID: userID, PlanID: planID, ValidityDays: 30}, true, false)
	require.NoError(t, err)
	firstExpiry := first.ExpiresAt
	secondExpiry := second.ExpiresAt

	renewed, err := svc.RenewSubscriptionInstance(ctx, first.ID, &service.AssignSubscriptionInput{UserID: userID, PlanID: planID, ValidityDays: 7}, false)
	require.NoError(t, err)
	require.WithinDuration(t, firstExpiry.AddDate(0, 0, 7), renewed.ExpiresAt, time.Second)
	unchanged, err := svc.GetByID(ctx, second.ID)
	require.NoError(t, err)
	require.Equal(t, secondExpiry, unchanged.ExpiresAt)

	other, err := client.User.Create().SetEmail(t.Name() + "-other@example.com").SetPasswordHash("hash").Save(ctx)
	require.NoError(t, err)
	_, err = svc.RenewSubscriptionInstance(ctx, first.ID, &service.AssignSubscriptionInput{UserID: other.ID, PlanID: planID, ValidityDays: 7}, false)
	require.ErrorIs(t, err, service.ErrSubscriptionTargetMismatch)
}

func TestRestoreSubscriptionUsesMultiInstanceCapacity(t *testing.T) {
	t.Run("allows restore below limit", func(t *testing.T) {
		svc, client, ctx, userID, planID := newMultiInstanceSubscriptionService(t)
		first, err := svc.CreateSubscriptionInstance(ctx, &service.AssignSubscriptionInput{UserID: userID, PlanID: planID, ValidityDays: 30}, true, false)
		require.NoError(t, err)
		second, err := svc.CreateSubscriptionInstance(ctx, &service.AssignSubscriptionInput{UserID: userID, PlanID: planID, ValidityDays: 30}, true, false)
		require.NoError(t, err)
		require.NoError(t, svc.RevokeSubscription(ctx, second.ID))

		restored, err := svc.RestoreSubscription(ctx, second.ID)
		require.NoError(t, err)
		require.Equal(t, second.ID, restored.ID)
		require.Equal(t, service.SubscriptionStatusActive, restored.Status)

		rows, err := client.UserSubscription.Query().All(ctx)
		require.NoError(t, err)
		require.Len(t, rows, 2)
		require.NotEqual(t, first.ID, restored.ID)
	})

	t.Run("rejects live restore at limit", func(t *testing.T) {
		svc, client, ctx, userID, planID := newMultiInstanceSubscriptionService(t)
		first, err := svc.CreateSubscriptionInstance(ctx, &service.AssignSubscriptionInput{UserID: userID, PlanID: planID, ValidityDays: 30}, true, false)
		require.NoError(t, err)
		second, err := svc.CreateSubscriptionInstance(ctx, &service.AssignSubscriptionInput{UserID: userID, PlanID: planID, ValidityDays: 30}, true, false)
		require.NoError(t, err)
		require.NoError(t, svc.RevokeSubscription(ctx, second.ID))
		_, err = svc.CreateSubscriptionInstance(ctx, &service.AssignSubscriptionInput{UserID: userID, PlanID: planID, ValidityDays: 30}, true, false)
		require.NoError(t, err)

		_, err = svc.RestoreSubscription(ctx, second.ID)
		require.ErrorIs(t, err, service.ErrSubscriptionInstanceLimit)
		stillDeleted, err := client.UserSubscription.Query().
			Where(usersubscription.IDEQ(second.ID)).
			Only(mixins.SkipSoftDelete(ctx))
		require.NoError(t, err)
		require.NotNil(t, stillDeleted.DeletedAt)
		require.NotZero(t, first.ID)
	})

	t.Run("expired restore does not consume capacity", func(t *testing.T) {
		svc, client, ctx, userID, planID := newMultiInstanceSubscriptionService(t)
		first, err := svc.CreateSubscriptionInstance(ctx, &service.AssignSubscriptionInput{UserID: userID, PlanID: planID, ValidityDays: 30}, true, false)
		require.NoError(t, err)
		second, err := svc.CreateSubscriptionInstance(ctx, &service.AssignSubscriptionInput{UserID: userID, PlanID: planID, ValidityDays: 30}, true, false)
		require.NoError(t, err)
		require.NoError(t, svc.RevokeSubscription(ctx, second.ID))
		_, err = svc.CreateSubscriptionInstance(ctx, &service.AssignSubscriptionInput{UserID: userID, PlanID: planID, ValidityDays: 30}, true, false)
		require.NoError(t, err)
		past := time.Now().Add(-time.Minute)
		require.NoError(t, client.UserSubscription.UpdateOneID(second.ID).SetExpiresAt(past).SetStatus(service.SubscriptionStatusSuspended).Exec(ctx))

		restored, err := svc.RestoreSubscription(ctx, second.ID)
		require.NoError(t, err)
		require.Equal(t, service.SubscriptionStatusExpired, restored.Status)
		require.NotZero(t, first.ID)
	})
}
