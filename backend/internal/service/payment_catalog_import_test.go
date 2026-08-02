package service

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	dbent "github.com/Wei-Shaw/sub2api/ent"
	"github.com/Wei-Shaw/sub2api/ent/group"
	"github.com/Wei-Shaw/sub2api/ent/subscriptionplan"
)

func catalogTestRequest() PaymentCatalogImportRequest {
	weekly := 5.0
	monthly := 20.0
	cycleQuota := 5.0
	originalPrice := 20.0
	validity := 28
	sortOrder := 10
	return PaymentCatalogImportRequest{
		SchemaVersion: PaymentCatalogSchemaVersion,
		Mode:          PaymentCatalogImportMode,
		PaymentSettings: &PaymentCatalogPaymentSettings{
			BalanceRechargeMultiplier: floatPtr(1),
			SubscriptionUSDToCNYRate:  floatPtr(0),
		},
		Defaults: PaymentCatalogImportDefaults{
			Platform:         PlatformComposite,
			SubscriptionType: SubscriptionTypeSubscription,
			RateMultiplier:   floatPtr(1),
			IsExclusive:      catalogBoolPtr(true),
			Status:           StatusActive,
			ValidityDays:     &validity,
			ValidityUnit:     "days",
			Currency:         "CNY",
			ForSale:          catalogBoolPtr(true),
		},
		Groups: []PaymentCatalogImportGroup{{
			Key:                 "lite",
			Name:                "Lite subscription",
			Description:         "Weekly quota",
			WeeklyLimitUSD:      &weekly,
			MonthlyLimitUSD:     &monthly,
			DefaultValidityDays: &validity,
			SortOrder:           &sortOrder,
		}},
		Plans: []PaymentCatalogImportPlan{{
			GroupKey:              "lite",
			CycleQuotaUSD:         &cycleQuota,
			ResetIntervalSeconds:  604800,
			WalletFallbackEnabled: catalogBoolPtr(false),
			Name:                  "Lite",
			Description:           "28 day plan",
			Price:                 12.9,
			OriginalPrice:         &originalPrice,
			Currency:              "CNY",
			ValidityDays:          &validity,
			ValidityUnit:          "days",
			Features:              []string{"Weekly reset", "Unused quota does not roll over"},
			ProductName:           "Qiu API Lite",
			ForSale:               catalogBoolPtr(true),
			SortOrder:             &sortOrder,
		}},
	}
}

