package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	dbent "github.com/Wei-Shaw/sub2api/ent"
	"github.com/Wei-Shaw/sub2api/ent/group"
	"github.com/Wei-Shaw/sub2api/ent/schema/mixins"
	"github.com/Wei-Shaw/sub2api/ent/subscriptionplan"
	"github.com/Wei-Shaw/sub2api/ent/subscriptionplangroup"
	"github.com/Wei-Shaw/sub2api/ent/usersubscription"
	"github.com/Wei-Shaw/sub2api/internal/payment"
	infraerrors "github.com/Wei-Shaw/sub2api/internal/pkg/errors"
)

// normalizePlanCurrency validates and normalizes the display-only currency label.
// Empty means "no label" and is kept as-is so existing plans stay unchanged.
func normalizePlanCurrency(raw string) (string, error) {
	if strings.TrimSpace(raw) == "" {
		return "", nil
	}
	currency, err := payment.NormalizePaymentCurrency(raw)
	if err != nil {
		return "", infraerrors.BadRequest("PLAN_CURRENCY_INVALID", "currency must be a 3-letter ISO currency code")
	}
	return currency, nil
}

// validatePlanRequired checks that all required fields for a plan are provided.
func validatePlanRequired(name string, price float64, validityDays int, validityUnit string, originalPrice *float64) error {
	if strings.TrimSpace(name) == "" {
		return infraerrors.BadRequest("PLAN_NAME_REQUIRED", "plan name is required")
	}
	if price <= 0 {
		return infraerrors.BadRequest("PLAN_PRICE_INVALID", "price must be > 0")
	}
	if validityDays <= 0 {
		return infraerrors.BadRequest("PLAN_VALIDITY_REQUIRED", "validity days must be > 0")
	}
	if strings.TrimSpace(validityUnit) == "" {
		return infraerrors.BadRequest("PLAN_VALIDITY_UNIT_REQUIRED", "validity unit is required")
	}
	if originalPrice != nil && *originalPrice < 0 {
		return infraerrors.BadRequest("PLAN_ORIGINAL_PRICE_INVALID", "original price must be >= 0")
	}
	return nil
}

func validatePlanCycle(cycleQuotaUSD *float64, resetIntervalSeconds int) error {
	if cycleQuotaUSD != nil && *cycleQuotaUSD <= 0 {
		return infraerrors.BadRequest("PLAN_CYCLE_QUOTA_INVALID", "cycle quota must be > 0")
	}
	if resetIntervalSeconds < 0 {
		return infraerrors.BadRequest("PLAN_RESET_INTERVAL_INVALID", "reset interval must be >= 0")
	}
	if cycleQuotaUSD != nil && resetIntervalSeconds <= 0 {
		return infraerrors.BadRequest("PLAN_RESET_INTERVAL_REQUIRED", "reset interval is required when cycle quota is set")
	}
	return nil
}

// validatePlanPatch validates only the non-nil fields in a patch update.
func validatePlanPatch(req UpdatePlanRequest) error {
	if req.Name != nil && strings.TrimSpace(*req.Name) == "" {
		return infraerrors.BadRequest("PLAN_NAME_REQUIRED", "plan name is required")
	}
	if req.Price != nil && *req.Price <= 0 {
		return infraerrors.BadRequest("PLAN_PRICE_INVALID", "price must be > 0")
	}
	if req.ValidityDays != nil && *req.ValidityDays <= 0 {
		return infraerrors.BadRequest("PLAN_VALIDITY_REQUIRED", "validity days must be > 0")
	}
	if req.ValidityUnit != nil && strings.TrimSpace(*req.ValidityUnit) == "" {
		return infraerrors.BadRequest("PLAN_VALIDITY_UNIT_REQUIRED", "validity unit is required")
	}
	if req.OriginalPrice != nil && *req.OriginalPrice < 0 {
		return infraerrors.BadRequest("PLAN_ORIGINAL_PRICE_INVALID", "original price must be >= 0")
	}
	if req.CycleQuotaUSD != nil && *req.CycleQuotaUSD <= 0 {
		return infraerrors.BadRequest("PLAN_CYCLE_QUOTA_INVALID", "cycle quota must be > 0")
	}
	if req.ResetIntervalSeconds != nil && *req.ResetIntervalSeconds < 0 {
		return infraerrors.BadRequest("PLAN_RESET_INTERVAL_INVALID", "reset interval must be >= 0")
	}
	return nil
}

