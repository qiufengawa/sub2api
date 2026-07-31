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
			GroupKey:      "lite",
			Name:          "Lite",
			Description:   "28 day plan",
			Price:         12.9,
			OriginalPrice: &originalPrice,
			Currency:      "CNY",
			ValidityDays:  &validity,
			ValidityUnit:  "days",
			Features:      []string{"Weekly reset", "Unused quota does not roll over"},
			ProductName:   "Qiu API Lite",
			ForSale:       catalogBoolPtr(true),
			SortOrder:     &sortOrder,
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
