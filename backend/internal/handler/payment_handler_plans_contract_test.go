package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	dbent "github.com/Wei-Shaw/sub2api/ent"
	"github.com/Wei-Shaw/sub2api/ent/enttest"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"

	"entgo.io/ent/dialect"
	entsql "entgo.io/ent/dialect/sql"
	_ "modernc.org/sqlite"
)

type paymentPlanContract struct {
	ID                    int64                   `json:"id"`
	GroupID               int64                   `json:"group_id"`
	IncludedGroups        []service.PlanGroupInfo `json:"included_groups"`
	CycleQuotaUSD         *float64                `json:"cycle_quota_usd"`
	ResetIntervalSeconds  int                     `json:"reset_interval_seconds"`
	WalletFallbackEnabled bool                    `json:"wallet_fallback_enabled"`
}

type paymentHandlerPlansSettingRepoStub struct{}

func (paymentHandlerPlansSettingRepoStub) Get(context.Context, string) (*service.Setting, error) {
	return nil, nil
}
func (paymentHandlerPlansSettingRepoStub) GetValue(context.Context, string) (string, error) {
	return "", nil
}
func (paymentHandlerPlansSettingRepoStub) Set(context.Context, string, string) error { return nil }
func (paymentHandlerPlansSettingRepoStub) GetMultiple(_ context.Context, keys []string) (map[string]string, error) {
	return make(map[string]string, len(keys)), nil
}
func (paymentHandlerPlansSettingRepoStub) SetMultiple(context.Context, map[string]string) error {
	return nil
}
func (paymentHandlerPlansSettingRepoStub) GetAll(context.Context) (map[string]string, error) {
	return map[string]string{}, nil
}
func (paymentHandlerPlansSettingRepoStub) Delete(context.Context, string) error { return nil }

func TestPaymentHandlerPlanResponsesExposeSubscriptionBillingContract(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx := context.Background()
	client := newPaymentHandlerPlansTestClient(t)

	primary, err := client.Group.Create().
		SetName("GPT primary").
		SetPlatform("openai").
		SetRateMultiplier(0.1).
		Save(ctx)
	require.NoError(t, err)
	secondary, err := client.Group.Create().
		SetName("GPT secondary").
		SetPlatform("openai").
		SetRateMultiplier(0.2).
		Save(ctx)
	require.NoError(t, err)

	const cycleQuota = 40.0
	plan, err := client.SubscriptionPlan.Create().
		SetGroupID(primary.ID).
		SetName("Standard").
		SetPrice(103.9).
		SetValidityDays(28).
		SetValidityUnit("days").
		SetForSale(true).
		SetCycleQuotaUsd(cycleQuota).
		SetResetIntervalSeconds(604800).
		SetWalletFallbackEnabled(true).
		AddGroupIDs(primary.ID, secondary.ID).
		Save(ctx)
	require.NoError(t, err)

	configService := service.NewPaymentConfigService(
		client,
		paymentHandlerPlansSettingRepoStub{},
		nil,
	)
	handler := NewPaymentHandler(nil, configService)

	t.Run("plans", func(t *testing.T) {
		recorder := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(recorder)
		c.Request = httptest.NewRequest(http.MethodGet, "/api/v1/payment/plans", nil)

		handler.GetPlans(c)

		require.Equal(t, http.StatusOK, recorder.Code)
		var resp struct {
			Code int                   `json:"code"`
			Data []paymentPlanContract `json:"data"`
		}
		require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &resp))
		require.Equal(t, 0, resp.Code)
		require.Len(t, resp.Data, 1)
		assertPaymentPlanContract(t, resp.Data[0], int64(plan.ID), []int64{int64(primary.ID), int64(secondary.ID)})
	})

	t.Run("checkout info", func(t *testing.T) {
		recorder := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(recorder)
		c.Request = httptest.NewRequest(http.MethodGet, "/api/v1/payment/checkout-info", nil)

		handler.GetCheckoutInfo(c)

		require.Equal(t, http.StatusOK, recorder.Code)
		var resp struct {
			Code int `json:"code"`
			Data struct {
				Plans []paymentPlanContract `json:"plans"`
			} `json:"data"`
		}
		require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &resp))
		require.Equal(t, 0, resp.Code)
		require.Len(t, resp.Data.Plans, 1)
		assertPaymentPlanContract(t, resp.Data.Plans[0], int64(plan.ID), []int64{int64(primary.ID), int64(secondary.ID)})
	})
}

func assertPaymentPlanContract(t *testing.T, got paymentPlanContract, planID int64, groupIDs []int64) {
	t.Helper()
	require.Equal(t, planID, got.ID)
	require.NotNil(t, got.CycleQuotaUSD)
	require.InDelta(t, 40, *got.CycleQuotaUSD, 1e-9)
	require.Equal(t, 604800, got.ResetIntervalSeconds)
	require.True(t, got.WalletFallbackEnabled)
	require.Len(t, got.IncludedGroups, len(groupIDs))

	actualIDs := make([]int64, 0, len(got.IncludedGroups))
	for _, group := range got.IncludedGroups {
		actualIDs = append(actualIDs, group.ID)
	}
	require.ElementsMatch(t, groupIDs, actualIDs)
}

func newPaymentHandlerPlansTestClient(t *testing.T) *dbent.Client {
	t.Helper()
	dsn := fmt.Sprintf(
		"file:%s?mode=memory&cache=shared&_fk=1",
		strings.NewReplacer("/", "_", " ", "_").Replace(t.Name()),
	)
	db, err := sql.Open("sqlite", dsn)
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })
	_, err = db.Exec("PRAGMA foreign_keys = ON")
	require.NoError(t, err)

	driver := entsql.OpenDB(dialect.SQLite, db)
	client := enttest.NewClient(t, enttest.WithOptions(dbent.Driver(driver)))
	t.Cleanup(func() { _ = client.Close() })
	return client
}