// --- Plan CRUD ---

const (
	legacyMigratedPlanProductPrefix = "legacy-group-"
	legacyMigratedPlanDescription   = "Automatically migrated from a legacy group-bound subscription."
	legacyUnresolvedPlanProductName = "legacy-unresolved-subscription-codes"
	legacyUnresolvedPlanDescription = "Historical subscription codes whose deleted group could not be reconstructed."
)

// visibleCatalogPlanQuery excludes internal compatibility rows created while
// migrating legacy group-bound entitlements. They must remain addressable by
// historical subscriptions, but they are not administrator-managed products.
func visibleCatalogPlanQuery(query *dbent.SubscriptionPlanQuery) *dbent.SubscriptionPlanQuery {
	return query.Where(subscriptionplan.Not(subscriptionplan.Or(
		subscriptionplan.And(
			subscriptionplan.ProductNameHasPrefix(legacyMigratedPlanProductPrefix),
			subscriptionplan.DescriptionEQ(legacyMigratedPlanDescription),
			subscriptionplan.PriceEQ(0),
			subscriptionplan.ForSaleEQ(false),
		),
		subscriptionplan.And(
			subscriptionplan.ProductNameEQ(legacyUnresolvedPlanProductName),
			subscriptionplan.DescriptionEQ(legacyUnresolvedPlanDescription),
			subscriptionplan.PriceEQ(0),
			subscriptionplan.ForSaleEQ(false),
		),
	)))
}

// PlanGroupInfo holds the group details needed for subscription plan display.
type PlanGroupInfo struct {
	ID                 int64    `json:"id"`
	Platform           string   `json:"platform"`
	Name               string   `json:"name"`
	RateMultiplier     float64  `json:"rate_multiplier"`
	PeakRateEnabled    bool     `json:"peak_rate_enabled"`
	PeakStart          string   `json:"peak_start"`
	PeakEnd            string   `json:"peak_end"`
	PeakRateMultiplier float64  `json:"peak_rate_multiplier"`
	DailyLimitUSD      *float64 `json:"daily_limit_usd"`
	WeeklyLimitUSD     *float64 `json:"weekly_limit_usd"`
	MonthlyLimitUSD    *float64 `json:"monthly_limit_usd"`
	ModelScopes        []string `json:"supported_model_scopes"`
}

func IncludedPlanGroupInfo(plan *dbent.SubscriptionPlan, groupInfo map[int64]PlanGroupInfo) []PlanGroupInfo {
	if plan == nil {
		return []PlanGroupInfo{}
	}
	ids := planIncludedGroupIDs(plan)
	out := make([]PlanGroupInfo, 0, len(ids))
	for _, id := range ids {
		if info, ok := groupInfo[id]; ok {
			out = append(out, info)
		}
	}
	return out
}