func newCatalogImportTestService(t *testing.T) (*PaymentConfigService, *dbent.Client) {
	t.Helper()
	client := newPaymentConfigServiceTestClient(t)
	ctx := context.Background()
	_, err := client.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS scheduler_outbox (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			event_type TEXT NOT NULL,
			account_id INTEGER NULL,
			group_id INTEGER NULL,
			payload TEXT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)
	`)
	if err != nil {
		t.Fatalf("create scheduler_outbox: %v", err)
	}
	return NewPaymentConfigService(client, &paymentConfigSettingRepoStub{values: map[string]string{}}, nil), client
}

func TestPaymentCatalogImportValidationRejectsDuplicatesAndSelfSource(t *testing.T) {
	svc := &PaymentConfigService{}
	req := catalogTestRequest()
	req.Groups[0].CopyAccountsFrom = []string{"Lite subscription"}
	req.Groups = append(req.Groups, req.Groups[0])
	req.Groups[1].Key = "lite-copy"
	req.Plans = append(req.Plans, req.Plans[0])

	normalized := svc.normalizeCatalogImport(req)
	wantCodes := map[string]bool{
		"ACCOUNT_SOURCE_SELF":  false,
		"GROUP_NAME_DUPLICATE": false,
		"PLAN_DUPLICATE":       false,
	}
	for _, issue := range normalized.issues {
		if _, ok := wantCodes[issue.Code]; ok {
			wantCodes[issue.Code] = true
		}
	}
	for code, found := range wantCodes {
		if !found {
			t.Fatalf("expected validation issue %s, got %#v", code, normalized.issues)
		}
	}
}

func TestPaymentCatalogImportKeepsLegacySingleGroupPlansCompatible(t *testing.T) {
	req := catalogTestRequest()
	req.Plans[0].IncludedGroupKeys = nil
	req.Plans[0].CycleQuotaUSD = nil
	req.Plans[0].ResetIntervalSeconds = 0
	req.Plans[0].WalletFallbackEnabled = nil

	normalized := (&PaymentConfigService{}).normalizeCatalogImport(req)
	if hasCatalogErrors(normalized.issues) {
		t.Fatalf("legacy plan should remain valid: %#v", normalized.issues)
	}
	if len(normalized.plans) != 1 || len(normalized.plans[0].includedGroupKeys) != 1 || normalized.plans[0].includedGroupKeys[0] != "lite" {
		t.Fatalf("legacy group_key was not normalized as the included group: %#v", normalized.plans)
	}
	if normalized.plans[0].cycleQuotaUSD != nil || normalized.plans[0].resetIntervalSeconds != 0 || !normalized.plans[0].walletFallbackEnabled {
		t.Fatalf("legacy plan defaults changed: %#v", normalized.plans[0])
	}
}

func TestPaymentCatalogImportValidationRejectsOversizedFieldsAndArrays(t *testing.T) {
	tests := []struct {
		name   string
		code   string
		mutate func(*PaymentCatalogImportRequest)
	}{
		{name: "group key", code: "GROUP_KEY_INVALID", mutate: func(req *PaymentCatalogImportRequest) {
			req.Groups[0].Key = strings.Repeat("k", paymentCatalogMaxGroupKeyRunes+1)
		}},
		{name: "group description", code: "GROUP_DESCRIPTION_INVALID", mutate: func(req *PaymentCatalogImportRequest) {
			req.Groups[0].Description = strings.Repeat("d", paymentCatalogMaxDescriptionRunes+1)
		}},
		{name: "account sources", code: "ACCOUNT_SOURCE_COUNT_LIMIT", mutate: func(req *PaymentCatalogImportRequest) {
			req.Groups[0].CopyAccountsFrom = make([]string, paymentCatalogMaxAccountSources+1)
		}},
		{name: "routes per group", code: "ROUTE_GROUP_COUNT_LIMIT", mutate: func(req *PaymentCatalogImportRequest) {
			req.Groups[0].Routes = make([]PaymentCatalogImportRoute, paymentCatalogMaxRoutesPerGroup+1)
		}},
		{name: "route model", code: "ROUTE_FIELD_INVALID", mutate: func(req *PaymentCatalogImportRequest) {
			req.Groups[0].Routes = []PaymentCatalogImportRoute{{PublicModel: strings.Repeat("m", paymentCatalogMaxRouteModelRunes+1), TargetPlatform: PlatformOpenAI}}
		}},
		{name: "route notes", code: "ROUTE_NOTES_INVALID", mutate: func(req *PaymentCatalogImportRequest) {
			req.Groups[0].Routes = []PaymentCatalogImportRoute{{PublicModel: "gpt-test", TargetPlatform: PlatformOpenAI, Notes: strings.Repeat("n", paymentCatalogMaxRouteNotesRunes+1)}}
		}},
		{name: "plan description", code: "PLAN_DESCRIPTION_INVALID", mutate: func(req *PaymentCatalogImportRequest) {
			req.Plans[0].Description = strings.Repeat("d", paymentCatalogMaxDescriptionRunes+1)
		}},
		{name: "plan features", code: "FEATURE_COUNT_LIMIT", mutate: func(req *PaymentCatalogImportRequest) {
			req.Plans[0].Features = make([]string, paymentCatalogMaxFeaturesPerPlan+1)
		}},
		{name: "feature value", code: "FEATURE_INVALID", mutate: func(req *PaymentCatalogImportRequest) {
			req.Plans[0].Features = []string{strings.Repeat("f", paymentCatalogMaxFeatureRunes+1)}
		}},
		{name: "product name", code: "PRODUCT_NAME_INVALID", mutate: func(req *PaymentCatalogImportRequest) {
			req.Plans[0].ProductName = strings.Repeat("p", paymentCatalogMaxProductNameRunes+1)
		}},
		{name: "included group", code: "PLAN_INCLUDED_GROUP_UNKNOWN", mutate: func(req *PaymentCatalogImportRequest) {
			req.Plans[0].IncludedGroupKeys = []string{"missing"}
		}},
		{name: "cycle quota", code: "PLAN_CYCLE_QUOTA_INVALID", mutate: func(req *PaymentCatalogImportRequest) {
			req.Plans[0].CycleQuotaUSD = floatPtr(0)
		}},
		{name: "cycle reset", code: "PLAN_RESET_INTERVAL_REQUIRED", mutate: func(req *PaymentCatalogImportRequest) {
			req.Plans[0].ResetIntervalSeconds = 0
		}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := catalogTestRequest()
			tt.mutate(&req)
			normalized := (&PaymentConfigService{}).normalizeCatalogImport(req)
			for _, issue := range normalized.issues {
				if issue.Code == tt.code {
					return
				}
			}
			t.Fatalf("expected validation issue %s, got %#v", tt.code, normalized.issues)
		})
	}
}

func TestPaymentCatalogImportFirstAndRepeatedImport(t *testing.T) {
	svc, client := newCatalogImportTestService(t)
	ctx := context.Background()
	req := catalogTestRequest()

	preview, err := svc.PreviewCatalogImport(ctx, req)
	if err != nil {
		t.Fatalf("preview first import: %v", err)
	}
	if !preview.CanApply || preview.Summary.GroupsCreated != 1 || preview.Summary.PlansCreated != 1 {
		t.Fatalf("unexpected first preview: %#v", preview)
	}
	if _, err := svc.ApplyCatalogImport(ctx, PaymentCatalogImportApplyRequest{Catalog: req, PreviewToken: preview.PreviewToken}); err != nil {
		t.Fatalf("apply first import: %v", err)
	}

	groupCount, err := client.Group.Query().Where(group.NameEQ("Lite subscription")).Count(ctx)
	if err != nil || groupCount != 1 {
		t.Fatalf("group count = %d, err = %v", groupCount, err)
	}
	planCount, err := client.SubscriptionPlan.Query().Where(subscriptionplan.NameEQ("Lite")).Count(ctx)
	if err != nil || planCount != 1 {
		t.Fatalf("plan count = %d, err = %v", planCount, err)
	}
	storedPlan, err := client.SubscriptionPlan.Query().Where(subscriptionplan.NameEQ("Lite")).WithGroups().Only(ctx)
	if err != nil {
		t.Fatalf("load imported plan: %v", err)
	}
	if storedPlan.CycleQuotaUsd == nil || *storedPlan.CycleQuotaUsd != 5 || storedPlan.ResetIntervalSeconds != 604800 || storedPlan.WalletFallbackEnabled {
		t.Fatalf("plan cycle settings were not imported: %#v", storedPlan)
	}
	if len(storedPlan.Edges.Groups) != 1 || storedPlan.Edges.Groups[0].ID != storedPlan.GroupID {
		t.Fatalf("legacy group_key must remain an included group: %#v", storedPlan.Edges.Groups)
	}

	repeatPreview, err := svc.PreviewCatalogImport(ctx, req)
	if err != nil {
		t.Fatalf("preview repeated import: %v", err)
	}
	if repeatPreview.Summary.GroupsUnchanged != 1 || repeatPreview.Summary.PlansUnchanged != 1 {
		t.Fatalf("repeated import is not idempotent: %#v", repeatPreview.Summary)
	}
	if repeatPreview.Summary.GroupsCreated != 0 || repeatPreview.Summary.GroupsUpdated != 0 || repeatPreview.Summary.PlansCreated != 0 || repeatPreview.Summary.PlansUpdated != 0 {
		t.Fatalf("repeated import contains writes: %#v", repeatPreview.Summary)
	}
	if _, err := svc.ApplyCatalogImport(ctx, PaymentCatalogImportApplyRequest{Catalog: req, PreviewToken: repeatPreview.PreviewToken}); err != nil {
		t.Fatalf("apply repeated import: %v", err)
	}
	groupCount, _ = client.Group.Query().Where(group.NameEQ("Lite subscription")).Count(ctx)
	planCount, _ = client.SubscriptionPlan.Query().Where(subscriptionplan.NameEQ("Lite")).Count(ctx)
	if groupCount != 1 || planCount != 1 {
		t.Fatalf("repeated import duplicated data: groups=%d plans=%d", groupCount, planCount)
	}
}

func TestPaymentCatalogImportRoundTripsIncludedGroupsAndCycleSettings(t *testing.T) {
	svc, client := newCatalogImportTestService(t)
	ctx := context.Background()
	req := catalogTestRequest()
	secondGroup := req.Groups[0]
	secondGroup.Key = "gpt-two"
	secondGroup.Name = "GPT two subscription"
	secondGroup.SortOrder = catalogIntPtr(20)
	req.Groups = append(req.Groups, secondGroup)
	req.Plans[0].GroupKey = ""
	req.Plans[0].IncludedGroupKeys = []string{"lite", "gpt-two", "gpt-two"}

	preview, err := svc.PreviewCatalogImport(ctx, req)
	if err != nil || !preview.CanApply {
		t.Fatalf("preview multi-group catalog: preview=%#v err=%v", preview, err)
	}
	if _, err := svc.ApplyCatalogImport(ctx, PaymentCatalogImportApplyRequest{Catalog: req, PreviewToken: preview.PreviewToken}); err != nil {
		t.Fatalf("apply multi-group catalog: %v", err)
	}

	stored, err := client.SubscriptionPlan.Query().Where(subscriptionplan.NameEQ("Lite")).WithGroups().Only(ctx)
	if err != nil {
		t.Fatalf("load multi-group plan: %v", err)
	}
	if len(stored.Edges.Groups) != 2 {
		t.Fatalf("included group count = %d, want 2", len(stored.Edges.Groups))
	}
	exported, err := svc.ExportCatalog(ctx)
	if err != nil {
		t.Fatalf("export multi-group catalog: %v", err)
	}
	if len(exported.Plans) != 1 || len(exported.Plans[0].IncludedGroupKeys) != 2 {
		t.Fatalf("included groups were not exported: %#v", exported.Plans)
	}
	if exported.Plans[0].GroupKey != "" || exported.Plans[0].GroupID != nil {
		t.Fatalf("export exposed a legacy primary-group field: %#v", exported.Plans[0])
	}
	if exported.Plans[0].CycleQuotaUSD == nil || *exported.Plans[0].CycleQuotaUSD != 5 || exported.Plans[0].ResetIntervalSeconds != 604800 || exported.Plans[0].WalletFallbackEnabled == nil || *exported.Plans[0].WalletFallbackEnabled {
		t.Fatalf("cycle settings were not exported: %#v", exported.Plans[0])
	}
	reimportPreview, err := svc.PreviewCatalogImport(ctx, *exported)
	if err != nil || !reimportPreview.CanApply || reimportPreview.Summary.PlansUnchanged != 1 {
		t.Fatalf("multi-group export is not idempotent: preview=%#v err=%v", reimportPreview, err)
	}

	req.Plans[0].IncludedGroupKeys = []string{"lite"}
	removePreview, err := svc.PreviewCatalogImport(ctx, req)
	if err != nil || !removePreview.CanApply {
		t.Fatalf("preview included-group removal: preview=%#v err=%v", removePreview, err)
	}
	foundGroupDiff := false
	for _, change := range removePreview.Changes {
		for _, field := range change.Fields {
			if change.Kind == "plan" && field.Field == "included_group_keys" {
				foundGroupDiff = true
			}
		}
	}
	if !foundGroupDiff {
		t.Fatalf("included-group removal is missing from preview: %#v", removePreview.Changes)
	}
	if _, err := svc.ApplyCatalogImport(ctx, PaymentCatalogImportApplyRequest{Catalog: req, PreviewToken: removePreview.PreviewToken}); err != nil {
		t.Fatalf("apply included-group removal: %v", err)
	}
	stored, err = client.SubscriptionPlan.Query().Where(subscriptionplan.NameEQ("Lite")).WithGroups().Only(ctx)
	if err != nil || len(stored.Edges.Groups) != 1 || stored.Edges.Groups[0].ID != stored.GroupID {
		t.Fatalf("included-group removal was not applied: plan=%#v err=%v", stored, err)
	}
}

func TestPaymentCatalogImportReferencesExistingRealGroupsWithoutMutatingThem(t *testing.T) {
	svc, client := newCatalogImportTestService(t)
	ctx := context.Background()
	firstGroup, err := client.Group.Create().
		SetName("GPT one real group").
		SetDescription("first routing group").
		SetPlatform(PlatformOpenAI).
		SetSubscriptionType(SubscriptionTypeStandard).
		SetStatus(StatusActive).
		SetRateMultiplier(0.1).
		Save(ctx)
	if err != nil {
		t.Fatalf("create primary real group: %v", err)
	}
	secondGroup, err := client.Group.Create().
		SetName("GPT two real group").
		SetDescription("secondary routing group").
		SetPlatform(PlatformOpenAI).
		SetSubscriptionType(SubscriptionTypeStandard).
		SetStatus(StatusActive).
		SetRateMultiplier(0.2).
		Save(ctx)
	if err != nil {
		t.Fatalf("create included real group: %v", err)
	}

	req := catalogTestRequest()
	req.Groups = nil
	req.Plans[0].GroupKey = ""
	req.Plans[0].GroupID = nil
	req.Plans[0].IncludedGroupKeys = nil
	req.Plans[0].IncludedGroupIDs = []int64{firstGroup.ID, secondGroup.ID, secondGroup.ID}

	preview, err := svc.PreviewCatalogImport(ctx, req)
	if err != nil || !preview.CanApply {
		t.Fatalf("preview real-group catalog: preview=%#v err=%v", preview, err)
	}
	if preview.Summary.GroupsUnchanged != 2 || preview.Summary.GroupsCreated != 0 || preview.Summary.GroupsUpdated != 0 || preview.Summary.PlansCreated != 1 {
		t.Fatalf("unexpected real-group preview summary: %#v", preview.Summary)
	}
	if _, err := svc.ApplyCatalogImport(ctx, PaymentCatalogImportApplyRequest{Catalog: req, PreviewToken: preview.PreviewToken}); err != nil {
		t.Fatalf("apply real-group catalog: %v", err)
	}

	storedPlan, err := client.SubscriptionPlan.Query().Where(subscriptionplan.NameEQ("Lite")).WithGroups().Only(ctx)
	if err != nil {
		t.Fatalf("load real-group plan: %v", err)
	}
	if storedPlan.GroupID != firstGroup.ID || len(storedPlan.Edges.Groups) != 2 {
		t.Fatalf("real groups were not attached to plan: %#v", storedPlan)
	}
	storedFirst, err := client.Group.Get(ctx, firstGroup.ID)
	if err != nil {
		t.Fatalf("reload first real group: %v", err)
	}
	storedSecond, err := client.Group.Get(ctx, secondGroup.ID)
	if err != nil {
		t.Fatalf("reload second real group: %v", err)
	}
	if storedFirst.RateMultiplier != 0.1 || storedFirst.Description == nil || *storedFirst.Description != "first routing group" || storedSecond.RateMultiplier != 0.2 {
		t.Fatalf("referenced real groups were mutated: first=%#v second=%#v", storedFirst, storedSecond)
	}

	repeat, err := svc.PreviewCatalogImport(ctx, req)
	if err != nil || !repeat.CanApply || repeat.Summary.PlansUnchanged != 1 {
		t.Fatalf("real-group import is not idempotent: preview=%#v err=%v", repeat, err)
	}
	exported, err := svc.ExportCatalog(ctx)
	if err != nil {
		t.Fatalf("export real-group catalog: %v", err)
	}
	if len(exported.Plans) != 1 || exported.Plans[0].GroupID != nil || exported.Plans[0].GroupKey != "" {
		t.Fatalf("legacy primary-group fields were exported: %#v", exported.Plans)
	}
	if len(exported.Plans[0].IncludedGroupIDs) != 2 || len(exported.Plans[0].IncludedGroupKeys) != 0 {
		t.Fatalf("real included group IDs were not exported: %#v", exported.Plans[0])
	}
}

func TestPaymentCatalogImportRejectsMissingAndInactiveRealGroupReferences(t *testing.T) {
	svc, client := newCatalogImportTestService(t)
	ctx := context.Background()
	inactive, err := client.Group.Create().
		SetName("Inactive real group").
		SetPlatform(PlatformOpenAI).
		SetSubscriptionType(SubscriptionTypeStandard).
		SetStatus(StatusDisabled).
		Save(ctx)
	if err != nil {
		t.Fatalf("create inactive real group: %v", err)
	}

	req := catalogTestRequest()
	req.Groups = nil
	req.Plans[0].GroupKey = ""
	missingID := int64(999999)
	req.Plans[0].GroupID = &missingID
	req.Plans[0].IncludedGroupIDs = []int64{inactive.ID}
	preview, err := svc.PreviewCatalogImport(ctx, req)
	if err != nil {
		t.Fatalf("preview invalid real-group references: %v", err)
	}
	if preview.CanApply {
		t.Fatalf("invalid real-group references must block apply: %#v", preview)
	}
	codes := make(map[string]bool)
	for _, issue := range preview.Issues {
		codes[issue.Code] = true
	}
	if !codes["GROUP_ID_NOT_FOUND"] || !codes["GROUP_ID_INACTIVE"] {
		t.Fatalf("missing reference issues: %#v", preview.Issues)
	}
}

func TestPaymentCatalogImportAllowsMixedLegacyKeysAndRealGroupIDs(t *testing.T) {
	svc, client := newCatalogImportTestService(t)
	ctx := context.Background()
	realGroup, err := client.Group.Create().
		SetName("Existing 0.2x group").
		SetPlatform(PlatformOpenAI).
		SetSubscriptionType(SubscriptionTypeStandard).
		SetStatus(StatusActive).
		SetRateMultiplier(0.2).
		Save(ctx)
	if err != nil {
		t.Fatalf("create real group: %v", err)
	}
	req := catalogTestRequest()
	req.Plans[0].IncludedGroupIDs = []int64{realGroup.ID}

	preview, err := svc.PreviewCatalogImport(ctx, req)
	if err != nil || !preview.CanApply {
		t.Fatalf("preview mixed references: preview=%#v err=%v", preview, err)
	}
	if _, err := svc.ApplyCatalogImport(ctx, PaymentCatalogImportApplyRequest{Catalog: req, PreviewToken: preview.PreviewToken}); err != nil {
		t.Fatalf("apply mixed references: %v", err)
	}
	stored, err := client.SubscriptionPlan.Query().Where(subscriptionplan.NameEQ("Lite")).WithGroups().Only(ctx)
	if err != nil || len(stored.Edges.Groups) != 2 {
		t.Fatalf("mixed references were not attached: plan=%#v err=%v", stored, err)
	}
}

func TestPaymentCatalogImportPreviewUsesJSONArrayCollections(t *testing.T) {
	svc, _ := newCatalogImportTestService(t)
	req := catalogTestRequest()
	req.Groups = []PaymentCatalogImportGroup{}
	req.Plans = []PaymentCatalogImportPlan{}

	preview, err := svc.PreviewCatalogImport(context.Background(), req)
	if err != nil {
		t.Fatalf("preview empty catalog: %v", err)
	}
	if preview.Issues == nil || preview.Changes == nil {
		t.Fatalf("preview collections must be non-nil: issues=%#v changes=%#v", preview.Issues, preview.Changes)
	}

	encoded, err := json.Marshal(preview)
	if err != nil {
		t.Fatalf("marshal preview: %v", err)
	}
	var payload map[string]any
	if err := json.Unmarshal(encoded, &payload); err != nil {
		t.Fatalf("decode preview: %v", err)
	}
	if _, ok := payload["issues"].([]any); !ok {
		t.Fatalf("issues must serialize as an array: %s", encoded)
	}
	if _, ok := payload["changes"].([]any); !ok {
		t.Fatalf("changes must serialize as an array: %s", encoded)
	}
}

func TestPaymentCatalogImportRejectsStalePreview(t *testing.T) {
	svc, client := newCatalogImportTestService(t)
	ctx := context.Background()
	req := catalogTestRequest()
	preview, err := svc.PreviewCatalogImport(ctx, req)
	if err != nil {
		t.Fatalf("preview: %v", err)
	}
	if _, err := client.Group.Create().
		SetName("Lite subscription").
		SetDescription("concurrent change").
		SetPlatform(PlatformComposite).
		SetSubscriptionType(SubscriptionTypeSubscription).
		Save(ctx); err != nil {
		t.Fatalf("create concurrent group: %v", err)
	}
	if _, err := svc.ApplyCatalogImport(ctx, PaymentCatalogImportApplyRequest{Catalog: req, PreviewToken: preview.PreviewToken}); err == nil {
		t.Fatal("expected stale preview to be rejected")
	}
}

func TestPaymentCatalogImportClearsNullableFields(t *testing.T) {
	svc, client := newCatalogImportTestService(t)
	ctx := context.Background()
	req := catalogTestRequest()
	preview, err := svc.PreviewCatalogImport(ctx, req)
	if err != nil {
		t.Fatalf("preview initial import: %v", err)
	}
	if _, err := svc.ApplyCatalogImport(ctx, PaymentCatalogImportApplyRequest{Catalog: req, PreviewToken: preview.PreviewToken}); err != nil {
		t.Fatalf("apply initial import: %v", err)
	}

	req.Groups[0].WeeklyLimitUSD = nil
	req.Groups[0].MonthlyLimitUSD = nil
	req.Plans[0].OriginalPrice = nil
	preview, err = svc.PreviewCatalogImport(ctx, req)
	if err != nil {
		t.Fatalf("preview clearing fields: %v", err)
	}
	if _, err := svc.ApplyCatalogImport(ctx, PaymentCatalogImportApplyRequest{Catalog: req, PreviewToken: preview.PreviewToken}); err != nil {
		t.Fatalf("apply clearing fields: %v", err)
	}

	storedGroup, err := client.Group.Query().Where(group.NameEQ("Lite subscription")).Only(ctx)
	if err != nil {
		t.Fatalf("load group: %v", err)
	}
	if storedGroup.WeeklyLimitUsd != nil || storedGroup.MonthlyLimitUsd != nil {
		t.Fatalf("nullable group quotas were not cleared: weekly=%v monthly=%v", storedGroup.WeeklyLimitUsd, storedGroup.MonthlyLimitUsd)
	}
	storedPlan, err := client.SubscriptionPlan.Query().Where(subscriptionplan.NameEQ("Lite")).Only(ctx)
	if err != nil {
		t.Fatalf("load plan: %v", err)
	}
	if storedPlan.OriginalPrice != nil {
		t.Fatalf("original price was not cleared: %v", storedPlan.OriginalPrice)
	}
}

func TestUpdatePlanCycleQuotaOmittedAndExplicitNull(t *testing.T) {
	svc, client := newCatalogImportTestService(t)
	ctx := context.Background()
	req := catalogTestRequest()
	preview, err := svc.PreviewCatalogImport(ctx, req)
	if err != nil {
		t.Fatalf("preview initial import: %v", err)
	}
	if _, err := svc.ApplyCatalogImport(ctx, PaymentCatalogImportApplyRequest{Catalog: req, PreviewToken: preview.PreviewToken}); err != nil {
		t.Fatalf("apply initial import: %v", err)
	}

	stored, err := client.SubscriptionPlan.Query().Where(subscriptionplan.NameEQ("Lite")).Only(ctx)
	if err != nil {
		t.Fatalf("load plan: %v", err)
	}

	var omitted UpdatePlanRequest
	if err := json.Unmarshal([]byte(`{"description":"updated"}`), &omitted); err != nil {
		t.Fatalf("decode omitted patch: %v", err)
	}
	updated, err := svc.UpdatePlan(ctx, stored.ID, omitted)
	if err != nil {
		t.Fatalf("update omitted patch: %v", err)
	}
	if updated.CycleQuotaUsd == nil || *updated.CycleQuotaUsd != 5 || updated.ResetIntervalSeconds != 604800 {
		t.Fatalf("omitted cycle fields changed: quota=%v reset=%d", updated.CycleQuotaUsd, updated.ResetIntervalSeconds)
	}

	var clear UpdatePlanRequest
	if err := json.Unmarshal([]byte(`{"cycle_quota_usd":null}`), &clear); err != nil {
		t.Fatalf("decode clear patch: %v", err)
	}
	updated, err = svc.UpdatePlan(ctx, stored.ID, clear)
	if err != nil {
		t.Fatalf("clear cycle quota: %v", err)
	}
	if updated.CycleQuotaUsd != nil || updated.ResetIntervalSeconds != 0 {
		t.Fatalf("cycle quota was not cleared atomically: quota=%v reset=%d", updated.CycleQuotaUsd, updated.ResetIntervalSeconds)
	}
}

func TestPaymentCatalogImportRollsBackOnFailure(t *testing.T) {
	svc, client := newCatalogImportTestService(t)
	ctx := context.Background()
	req := catalogTestRequest()
	preview, err := svc.PreviewCatalogImport(ctx, req)
	if err != nil {
		t.Fatalf("preview: %v", err)
	}
	if _, err := client.ExecContext(ctx, `
		CREATE TRIGGER reject_catalog_plan
		BEFORE INSERT ON subscription_plans
		BEGIN
			SELECT RAISE(FAIL, 'forced plan failure');
		END
	`); err != nil {
		t.Fatalf("create failure trigger: %v", err)
	}
	if _, err := svc.ApplyCatalogImport(ctx, PaymentCatalogImportApplyRequest{Catalog: req, PreviewToken: preview.PreviewToken}); err == nil {
		t.Fatal("expected import failure")
	}
	groupCount, _ := client.Group.Query().Where(group.NameEQ("Lite subscription")).Count(ctx)
	planCount, _ := client.SubscriptionPlan.Query().Where(subscriptionplan.NameEQ("Lite")).Count(ctx)
	if groupCount != 0 || planCount != 0 {
		t.Fatalf("failed import was not rolled back: groups=%d plans=%d", groupCount, planCount)
	}
}

func TestPaymentCatalogExportIsSafeAndReimportable(t *testing.T) {
	svc, _ := newCatalogImportTestService(t)
	ctx := context.Background()
	req := catalogTestRequest()
	preview, err := svc.PreviewCatalogImport(ctx, req)
	if err != nil {
		t.Fatalf("preview: %v", err)
	}
	if _, err := svc.ApplyCatalogImport(ctx, PaymentCatalogImportApplyRequest{Catalog: req, PreviewToken: preview.PreviewToken}); err != nil {
		t.Fatalf("apply: %v", err)
	}
	exported, err := svc.ExportCatalog(ctx)
	if err != nil {
		t.Fatalf("export: %v", err)
	}
	if exported.SchemaVersion != PaymentCatalogSchemaVersion || len(exported.Groups) != 1 || len(exported.Plans) != 1 {
		t.Fatalf("unexpected export: %#v", exported)
	}
	if preview, err := svc.PreviewCatalogImport(ctx, *exported); err != nil || !preview.CanApply {
		t.Fatalf("export is not re-importable: preview=%#v err=%v", preview, err)
	}
	encoded, err := json.Marshal(exported)
	if err != nil {
		t.Fatalf("marshal export: %v", err)
	}
	var generic map[string]any
	if err := json.Unmarshal(encoded, &generic); err != nil {
		t.Fatalf("decode export: %v", err)
	}
	for _, forbidden := range []string{"users", "orders", "api_keys", "provider_credentials", "upstream_tokens"} {
		if _, exists := generic[forbidden]; exists {
			t.Fatalf("unsafe export field %q is present", forbidden)
		}
	}
}
