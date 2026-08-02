package admin

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	dbent "github.com/Wei-Shaw/sub2api/ent"
	"github.com/Wei-Shaw/sub2api/internal/service"
)

func TestSanitizeAdminPaymentOrderForResponseAddsCurrency(t *testing.T) {
	now := time.Now()
	order := &dbent.PaymentOrder{
		ID:          1,
		UserID:      2,
		Amount:      100,
		PayAmount:   108,
		FeeRate:     8,
		OutTradeNo:  "sub2_202606250001",
		PaymentType: "stripe",
		OrderType:   "subscription",
		Status:      "COMPLETED",
		ExpiresAt:   now,
		CreatedAt:   now,
		UpdatedAt:   now,
		ProviderSnapshot: map[string]any{
			"schema_version": 2,
			"currency":       "USD",
		},
	}

	got := sanitizeAdminPaymentOrderForResponse(order)
	if got == nil {
		t.Fatal("expected sanitized order")
	}
	if got.Currency != "USD" {
		t.Fatalf("expected currency USD, got %q", got.Currency)
	}

	body, err := json.Marshal(got)
	if err != nil {
		t.Fatalf("marshal sanitized order: %v", err)
	}
	if strings.Contains(string(body), "provider_snapshot") {
		t.Fatalf("expected provider_snapshot to be omitted, got %s", string(body))
	}
}

func TestAdminSubscriptionPlansForResponseIncludesCompositeGroupInfo(t *testing.T) {
	weekly := 25.0
	cycleQuota := 100.0
	now := time.Now()
	plans := []*dbent.SubscriptionPlan{
		{
			ID:                    11,
			Edges:                 dbent.SubscriptionPlanEdges{Groups: []*dbent.Group{{ID: 7}}},
			Name:                  "All models",
			Description:           "Composite access",
			Price:                 19.99,
			Currency:              "CNY",
			ValidityDays:          30,
			ValidityUnit:          "days",
			Features:              "OpenAI\nClaude\nGemini\nGrok",
			ProductName:           "Sub2API",
			ForSale:               true,
			SortOrder:             1,
			CycleQuotaUsd:         &cycleQuota,
			ResetIntervalSeconds:  604800,
			WalletFallbackEnabled: true,
			CreatedAt:             now,
			UpdatedAt:             now,
		},
	}
	groupInfo := map[int64]service.PlanGroupInfo{
		7: {
			ID:             7,
			Platform:       service.PlatformComposite,
			Name:           "Bucket 2 composite",
			RateMultiplier: 1.5,
			WeeklyLimitUSD: &weekly,
			ModelScopes:    []string{"openai", "claude", "gemini", "grok"},
		},
	}

	got := adminSubscriptionPlansForResponse(plans, groupInfo)

	if len(got) != 1 {
		t.Fatalf("expected one plan, got %d", len(got))
	}
	if len(got[0].IncludedGroups) != 1 || got[0].IncludedGroups[0].ID != 7 {
		t.Fatalf("expected included group contract to be preserved, got %#v", got[0].IncludedGroups)
	}
	if got[0].IncludedGroups[0].Platform != service.PlatformComposite || got[0].IncludedGroups[0].Name != "Bucket 2 composite" {
		t.Fatalf("expected composite group metadata, got %#v", got[0].IncludedGroups[0])
	}
	if got[0].IncludedGroups[0].WeeklyLimitUSD == nil || *got[0].IncludedGroups[0].WeeklyLimitUSD != weekly {
		t.Fatalf("expected weekly limit to be included, got %#v", got[0].IncludedGroups[0].WeeklyLimitUSD)
	}
	if strings.Join(got[0].IncludedGroups[0].ModelScopes, ",") != "openai,claude,gemini,grok" {
		t.Fatalf("expected model scopes to be preserved, got %#v", got[0].IncludedGroups[0].ModelScopes)
	}
	if got[0].CycleQuotaUSD == nil || *got[0].CycleQuotaUSD != cycleQuota {
		t.Fatalf("expected cycle quota to be preserved, got %#v", got[0].CycleQuotaUSD)
	}
	if got[0].ResetIntervalSeconds != 604800 {
		t.Fatalf("expected reset interval to be preserved, got %d", got[0].ResetIntervalSeconds)
	}
	if !got[0].WalletFallbackEnabled {
		t.Fatal("expected wallet fallback flag to be preserved")
	}
	// 投影必须保留 ent 原始响应的全部套餐字段：currency 丢失曾导致编辑保存时
	// 静默清空套餐货币（PlanEditDialog 回传空串 → SetCurrency("")）。
	if got[0].Currency != "CNY" {
		t.Fatalf("expected currency to be preserved, got %q", got[0].Currency)
	}
	if !got[0].CreatedAt.Equal(now) || !got[0].UpdatedAt.Equal(now) {
		t.Fatalf("expected created_at/updated_at to be preserved, got %v / %v", got[0].CreatedAt, got[0].UpdatedAt)
	}
}