// GetGroupInfoMap returns a map of group_id → PlanGroupInfo for the given plans.
func (s *PaymentConfigService) GetGroupInfoMap(ctx context.Context, plans []*dbent.SubscriptionPlan) map[int64]PlanGroupInfo {
	ids := make([]int64, 0, len(plans))
	seen := make(map[int64]bool)
	for _, p := range plans {
		for _, includedGroup := range p.Edges.Groups {
			if includedGroup != nil && !seen[includedGroup.ID] {
				seen[includedGroup.ID] = true
				ids = append(ids, includedGroup.ID)
			}
		}
	}
	if len(ids) == 0 {
		return nil
	}
	groups, err := s.entClient.Group.Query().Where(group.IDIn(ids...)).All(ctx)
	if err != nil {
		return nil
	}
	m := make(map[int64]PlanGroupInfo, len(groups))
	for _, g := range groups {
		m[int64(g.ID)] = PlanGroupInfo{
			ID:                 int64(g.ID),
			Platform:           g.Platform,
			Name:               g.Name,
			RateMultiplier:     g.RateMultiplier,
			PeakRateEnabled:    g.PeakRateEnabled,
			PeakStart:          g.PeakStart,
			PeakEnd:            g.PeakEnd,
			PeakRateMultiplier: g.PeakRateMultiplier,
			DailyLimitUSD:      g.DailyLimitUsd,
			WeeklyLimitUSD:     g.WeeklyLimitUsd,
			MonthlyLimitUSD:    g.MonthlyLimitUsd,
			ModelScopes:        g.SupportedModelScopes,
		}
	}
	return m
}

func (s *PaymentConfigService) ListPlans(ctx context.Context) ([]*dbent.SubscriptionPlan, error) {
	return visibleCatalogPlanQuery(s.entClient.SubscriptionPlan.Query()).WithGroups().Order(subscriptionplan.BySortOrder()).All(ctx)
}

func (s *PaymentConfigService) ListPlansForSale(ctx context.Context) ([]*dbent.SubscriptionPlan, error) {
	return visibleCatalogPlanQuery(s.entClient.SubscriptionPlan.Query()).
		Where(subscriptionplan.ForSaleEQ(true)).
		WithGroups().
		Order(subscriptionplan.BySortOrder()).
		All(ctx)
}

func (s *PaymentConfigService) CreatePlan(ctx context.Context, req CreatePlanRequest) (*dbent.SubscriptionPlan, error) {
	includedGroupIDs := normalizePlanGroupIDs(req.IncludedGroupIDs)
	if err := validatePlanRequired(req.Name, req.Price, req.ValidityDays, req.ValidityUnit, req.OriginalPrice); err != nil {
		return nil, err
	}
	if err := validatePlanCycle(req.CycleQuotaUSD, req.ResetIntervalSeconds); err != nil {
		return nil, err
	}
	currency, err := normalizePlanCurrency(req.Currency)
	if err != nil {
		return nil, err
	}
	if err := s.validatePlanIncludedGroups(ctx, includedGroupIDs); err != nil {
		return nil, err
	}
	b := s.entClient.SubscriptionPlan.Create().
		SetName(req.Name).SetDescription(req.Description).
		SetPrice(req.Price).SetCurrency(currency).SetValidityDays(req.ValidityDays).SetValidityUnit(req.ValidityUnit).
		SetFeatures(req.Features).SetProductName(req.ProductName).
		SetForSale(req.ForSale).SetSortOrder(req.SortOrder).
		SetNillableCycleQuotaUsd(req.CycleQuotaUSD).
		SetResetIntervalSeconds(req.ResetIntervalSeconds).
		AddGroupIDs(includedGroupIDs...)
	if req.WalletFallbackEnabled != nil {
		b.SetWalletFallbackEnabled(*req.WalletFallbackEnabled)
	}
	if req.OriginalPrice != nil {
		b.SetOriginalPrice(*req.OriginalPrice)
	}
	plan, err := b.Save(ctx)
	if err != nil {
		return nil, err
	}
	return s.GetPlan(ctx, plan.ID)
}

