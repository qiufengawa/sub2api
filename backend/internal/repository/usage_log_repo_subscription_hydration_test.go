package repository

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"testing"
	"time"

	dbent "github.com/Wei-Shaw/sub2api/ent"
	"github.com/Wei-Shaw/sub2api/ent/enttest"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/stretchr/testify/require"

	"entgo.io/ent/dialect"
	entsql "entgo.io/ent/dialect/sql"
	_ "modernc.org/sqlite"
)

func TestUsageLogHydrationPreservesDeletedSubscriptionHistory(t *testing.T) {
	ctx := context.Background()
	client := newUsageLogHydrationTestClient(t)
	group, err := client.Group.Create().SetName("historical-gpt-group").Save(ctx)
	require.NoError(t, err)
	plan, err := client.SubscriptionPlan.Create().
		SetGroupID(group.ID).
		SetName("Historical Standard").
		SetPrice(10).
		AddGroupIDs(group.ID).
		Save(ctx)
	require.NoError(t, err)
	user, err := client.User.Create().
		SetEmail("usage-history@example.com").
		SetPasswordHash("hash").
		Save(ctx)
	require.NoError(t, err)
	now := time.Now().UTC()
	subscription, err := client.UserSubscription.Create().
		SetUserID(user.ID).
		SetGroupID(group.ID).
		SetPlanID(plan.ID).
		SetStartsAt(now.Add(-time.Hour)).
		SetExpiresAt(now.Add(time.Hour)).
		Save(ctx)
	require.NoError(t, err)

	require.NoError(t, client.UserSubscription.DeleteOneID(subscription.ID).Exec(ctx))
	require.NoError(t, client.Group.DeleteOneID(group.ID).Exec(ctx))

	logs := []service.UsageLog{{
		UserID:         user.ID,
		GroupID:        &group.ID,
		SubscriptionID: &subscription.ID,
	}}
	repo := &usageLogRepository{client: client}
	require.NoError(t, repo.hydrateUsageLogAssociations(ctx, logs))

	require.NotNil(t, logs[0].Group)
	require.Equal(t, "historical-gpt-group", logs[0].Group.Name)
	require.NotNil(t, logs[0].Subscription)
	require.Equal(t, service.SubscriptionStatusRevoked, logs[0].Subscription.Status)
	require.Equal(t, "Historical Standard", logs[0].Subscription.PlanName)
	require.NotNil(t, logs[0].Subscription.Group)
	require.Equal(t, "historical-gpt-group", logs[0].Subscription.Group.Name)
	require.Len(t, logs[0].Subscription.IncludedGroups, 1)
	require.Equal(t, group.ID, logs[0].Subscription.IncludedGroups[0].ID)
}

func newUsageLogHydrationTestClient(t *testing.T) *dbent.Client {
	t.Helper()
	dbName := fmt.Sprintf(
		"file:%s?mode=memory&cache=shared",
		strings.NewReplacer("/", "_", " ", "_").Replace(t.Name()),
	)
	db, err := sql.Open("sqlite", dbName)
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })
	_, err = db.Exec("PRAGMA foreign_keys = ON")
	require.NoError(t, err)
	driver := entsql.OpenDB(dialect.SQLite, db)
	client := enttest.NewClient(t, enttest.WithOptions(dbent.Driver(driver)))
	t.Cleanup(func() { _ = client.Close() })
	return client
}
