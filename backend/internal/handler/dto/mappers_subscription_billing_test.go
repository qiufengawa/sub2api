package dto

import (
	"encoding/json"
	"testing"

	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/stretchr/testify/require"
)

func TestUserSubscriptionFromService_PreservesCycleAndIncludedGroups(t *testing.T) {
	t.Parallel()

	quota := 40.0
	sub := &service.UserSubscription{
		ID:                    11,
		UserID:                22,
		PlanID:                44,
		PlanName:              "Standard",
		CycleQuotaUSD:         &quota,
		CycleUsageUSD:         12.5,
		CycleReservedUSD:      1.25,
		ResetIntervalSeconds:  604800,
		WalletFallbackEnabled: false,
		IncludedGroups: []service.Group{
			{ID: 33, Name: "GPT route", Platform: service.PlatformOpenAI, RateMultiplier: 0.1},
			{ID: 34, Name: "Claude route", Platform: service.PlatformAnthropic, RateMultiplier: 0.2},
		},
	}

	userDTO := UserSubscriptionFromService(sub)
	adminDTO := UserSubscriptionFromServiceAdmin(sub)
	for _, got := range []*UserSubscription{userDTO, &adminDTO.UserSubscription} {
		require.Equal(t, quota, *got.CycleQuotaUSD)
		require.InDelta(t, 12.5, got.CycleUsageUSD, 1e-12)
		require.InDelta(t, 1.25, got.CycleReservedUSD, 1e-12)
		require.Equal(t, 604800, got.ResetIntervalSeconds)
		require.False(t, got.WalletFallbackEnabled)
		require.Len(t, got.IncludedGroups, 2)
		require.Equal(t, int64(34), got.IncludedGroups[1].ID)
		require.InDelta(t, 0.2, got.IncludedGroups[1].RateMultiplier, 1e-12)

		body, err := json.Marshal(got)
		require.NoError(t, err)
		require.Contains(t, string(body), `"cycle_reserved_usd":1.25`)
		require.Contains(t, string(body), `"included_groups"`)
	}
}

func TestUserFromServiceShallow_NormalizesBillingPreference(t *testing.T) {
	t.Parallel()

	require.Equal(t, service.BillingPreferenceSubscriptionFirst, UserFromServiceShallow(&service.User{}).BillingPreference)
	require.Equal(t, service.BillingPreferenceWalletOnly, UserFromServiceShallow(&service.User{
		BillingPreference: service.BillingPreferenceWalletOnly,
	}).BillingPreference)
}