// UpdatePlan updates a subscription plan by ID (patch semantics).
// NOTE: This function exceeds 30 lines due to per-field nil-check patch update boilerplate
// plus a validation guard for non-nil fields.
func (s *PaymentConfigService) UpdatePlan(ctx context.Context, id int64, req UpdatePlanRequest) (*dbent.SubscriptionPlan, error) {
	if err := validatePlanPatch(req); err != nil {
		return nil, err
	}
	current, err := s.GetPlan(ctx, id)
	if err != nil {
		return nil, err
	}
	cycleQuotaUSD := current.CycleQuotaUsd
	resetIntervalSeconds := current.ResetIntervalSeconds
	cycleQuotaSet := req.CycleQuotaUSDSet || req.CycleQuotaUSD != nil
	cycleQuotaCleared := cycleQuotaSet && req.CycleQuotaUSD == nil
	if cycleQuotaSet {
		cycleQuotaUSD = req.CycleQuotaUSD
	}
	if cycleQuotaCleared {
		resetIntervalSeconds = 0
	} else if req.ResetIntervalSeconds != nil {
		resetIntervalSeconds = *req.ResetIntervalSeconds
	}
	if err := validatePlanCycle(cycleQuotaUSD, resetIntervalSeconds); err != nil {
		return nil, err
	}
	u := s.entClient.SubscriptionPlan.UpdateOneID(id)
	if req.Name != nil {
		u.SetName(*req.Name)
	}
	if req.Description != nil {
		u.SetDescription(*req.Description)
	}
	if req.Price != nil {
		u.SetPrice(*req.Price)
	}
	if req.OriginalPrice != nil {
		u.SetOriginalPrice(*req.OriginalPrice)
	}
	if cycleQuotaSet {
		if cycleQuotaCleared {
			u.ClearCycleQuotaUsd()
		} else {
			u.SetCycleQuotaUsd(*req.CycleQuotaUSD)
		}
	}
	if cycleQuotaCleared || req.ResetIntervalSeconds != nil {
		u.SetResetIntervalSeconds(resetIntervalSeconds)
	}
	if req.WalletFallbackEnabled != nil {
		u.SetWalletFallbackEnabled(*req.WalletFallbackEnabled)
	}
	if req.Currency != nil {
		currency, err := normalizePlanCurrency(*req.Currency)
		if err != nil {
			return nil, err
		}
		u.SetCurrency(currency)
	}
	if req.ValidityDays != nil {
		u.SetValidityDays(*req.ValidityDays)
	}
	if req.ValidityUnit != nil {
		u.SetValidityUnit(*req.ValidityUnit)
	}
	if req.Features != nil {
		u.SetFeatures(*req.Features)
	}
	if req.ProductName != nil {
		u.SetProductName(*req.ProductName)
	}
	if req.ForSale != nil {
		u.SetForSale(*req.ForSale)
	}
	if req.SortOrder != nil {
		u.SetSortOrder(*req.SortOrder)
	}
	if req.IncludedGroupIDs != nil {
		ids := normalizePlanGroupIDs(*req.IncludedGroupIDs)
		if err := s.validatePlanIncludedGroups(ctx, ids); err != nil {
			return nil, err
		}
		if err := s.requirePlanGroupRemovalConfirmation(ctx, id, ids, req.ConfirmGroupRemoval); err != nil {
			return nil, err
		}
		u.ClearGroups().AddGroupIDs(ids...)
	}
	if _, err := u.Save(ctx); err != nil {
		return nil, err
	}
	return s.GetPlan(ctx, id)
}

func planIncludedGroupIDs(plan *dbent.SubscriptionPlan) []int64 {
	if plan == nil {
		return nil
	}
	ids := make([]int64, 0, len(plan.Edges.Groups))
	for _, includedGroup := range plan.Edges.Groups {
		if includedGroup != nil {
			ids = append(ids, includedGroup.ID)
		}
	}
	return ids
}

