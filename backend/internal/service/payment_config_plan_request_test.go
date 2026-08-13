package service

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestUpdatePlanRequestCycleQuotaPresence(t *testing.T) {
	t.Run("omitted keeps patch field unset", func(t *testing.T) {
		var req UpdatePlanRequest
		require.NoError(t, json.Unmarshal([]byte(`{"name":"Pro"}`), &req))
		require.False(t, req.CycleQuotaUSDSet)
		require.Nil(t, req.CycleQuotaUSD)
	})

	t.Run("number sets a value", func(t *testing.T) {
		var req UpdatePlanRequest
		require.NoError(t, json.Unmarshal([]byte(`{"cycle_quota_usd":5}`), &req))
		require.True(t, req.CycleQuotaUSDSet)
		require.NotNil(t, req.CycleQuotaUSD)
		require.Equal(t, 5.0, *req.CycleQuotaUSD)
	})

	t.Run("null explicitly clears", func(t *testing.T) {
		var req UpdatePlanRequest
		require.NoError(t, json.Unmarshal([]byte(`{"cycle_quota_usd":null}`), &req))
		require.True(t, req.CycleQuotaUSDSet)
		require.Nil(t, req.CycleQuotaUSD)
	})
}

func TestUpdatePlanRequestRejectsNullNonNullableCycleFields(t *testing.T) {
	for _, payload := range []string{
		`{"reset_interval_seconds":null}`,
		`{"wallet_fallback_enabled":null}`,
		`{"max_subscriptions_per_user":null}`,
	} {
		var req UpdatePlanRequest
		require.Error(t, json.Unmarshal([]byte(payload), &req))
	}
}

func TestPlanRequestMaxSubscriptionsStrictJSON(t *testing.T) {
	valid := []string{`{"max_subscriptions_per_user":1}`, `{"max_subscriptions_per_user":2147483647}`}
	for _, payload := range valid {
		var req CreatePlanRequest
		require.NoError(t, json.Unmarshal([]byte(payload), &req), payload)
		require.NotNil(t, req.MaxSubscriptionsPerUser)
	}
	invalid := []string{
		`{"max_subscriptions_per_user":null}`,
		`{"max_subscriptions_per_user":1.0}`,
		`{"max_subscriptions_per_user":1e1}`,
		`{"max_subscriptions_per_user":"2"}`,
		`{"max_subscriptions_per_user":true}`,
		`{"max_subscriptions_per_user":2147483648}`,
	}
	for _, payload := range invalid {
		var req CreatePlanRequest
		require.Error(t, json.Unmarshal([]byte(payload), &req), payload)
	}
}

func TestUpdatePlanRequestDirectValueRemainsCompatible(t *testing.T) {
	quota := 5.0
	req := UpdatePlanRequest{CycleQuotaUSD: &quota}
	require.False(t, req.CycleQuotaUSDSet)
	require.NoError(t, validatePlanPatch(req))
}
