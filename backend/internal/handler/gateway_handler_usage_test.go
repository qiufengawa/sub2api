package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/server/middleware"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestUsageUnrestrictedIncludesCycleProgress(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodGet, "/v1/usage", nil)

	cycleStartedAt := time.Date(2026, time.July, 13, 0, 30, 0, 0, time.FixedZone("UTC+8", 8*60*60))
	cycleQuota := 40.0
	c.Set(string(middleware.ContextKeySubscription), &service.UserSubscription{
		CycleStartedAt:       &cycleStartedAt,
		CycleQuotaUSD:        &cycleQuota,
		CycleUsageUSD:        12.5,
		CycleReservedUSD:     1.5,
		ResetIntervalSeconds: 604800,
	})

	handler := &GatewayHandler{}
	handler.usageUnrestricted(
		c,
		context.Background(),
		&service.APIKey{Group: &service.Group{
			Name:             "Weekly plan",
			SubscriptionType: service.SubscriptionTypeSubscription,
		}},
		middleware.AuthSubject{},
		nil,
		nil,
		nil,
	)

	require.Equal(t, http.StatusOK, recorder.Code)
	var response struct {
		Subscription struct {
			CycleStartedAt       *time.Time `json:"cycle_started_at"`
			CycleQuotaUSD        *float64   `json:"cycle_quota_usd"`
			CycleUsageUSD        float64    `json:"cycle_usage_usd"`
			CycleReservedUSD     float64    `json:"cycle_reserved_usd"`
			ResetIntervalSeconds int        `json:"reset_interval_seconds"`
		} `json:"subscription"`
	}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
	require.NotNil(t, response.Subscription.CycleStartedAt)
	require.True(t, cycleStartedAt.Equal(*response.Subscription.CycleStartedAt))
	require.Equal(t, cycleQuota, *response.Subscription.CycleQuotaUSD)
	require.Equal(t, 12.5, response.Subscription.CycleUsageUSD)
	require.Equal(t, 1.5, response.Subscription.CycleReservedUSD)
	require.Equal(t, 604800, response.Subscription.ResetIntervalSeconds)
}