func (s *PaymentConfigService) validatePlanIncludedGroups(ctx context.Context, ids []int64) error {
	ids = normalizePlanGroupIDs(ids)
	if len(ids) == 0 {
		return infraerrors.BadRequest("PLAN_GROUP_REQUIRED", "at least one included group is required")
	}
	count, err := s.entClient.Group.Query().Where(
		group.IDIn(ids...),
		group.StatusEQ(payment.EntityStatusActive),
		group.SubscriptionTypeEQ(SubscriptionTypeStandard),
	).Count(ctx)
	if err != nil {
		return fmt.Errorf("validate included groups: %w", err)
	}
	if count != len(ids) {
		return infraerrors.BadRequest("PLAN_GROUP_INVALID", "all included groups must exist, be active, and use standard routing type")
	}
	return nil
}

func (s *PaymentConfigService) DeletePlan(ctx context.Context, id int64) error {
	count, err := s.countPendingOrdersByPlan(ctx, id)
	if err != nil {
		return fmt.Errorf("check pending orders: %w", err)
	}
	if count > 0 {
		return infraerrors.Conflict("PENDING_ORDERS",
			fmt.Sprintf("this plan has %d in-progress orders and cannot be deleted — wait for orders to complete first", count))
	}
	subscriptionCount, err := s.entClient.UserSubscription.Query().
		Where(usersubscription.PlanIDEQ(id)).
		Count(mixins.SkipSoftDelete(ctx))
	if err != nil {
		return fmt.Errorf("check existing subscriptions: %w", err)
	}
	if subscriptionCount > 0 {
		return infraerrors.Conflict("PLAN_HAS_SUBSCRIPTIONS",
			fmt.Sprintf("this plan has %d subscription records and cannot be deleted; disable sale instead", subscriptionCount))
	}
	tx, err := s.entClient.Tx(ctx)
	if err != nil {
		return fmt.Errorf("begin plan deletion: %w", err)
	}
	defer func() { _ = tx.Rollback() }()
	if _, err := tx.SubscriptionPlanGroup.Delete().
		Where(subscriptionplangroup.PlanIDEQ(id)).
		Exec(ctx); err != nil {
		return fmt.Errorf("delete plan group links: %w", err)
	}
	if err := tx.SubscriptionPlan.DeleteOneID(id).Exec(ctx); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit plan deletion: %w", err)
	}
	return nil
}

// GetPlan returns a subscription plan by ID.
func (s *PaymentConfigService) GetPlan(ctx context.Context, id int64) (*dbent.SubscriptionPlan, error) {
	plan, err := s.entClient.SubscriptionPlan.Query().Where(subscriptionplan.IDEQ(id)).WithGroups().Only(ctx)
	if err != nil {
		return nil, infraerrors.NotFound("PLAN_NOT_FOUND", "subscription plan not found")
	}
	return plan, nil
}

func normalizePlanGroupIDs(values []int64) []int64 {
	seen := make(map[int64]struct{}, len(values))
	out := make([]int64, 0, len(values))
	for _, id := range values {
		if id <= 0 {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, id)
	}
	return out
}

func (s *PaymentConfigService) requirePlanGroupRemovalConfirmation(ctx context.Context, planID int64, next []int64, confirmed bool) error {
	current, err := s.GetPlan(ctx, planID)
	if err != nil {
		return err
	}
	nextSet := make(map[int64]struct{}, len(next))
	for _, id := range next {
		nextSet[id] = struct{}{}
	}
	removed := false
	for _, g := range current.Edges.Groups {
		if _, ok := nextSet[g.ID]; !ok {
			removed = true
			break
		}
	}
	if !removed || confirmed {
		return nil
	}
	affected, err := s.entClient.UserSubscription.Query().Where(
		usersubscription.PlanIDEQ(planID),
		usersubscription.StatusEQ(SubscriptionStatusActive),
		usersubscription.ExpiresAtGT(time.Now()),
	).Count(ctx)
	if err != nil {
		return err
	}
	return infraerrors.Conflict("PLAN_GROUP_REMOVAL_CONFIRMATION_REQUIRED", "removing a covered group requires confirmation").WithMetadata(map[string]string{
		"affected_subscriptions": fmt.Sprintf("%d", affected),
	})
}
