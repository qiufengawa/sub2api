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
	} {
		var req UpdatePlanRequest
		require.Error(t, json.Unmarshal([]byte(payload), &req))
	}
}

func TestUpdatePlanRequestDirectValueRemainsCompatible(t *testing.T) {
	quota := 5.0
	req := UpdatePlanRequest{CycleQuotaUSD: &quota}
	require.False(t, req.CycleQuotaUSDSet)
	require.NoError(t, validatePlanPatch(req))
}
