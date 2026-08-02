package service

// This file implements the versioned, administrator-only subscription catalog
// import.  It deliberately uses a preview/apply pair: the preview is a pure
// read, while apply re-validates the same payload inside one serializable
// transaction before changing any catalog rows.

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"reflect"
	"sort"
	"strings"
	"time"
	"unicode/utf8"

	dbent "github.com/Wei-Shaw/sub2api/ent"
	"github.com/Wei-Shaw/sub2api/ent/account"
	"github.com/Wei-Shaw/sub2api/ent/accountgroup"
	"github.com/Wei-Shaw/sub2api/ent/compositemodelroute"
	"github.com/Wei-Shaw/sub2api/ent/group"
	"github.com/Wei-Shaw/sub2api/ent/setting"
	"github.com/Wei-Shaw/sub2api/ent/subscriptionplan"
	"github.com/Wei-Shaw/sub2api/ent/usersubscription"
	"github.com/Wei-Shaw/sub2api/internal/payment"
	infraerrors "github.com/Wei-Shaw/sub2api/internal/pkg/errors"
)

const (
	PaymentCatalogSchemaVersion = 1
	PaymentCatalogImportMode    = "upsert"
	paymentCatalogMaxGroups     = 100
	paymentCatalogMaxPlans      = 500
	paymentCatalogMaxRoutes     = 1000

	paymentCatalogMaxGroupKeyRunes       = 100
	paymentCatalogMaxDescriptionRunes    = 4000
	paymentCatalogMaxAccountSources      = 100
	paymentCatalogMaxRoutesPerGroup      = 100
	paymentCatalogMaxRouteModelRunes     = 200
	paymentCatalogMaxRouteMatchTypeRunes = 20
	paymentCatalogMaxRoutePlatformRunes  = 50
	paymentCatalogMaxRouteEndpointRunes  = 50
	paymentCatalogMaxRouteNotesRunes     = 4000
	paymentCatalogMaxFeaturesPerPlan     = 50
	paymentCatalogMaxFeatureRunes        = 500
	paymentCatalogMaxProductNameRunes    = 100
)

// PaymentCatalogImportRequest is intentionally a domain format rather than a
// direct Ent/database dump.  It is safe to export and can be reviewed before
// it is applied to another installation.
type PaymentCatalogImportRequest struct {
	SchemaVersion   int                            `json:"schema_version"`
	Mode            string                         `json:"mode"`
	PaymentSettings *PaymentCatalogPaymentSettings `json:"payment_settings,omitempty"`
	Defaults        PaymentCatalogImportDefaults   `json:"defaults"`
	Groups          []PaymentCatalogImportGroup    `json:"groups"`
	Plans           []PaymentCatalogImportPlan     `json:"plans"`
}

type PaymentCatalogPaymentSettings struct {
	BalanceRechargeMultiplier *float64 `json:"balance_recharge_multiplier,omitempty"`
	SubscriptionUSDToCNYRate  *float64 `json:"subscription_usd_to_cny_rate,omitempty"`
}

type PaymentCatalogImportDefaults struct {
	Platform         string   `json:"platform,omitempty"`
	SubscriptionType string   `json:"subscription_type,omitempty"`
	RateMultiplier   *float64 `json:"rate_multiplier,omitempty"`
	IsExclusive      *bool    `json:"is_exclusive,omitempty"`
	Status           string   `json:"status,omitempty"`
	ValidityDays     *int     `json:"validity_days,omitempty"`
	ValidityUnit     string   `json:"validity_unit,omitempty"`
	Currency         string   `json:"currency,omitempty"`
	ForSale          *bool    `json:"for_sale,omitempty"`
}

type PaymentCatalogImportGroup struct {
	Key                 string                      `json:"key"`
	Name                string                      `json:"name"`
	Description         string                      `json:"description,omitempty"`
	Platform            string                      `json:"platform,omitempty"`
	SubscriptionType    string                      `json:"subscription_type,omitempty"`
	RateMultiplier      *float64                    `json:"rate_multiplier,omitempty"`
	IsExclusive         *bool                       `json:"is_exclusive,omitempty"`
	Status              string                      `json:"status,omitempty"`
	DailyLimitUSD       *float64                    `json:"daily_limit_usd"`
	WeeklyLimitUSD      *float64                    `json:"weekly_limit_usd"`
	MonthlyLimitUSD     *float64                    `json:"monthly_limit_usd"`
	DefaultValidityDays *int                        `json:"default_validity_days,omitempty"`
	SortOrder           *int                        `json:"sort_order,omitempty"`
	CopyAccountsFrom    []string                    `json:"copy_accounts_from,omitempty"`
	Routes              []PaymentCatalogImportRoute `json:"routes,omitempty"`
}

type PaymentCatalogImportRoute struct {
	PublicModel    string `json:"public_model"`
	MatchType      string `json:"match_type,omitempty"`
	TargetPlatform string `json:"target_platform"`
	UpstreamModel  string `json:"upstream_model,omitempty"`
	Endpoint       string `json:"endpoint,omitempty"`
	Priority       int    `json:"priority,omitempty"`
	Enabled        *bool  `json:"enabled,omitempty"`
	Notes          string `json:"notes,omitempty"`
}

type PaymentCatalogImportPlan struct {
	GroupKey              string   `json:"group_key,omitempty"`
	GroupID               *int64   `json:"group_id,omitempty"`
	IncludedGroupKeys     []string `json:"included_group_keys,omitempty"`
	IncludedGroupIDs      []int64  `json:"included_group_ids,omitempty"`
	CycleQuotaUSD         *float64 `json:"cycle_quota_usd"`
	ResetIntervalSeconds  int      `json:"reset_interval_seconds,omitempty"`
	WalletFallbackEnabled *bool    `json:"wallet_fallback_enabled,omitempty"`
	Name                  string   `json:"name"`
	Description           string   `json:"description,omitempty"`
	Price                 float64  `json:"price"`
	OriginalPrice         *float64 `json:"original_price"`
	Currency              string   `json:"currency,omitempty"`
	ValidityDays          *int     `json:"validity_days,omitempty"`
	ValidityUnit          string   `json:"validity_unit,omitempty"`
	Features              []string `json:"features,omitempty"`
	ProductName           string   `json:"product_name,omitempty"`
	ForSale               *bool    `json:"for_sale,omitempty"`
	SortOrder             *int     `json:"sort_order,omitempty"`
}

type PaymentCatalogImportApplyRequest struct {
	Catalog      PaymentCatalogImportRequest `json:"catalog"`
	PreviewToken string                      `json:"preview_token"`
}

type PaymentCatalogImportIssue struct {
	Severity string `json:"severity"` // error or warning
	Code     string `json:"code"`
	Path     string `json:"path,omitempty"`
	Message  string `json:"message"`
}

type PaymentCatalogImportFieldDiff struct {
	Field  string `json:"field"`
	Before any    `json:"before"`
	After  any    `json:"after"`
}

type PaymentCatalogImportChange struct {
	Kind                  string                          `json:"kind"`
	Action                string                          `json:"action"`
	Key                   string                          `json:"key"`
	Name                  string                          `json:"name"`
	Fields                []PaymentCatalogImportFieldDiff `json:"fields,omitempty"`
	AffectedSubscriptions int                             `json:"affected_subscriptions,omitempty"`
}

type PaymentCatalogImportSummary struct {
	GroupsCreated   int `json:"groups_created"`
	GroupsUpdated   int `json:"groups_updated"`
	GroupsUnchanged int `json:"groups_unchanged"`
	PlansCreated    int `json:"plans_created"`
	PlansUpdated    int `json:"plans_updated"`
	PlansUnchanged  int `json:"plans_unchanged"`
	RoutesCreated   int `json:"routes_created"`
	RoutesUpdated   int `json:"routes_updated"`
	RoutesUnchanged int `json:"routes_unchanged"`
	BindingsAdded   int `json:"bindings_added"`
	SettingsUpdated int `json:"settings_updated"`
}

type PaymentCatalogImportPreview struct {
	PreviewToken string                       `json:"preview_token"`
	CanApply     bool                         `json:"can_apply"`
	Summary      PaymentCatalogImportSummary  `json:"summary"`
	Changes      []PaymentCatalogImportChange `json:"changes"`
	Issues       []PaymentCatalogImportIssue  `json:"issues"`
}

type PaymentCatalogImportResult struct {
	Summary PaymentCatalogImportSummary  `json:"summary"`
	Changes []PaymentCatalogImportChange `json:"changes,omitempty"`
}

type catalogDefaults struct {
	platform         string
	subscriptionType string
	rateMultiplier   float64
	isExclusive      bool
	status           string
	validityDays     int
	validityUnit     string
	currency         string
	forSale          bool
}

type catalogGroup struct {
	PaymentCatalogImportGroup
	platform         string
	subscriptionType string
	rateMultiplier   float64
	isExclusive      bool
	status           string
	dailyLimit       *float64
	weeklyLimit      *float64
	monthlyLimit     *float64
	validityDays     int
	sortOrder        int
	copySources      []string
	routes           []PaymentCatalogImportRoute
}

type catalogPlan struct {
	PaymentCatalogImportPlan
	groupKey              string
	groupID               *int64
	includedGroupKeys     []string
	includedGroupIDs      []int64
	groupRefs             []catalogGroupRef
	cycleQuotaUSD         *float64
	resetIntervalSeconds  int
	walletFallbackEnabled bool
	currency              string
	validityDays          int
	validityUnit          string
	forSale               bool
	sortOrder             int
	features              []string
}

type catalogGroupRef struct {
	key string
	id  int64
}

type normalizedCatalog struct {
	request  PaymentCatalogImportRequest
	defaults catalogDefaults
	groups   []catalogGroup
	plans    []catalogPlan
	settings *PaymentCatalogPaymentSettings
	issues   []PaymentCatalogImportIssue
}

type catalogEntitySnapshot struct {
	groups map[string][]*dbent.Group
	plans  map[string][]*dbent.SubscriptionPlan
	routes map[int64][]*dbent.CompositeModelRoute
}

// SetCatalogImportCacheServices wires optional post-commit cache invalidators.
// Keeping these optional preserves the lightweight service constructor used by
// unit tests and by recovery tools.
func (s *PaymentConfigService) SetCatalogImportCacheServices(auth APIKeyAuthCacheInvalidator, billing *BillingCacheService) {
	s.catalogAuthInvalidator = auth
	s.catalogBillingCache = billing
}

func (s *PaymentConfigService) normalizeCatalogImport(req PaymentCatalogImportRequest) *normalizedCatalog {
	n := &normalizedCatalog{request: req, settings: req.PaymentSettings}
	add := func(severity, code, path, message string) {
		n.issues = append(n.issues, PaymentCatalogImportIssue{Severity: severity, Code: code, Path: path, Message: message})
	}

	if req.SchemaVersion != PaymentCatalogSchemaVersion {
		add("error", "SCHEMA_VERSION_UNSUPPORTED", "schema_version", fmt.Sprintf("schema_version must be %d", PaymentCatalogSchemaVersion))
	}
	mode := strings.TrimSpace(strings.ToLower(req.Mode))
	if mode == "" {
		mode = PaymentCatalogImportMode
	}
	if mode != PaymentCatalogImportMode {
		add("error", "IMPORT_MODE_UNSUPPORTED", "mode", "only upsert mode is supported")
	}

	defaultValidityRaw := strings.TrimSpace(req.Defaults.ValidityUnit)
	d := catalogDefaults{
		platform:         strings.ToLower(strings.TrimSpace(req.Defaults.Platform)),
		subscriptionType: strings.ToLower(strings.TrimSpace(req.Defaults.SubscriptionType)),
		status:           strings.ToLower(strings.TrimSpace(req.Defaults.Status)),
		validityUnit:     normalizeValidityUnit(req.Defaults.ValidityUnit),
		currency:         strings.ToUpper(strings.TrimSpace(req.Defaults.Currency)),
	}
	if d.platform == "" {
		d.platform = PlatformComposite
	}
	if d.subscriptionType == "" {
		d.subscriptionType = SubscriptionTypeSubscription
	}
	if d.status == "" {
		d.status = StatusActive
	}
	if d.validityUnit == "" && defaultValidityRaw == "" {
		d.validityUnit = "days"
	}
	if d.currency == "" {
		d.currency = "CNY"
	}
	d.rateMultiplier = 1
	if req.Defaults.RateMultiplier != nil {
		d.rateMultiplier = *req.Defaults.RateMultiplier
	}
	d.isExclusive = true
	if req.Defaults.IsExclusive != nil {
		d.isExclusive = *req.Defaults.IsExclusive
	}
	d.validityDays = 28
	if req.Defaults.ValidityDays != nil {
		d.validityDays = *req.Defaults.ValidityDays
	}
	d.forSale = true
	if req.Defaults.ForSale != nil {
		d.forSale = *req.Defaults.ForSale
	}
	if !validCatalogPlatform(d.platform) {
		add("error", "PLATFORM_INVALID", "defaults.platform", "platform is not supported")
	}
	if d.subscriptionType != SubscriptionTypeSubscription {
		add("error", "SUBSCRIPTION_TYPE_INVALID", "defaults.subscription_type", "catalog groups must use subscription type")
	}
	if d.status != StatusActive && d.status != StatusDisabled {
		add("error", "STATUS_INVALID", "defaults.status", "status must be active or disabled")
	}
	if !finitePositive(d.rateMultiplier) {
		add("error", "RATE_MULTIPLIER_INVALID", "defaults.rate_multiplier", "rate_multiplier must be finite and greater than zero")
	}
	if d.validityDays < 1 || d.validityDays > 3650 {
		add("error", "VALIDITY_INVALID", "defaults.validity_days", "validity_days must be between 1 and 3650")
	}
	if d.validityUnit == "" {
		add("error", "VALIDITY_UNIT_INVALID", "defaults.validity_unit", "validity_unit must be days, weeks, or months")
	}
	if _, err := payment.NormalizePaymentCurrency(d.currency); err != nil {
		add("error", "CURRENCY_INVALID", "defaults.currency", "currency must be a supported 3-letter ISO code")
	}

	if len(req.Groups) > paymentCatalogMaxGroups {
		add("error", "GROUP_COUNT_LIMIT", "groups", fmt.Sprintf("at most %d groups are allowed", paymentCatalogMaxGroups))
	}
	if len(req.Plans) > paymentCatalogMaxPlans {
		add("error", "PLAN_COUNT_LIMIT", "plans", fmt.Sprintf("at most %d plans are allowed", paymentCatalogMaxPlans))
	}

	groups := req.Groups
	if len(groups) > paymentCatalogMaxGroups {
		groups = groups[:paymentCatalogMaxGroups]
	}
	groupKeys := make(map[string]struct{}, len(groups))
	groupNames := make(map[string]struct{}, len(groups))
	routeCount := 0
	for i, raw := range groups {
		path := fmt.Sprintf("groups[%d]", i)
		key := strings.TrimSpace(raw.Key)
		name := strings.TrimSpace(raw.Name)
		if key == "" {
			add("error", "GROUP_KEY_REQUIRED", path+".key", "group key is required")
		} else if utf8.RuneCountInString(key) > paymentCatalogMaxGroupKeyRunes {
			add("error", "GROUP_KEY_INVALID", path+".key", fmt.Sprintf("group key must be at most %d characters", paymentCatalogMaxGroupKeyRunes))
		}
		if _, ok := groupKeys[key]; ok && key != "" {
			add("error", "GROUP_KEY_DUPLICATE", path+".key", "group key must be unique")
		}
		if key != "" {
			groupKeys[key] = struct{}{}
		}
		if name == "" || len([]rune(name)) > 100 {
			add("error", "GROUP_NAME_INVALID", path+".name", "group name is required and must be at most 100 characters")
		}
		if _, ok := groupNames[name]; ok && name != "" {
			add("error", "GROUP_NAME_DUPLICATE", path+".name", "group name must be unique in the import file")
		}
		if name != "" {
			groupNames[name] = struct{}{}
		}
		raw.Key = key
		raw.Name = name
		raw.Description = strings.TrimSpace(raw.Description)
		if utf8.RuneCountInString(raw.Description) > paymentCatalogMaxDescriptionRunes {
			add("error", "GROUP_DESCRIPTION_INVALID", path+".description", fmt.Sprintf("group description must be at most %d characters", paymentCatalogMaxDescriptionRunes))
		}
		platform := d.platform
		if strings.TrimSpace(raw.Platform) != "" {
			platform = strings.ToLower(strings.TrimSpace(raw.Platform))
		}
		subType := d.subscriptionType
		if strings.TrimSpace(raw.SubscriptionType) != "" {
			subType = strings.ToLower(strings.TrimSpace(raw.SubscriptionType))
		}
		status := d.status
		if strings.TrimSpace(raw.Status) != "" {
			status = strings.ToLower(strings.TrimSpace(raw.Status))
		}
		rate := d.rateMultiplier
		if raw.RateMultiplier != nil {
			rate = *raw.RateMultiplier
		}
		exclusive := d.isExclusive
		if raw.IsExclusive != nil {
			exclusive = *raw.IsExclusive
		}
		validity := d.validityDays
		if raw.DefaultValidityDays != nil {
			validity = *raw.DefaultValidityDays
		}
		sortOrder := 0
		if raw.SortOrder != nil {
			sortOrder = *raw.SortOrder
		}
		if !validCatalogPlatform(platform) {
			add("error", "PLATFORM_INVALID", path+".platform", "platform is not supported")
		}
		if subType != SubscriptionTypeSubscription {
			add("error", "SUBSCRIPTION_TYPE_INVALID", path+".subscription_type", "catalog groups must use subscription type")
		}
		if status != StatusActive && status != StatusDisabled {
			add("error", "STATUS_INVALID", path+".status", "status must be active or disabled")
		}
		if !finitePositive(rate) {
			add("error", "RATE_MULTIPLIER_INVALID", path+".rate_multiplier", "rate_multiplier must be finite and greater than zero")
		}
		if validity < 1 || validity > 3650 {
			add("error", "VALIDITY_INVALID", path+".default_validity_days", "default_validity_days must be between 1 and 3650")
		}
		validateLimit := func(v *float64, fieldName string) {
			if v != nil && (!finiteNumber(*v) || *v < 0) {
				add("error", "LIMIT_INVALID", path+"."+fieldName, "limit must be null or a finite number greater than or equal to zero")
			}
		}
		validateLimit(raw.DailyLimitUSD, "daily_limit_usd")
		validateLimit(raw.WeeklyLimitUSD, "weekly_limit_usd")
		validateLimit(raw.MonthlyLimitUSD, "monthly_limit_usd")
		if sortOrder < 0 {
			add("error", "SORT_ORDER_INVALID", path+".sort_order", "sort_order must be non-negative")
		}
		sourceInputs := raw.CopyAccountsFrom
		if len(sourceInputs) > paymentCatalogMaxAccountSources {
			add("error", "ACCOUNT_SOURCE_COUNT_LIMIT", path+".copy_accounts_from", fmt.Sprintf("at most %d account source groups are allowed", paymentCatalogMaxAccountSources))
			sourceInputs = sourceInputs[:paymentCatalogMaxAccountSources]
		}
		sources := uniqueTrimmed(sourceInputs)
		for j, source := range sources {
			if len([]rune(source)) > 100 {
				add("error", "SOURCE_NAME_INVALID", fmt.Sprintf("%s.copy_accounts_from[%d]", path, j), "source group name is too long")
			}
			if source == name && name != "" {
				add("error", "ACCOUNT_SOURCE_SELF", fmt.Sprintf("%s.copy_accounts_from[%d]", path, j), "group cannot copy accounts from itself")
			}
		}
		routeInputs := raw.Routes
		if len(routeInputs) > paymentCatalogMaxRoutesPerGroup {
			add("error", "ROUTE_GROUP_COUNT_LIMIT", path+".routes", fmt.Sprintf("at most %d routes are allowed per group", paymentCatalogMaxRoutesPerGroup))
			routeInputs = routeInputs[:paymentCatalogMaxRoutesPerGroup]
		}
		routes := make([]PaymentCatalogImportRoute, 0, len(routeInputs))
		routeKeys := make(map[string]struct{}, len(routeInputs))
		for j, route := range routeInputs {
			routePath := fmt.Sprintf("%s.routes[%d]", path, j)
			if utf8.RuneCountInString(strings.TrimSpace(route.PublicModel)) > paymentCatalogMaxRouteModelRunes {
				add("error", "ROUTE_FIELD_INVALID", routePath+".public_model", fmt.Sprintf("public_model must be at most %d characters", paymentCatalogMaxRouteModelRunes))
			}
			if utf8.RuneCountInString(strings.TrimSpace(route.MatchType)) > paymentCatalogMaxRouteMatchTypeRunes {
				add("error", "ROUTE_FIELD_INVALID", routePath+".match_type", fmt.Sprintf("match_type must be at most %d characters", paymentCatalogMaxRouteMatchTypeRunes))
			}
			if utf8.RuneCountInString(strings.TrimSpace(route.TargetPlatform)) > paymentCatalogMaxRoutePlatformRunes {
				add("error", "ROUTE_FIELD_INVALID", routePath+".target_platform", fmt.Sprintf("target_platform must be at most %d characters", paymentCatalogMaxRoutePlatformRunes))
			}
			if utf8.RuneCountInString(strings.TrimSpace(route.UpstreamModel)) > paymentCatalogMaxRouteModelRunes {
				add("error", "ROUTE_FIELD_INVALID", routePath+".upstream_model", fmt.Sprintf("upstream_model must be at most %d characters", paymentCatalogMaxRouteModelRunes))
			}
			if utf8.RuneCountInString(strings.TrimSpace(route.Endpoint)) > paymentCatalogMaxRouteEndpointRunes {
				add("error", "ROUTE_FIELD_INVALID", routePath+".endpoint", fmt.Sprintf("endpoint must be at most %d characters", paymentCatalogMaxRouteEndpointRunes))
			}
			if utf8.RuneCountInString(strings.TrimSpace(route.Notes)) > paymentCatalogMaxRouteNotesRunes {
				add("error", "ROUTE_NOTES_INVALID", routePath+".notes", fmt.Sprintf("route notes must be at most %d characters", paymentCatalogMaxRouteNotesRunes))
			}
			normalized, err := compositeRouteFromInput(0, CompositeRouteInput{
				PublicModel: route.PublicModel, MatchType: route.MatchType, TargetPlatform: route.TargetPlatform,
				UpstreamModel: route.UpstreamModel, Endpoint: route.Endpoint, Priority: route.Priority,
				Enabled: route.Enabled == nil || *route.Enabled, Notes: route.Notes,
			})
			if err != nil {
				add("error", "ROUTE_INVALID", routePath, err.Error())
				continue
			}
			if platform != PlatformComposite {
				add("error", "ROUTE_GROUP_PLATFORM_INVALID", routePath, "routes can only be attached to composite groups")
			}
			routeCount++
			if routeCount > paymentCatalogMaxRoutes {
				add("error", "ROUTE_COUNT_LIMIT", "groups", fmt.Sprintf("at most %d routes are allowed", paymentCatalogMaxRoutes))
				break
			}
			normalizedRoute := PaymentCatalogImportRoute{
				PublicModel: normalized.PublicModel, MatchType: normalized.MatchType, TargetPlatform: normalized.TargetPlatform,
				UpstreamModel: normalized.UpstreamModel, Endpoint: normalized.Endpoint, Priority: normalized.Priority,
				Enabled: catalogBoolPtr(normalized.Enabled), Notes: normalized.Notes,
			}
			routeKey := catalogRouteIdentity(normalizedRoute.PublicModel, normalizedRoute.MatchType, normalizedRoute.Endpoint)
			if _, exists := routeKeys[routeKey]; exists {
				add("error", "ROUTE_DUPLICATE", routePath, "route identity is duplicated in this group")
				continue
			}
			routeKeys[routeKey] = struct{}{}
			routes = append(routes, normalizedRoute)
		}
		n.groups = append(n.groups, catalogGroup{PaymentCatalogImportGroup: raw, platform: platform, subscriptionType: subType, rateMultiplier: rate, isExclusive: exclusive, status: status, dailyLimit: cloneFloat(raw.DailyLimitUSD), weeklyLimit: cloneFloat(raw.WeeklyLimitUSD), monthlyLimit: cloneFloat(raw.MonthlyLimitUSD), validityDays: validity, sortOrder: sortOrder, copySources: sources, routes: routes})
	}

	plans := req.Plans
	if len(plans) > paymentCatalogMaxPlans {
		plans = plans[:paymentCatalogMaxPlans]
	}
	planKeys := make(map[string]struct{}, len(plans))
	for i, raw := range plans {
		path := fmt.Sprintf("plans[%d]", i)
		legacyGroupKey := strings.TrimSpace(raw.GroupKey)
		legacyGroupID := cloneInt64(raw.GroupID)
		if legacyGroupKey != "" && legacyGroupID != nil {
			add("error", "PLAN_GROUP_REFERENCE_AMBIGUOUS", path, "legacy group_key and group_id cannot both be set")
		}
		if legacyGroupKey != "" {
			if _, ok := groupKeys[legacyGroupKey]; !ok {
				add("error", "PLAN_GROUP_UNKNOWN", path+".group_key", "group_key does not reference an imported group")
			}
		}
		if legacyGroupID != nil && *legacyGroupID <= 0 {
			add("error", "PLAN_GROUP_ID_INVALID", path+".group_id", "group_id must be a positive integer")
		}
		includedGroupKeys := normalizeCatalogPlanGroupKeys(legacyGroupKey, raw.IncludedGroupKeys)
		for j, includedGroupKey := range includedGroupKeys {
			if _, ok := groupKeys[includedGroupKey]; !ok {
				add("error", "PLAN_INCLUDED_GROUP_UNKNOWN", fmt.Sprintf("%s.included_group_keys[%d]", path, j), "included_group_keys contains a key that does not reference an imported group")
			}
		}
		for j, includedGroupID := range raw.IncludedGroupIDs {
			if includedGroupID <= 0 {
				add("error", "PLAN_INCLUDED_GROUP_ID_INVALID", fmt.Sprintf("%s.included_group_ids[%d]", path, j), "included_group_ids must contain positive integers")
			}
		}
		includedGroupIDs := normalizeCatalogPlanGroupIDs(legacyGroupID, raw.IncludedGroupIDs)
		if len(includedGroupKeys) == 0 && len(includedGroupIDs) == 0 {
			add("error", "PLAN_GROUP_REQUIRED", path, "at least one included group is required")
		}
		groupKey := legacyGroupKey
		groupID := cloneInt64(legacyGroupID)
		if groupKey == "" && groupID == nil {
			if len(includedGroupKeys) > 0 {
				groupKey = includedGroupKeys[0]
			} else if len(includedGroupIDs) > 0 {
				value := includedGroupIDs[0]
				groupID = &value
			}
		}
		groupRefs := normalizeCatalogPlanGroupRefs("", nil, includedGroupKeys, includedGroupIDs)
		name := strings.TrimSpace(raw.Name)
		if name == "" || len([]rune(name)) > 100 {
			add("error", "PLAN_NAME_INVALID", path+".name", "plan name is required and must be at most 100 characters")
		}
		planKey := catalogPlanImportIdentity(groupKey, groupID, name)
		if _, exists := planKeys[planKey]; exists && planKey != "" && name != "" {
			add("error", "PLAN_DUPLICATE", path, "plan name is duplicated in the same imported group")
		}
		if planKey != "" && name != "" {
			planKeys[planKey] = struct{}{}
		}
		raw.GroupKey = legacyGroupKey
		raw.GroupID = cloneInt64(legacyGroupID)
		raw.IncludedGroupKeys = includedGroupKeys
		raw.IncludedGroupIDs = append([]int64(nil), includedGroupIDs...)
		raw.Name = name
		raw.Description = strings.TrimSpace(raw.Description)
		if utf8.RuneCountInString(raw.Description) > paymentCatalogMaxDescriptionRunes {
			add("error", "PLAN_DESCRIPTION_INVALID", path+".description", fmt.Sprintf("plan description must be at most %d characters", paymentCatalogMaxDescriptionRunes))
		}
		raw.ProductName = strings.TrimSpace(raw.ProductName)
		if utf8.RuneCountInString(raw.ProductName) > paymentCatalogMaxProductNameRunes {
			add("error", "PRODUCT_NAME_INVALID", path+".product_name", fmt.Sprintf("product_name must be at most %d characters", paymentCatalogMaxProductNameRunes))
		}
		if !finitePositive(raw.Price) {
			add("error", "PLAN_PRICE_INVALID", path+".price", "price must be finite and greater than zero")
		}
		original := cloneFloat(raw.OriginalPrice)
		if original != nil && (!finiteNumber(*original) || *original < 0) {
			add("error", "PLAN_ORIGINAL_PRICE_INVALID", path+".original_price", "original_price must be null or a finite number greater than or equal to zero")
		}
		if original != nil && finiteNumber(*original) && *original < raw.Price {
			add("warning", "ORIGINAL_PRICE_BELOW_PRICE", path+".original_price", "original_price is below price")
		}
		cycleQuotaUSD := cloneFloat(raw.CycleQuotaUSD)
		if cycleQuotaUSD != nil && !finitePositive(*cycleQuotaUSD) {
			add("error", "PLAN_CYCLE_QUOTA_INVALID", path+".cycle_quota_usd", "cycle_quota_usd must be null or a finite number greater than zero")
		}
		if raw.ResetIntervalSeconds < 0 {
			add("error", "PLAN_RESET_INTERVAL_INVALID", path+".reset_interval_seconds", "reset_interval_seconds must be greater than or equal to zero")
		}
		if cycleQuotaUSD != nil && raw.ResetIntervalSeconds <= 0 {
			add("error", "PLAN_RESET_INTERVAL_REQUIRED", path+".reset_interval_seconds", "reset_interval_seconds must be greater than zero when cycle_quota_usd is set")
		}
		walletFallbackEnabled := true
		if raw.WalletFallbackEnabled != nil {
			walletFallbackEnabled = *raw.WalletFallbackEnabled
		}
		currency := d.currency
		if strings.TrimSpace(raw.Currency) != "" {
			currency = strings.ToUpper(strings.TrimSpace(raw.Currency))
		}
		if _, err := payment.NormalizePaymentCurrency(currency); err != nil {
			add("error", "CURRENCY_INVALID", path+".currency", "currency must be a supported 3-letter ISO code")
		}
		validityDays := d.validityDays
		if raw.ValidityDays != nil {
			validityDays = *raw.ValidityDays
		}
		validityUnit := d.validityUnit
		if raw.ValidityUnit != "" {
			validityUnit = normalizeValidityUnit(raw.ValidityUnit)
		}
		if validityDays < 1 || validityDays > 3650 {
			add("error", "VALIDITY_INVALID", path+".validity_days", "validity_days must be between 1 and 3650")
		}
		if validityUnit == "" {
			add("error", "VALIDITY_UNIT_INVALID", path+".validity_unit", "validity_unit must be days, weeks, or months")
		}
		featureInputs := raw.Features
		if len(featureInputs) > paymentCatalogMaxFeaturesPerPlan {
			add("error", "FEATURE_COUNT_LIMIT", path+".features", fmt.Sprintf("at most %d features are allowed per plan", paymentCatalogMaxFeaturesPerPlan))
			featureInputs = featureInputs[:paymentCatalogMaxFeaturesPerPlan]
		}
		for j, feature := range featureInputs {
			if utf8.RuneCountInString(strings.TrimSpace(feature)) > paymentCatalogMaxFeatureRunes {
				add("error", "FEATURE_INVALID", fmt.Sprintf("%s.features[%d]", path, j), fmt.Sprintf("feature must be at most %d characters", paymentCatalogMaxFeatureRunes))
			}
		}
		forSale := d.forSale
		if raw.ForSale != nil {
			forSale = *raw.ForSale
		}
		sortOrder := 0
		if raw.SortOrder != nil {
			sortOrder = *raw.SortOrder
		}
		if sortOrder < 0 {
			add("error", "SORT_ORDER_INVALID", path+".sort_order", "sort_order must be non-negative")
		}
		features := make([]string, 0, len(featureInputs))
		for _, f := range featureInputs {
			if f = strings.TrimSpace(f); f != "" {
				features = append(features, f)
			}
		}
		n.plans = append(n.plans, catalogPlan{
			PaymentCatalogImportPlan: raw,
			groupKey:                 groupKey,
			groupID:                  groupID,
			includedGroupKeys:        includedGroupKeys,
			includedGroupIDs:         includedGroupIDs,
			groupRefs:                groupRefs,
			cycleQuotaUSD:            cycleQuotaUSD,
			resetIntervalSeconds:     raw.ResetIntervalSeconds,
			walletFallbackEnabled:    walletFallbackEnabled,
			currency:                 currency,
			validityDays:             validityDays,
			validityUnit:             validityUnit,
			forSale:                  forSale,
			sortOrder:                sortOrder,
			features:                 features,
		})
	}

	if n.settings != nil {
		if n.settings.BalanceRechargeMultiplier != nil && !finitePositive(*n.settings.BalanceRechargeMultiplier) {
			add("error", "BALANCE_MULTIPLIER_INVALID", "payment_settings.balance_recharge_multiplier", "balance recharge multiplier must be finite and greater than zero")
		}
		if n.settings.SubscriptionUSDToCNYRate != nil && (!finiteNumber(*n.settings.SubscriptionUSDToCNYRate) || *n.settings.SubscriptionUSDToCNYRate < 0) {
			add("error", "SUBSCRIPTION_RATE_INVALID", "payment_settings.subscription_usd_to_cny_rate", "subscription USD to CNY rate must be zero or a positive finite number")
		}
	}
	n.defaults = d
	return n
}

func (s *PaymentConfigService) PreviewCatalogImport(ctx context.Context, req PaymentCatalogImportRequest) (*PaymentCatalogImportPreview, error) {
	n := s.normalizeCatalogImport(req)
	preview := &PaymentCatalogImportPreview{
		Issues:  append([]PaymentCatalogImportIssue{}, n.issues...),
		Changes: []PaymentCatalogImportChange{},
	}
	if hasCatalogErrors(n.issues) {
		preview.PreviewToken = catalogPreviewToken(preview)
		return preview, nil
	}
	result, err := s.buildCatalogPreview(ctx, s.entClient, n)
	if err != nil {
		return nil, err
	}
	return result, nil
}

func (s *PaymentConfigService) ApplyCatalogImport(ctx context.Context, req PaymentCatalogImportApplyRequest) (*PaymentCatalogImportResult, error) {
	if strings.TrimSpace(req.PreviewToken) == "" {
		return nil, infraerrors.BadRequest("CATALOG_PREVIEW_REQUIRED", "preview_token is required")
	}
	if s == nil || s.entClient == nil {
		return nil, infraerrors.InternalServer("CATALOG_DB_UNAVAILABLE", "catalog database is unavailable")
	}
	tx, err := s.entClient.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		return nil, fmt.Errorf("begin catalog import transaction: %w", err)
	}
	rollback := true
	defer func() {
		if rollback {
			_ = tx.Rollback()
		}
	}()
	txCtx := dbent.NewTxContext(ctx, tx)
	n := s.normalizeCatalogImport(req.Catalog)
	if hasCatalogErrors(n.issues) {
		return nil, infraerrors.BadRequest("CATALOG_VALIDATION_FAILED", "catalog validation failed")
	}
	preview, err := s.buildCatalogPreview(txCtx, tx.Client(), n)
	if err != nil {
		return nil, err
	}
	if preview.PreviewToken != req.PreviewToken {
		return nil, infraerrors.Conflict("CATALOG_PREVIEW_STALE", "catalog changed after preview; please preview it again")
	}
	if !preview.CanApply {
		return nil, infraerrors.BadRequest("CATALOG_VALIDATION_FAILED", "catalog contains blocking errors")
	}
	effects, err := s.applyCatalogWithinTx(txCtx, tx.Client(), n)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit catalog import: %w", err)
	}
	rollback = false
	// Domain caches are invalidated only after the transaction is durable.
	s.invalidateCatalogCaches(context.WithoutCancel(ctx), effects)
	return &PaymentCatalogImportResult{Summary: preview.Summary, Changes: preview.Changes}, nil
}

func (s *PaymentConfigService) ExportCatalog(ctx context.Context) (*PaymentCatalogImportRequest, error) {
	if s == nil || s.entClient == nil {
		return nil, infraerrors.InternalServer("CATALOG_DB_UNAVAILABLE", "catalog database is unavailable")
	}
	plans, err := s.entClient.SubscriptionPlan.Query().WithGroups().Order(subscriptionplan.BySortOrder()).All(ctx)
	if err != nil {
		return nil, err
	}
	groups, err := s.entClient.Group.Query().Where(group.SubscriptionTypeEQ(SubscriptionTypeSubscription)).Order(group.BySortOrder()).All(ctx)
	if err != nil {
		return nil, err
	}
	settings, err := s.loadCatalogSettings(ctx, s.entClient)
	if err != nil {
		return nil, err
	}
	req := &PaymentCatalogImportRequest{
		SchemaVersion:   PaymentCatalogSchemaVersion,
		Mode:            PaymentCatalogImportMode,
		PaymentSettings: &PaymentCatalogPaymentSettings{BalanceRechargeMultiplier: floatPtr(settings[SettingBalanceRechargeMult]), SubscriptionUSDToCNYRate: floatPtr(settings[SettingSubscriptionUSDToCNYRate])},
		Defaults:        PaymentCatalogImportDefaults{Platform: PlatformComposite, SubscriptionType: SubscriptionTypeSubscription, RateMultiplier: floatPtr(1), IsExclusive: catalogBoolPtr(true), Status: StatusActive, ValidityDays: catalogIntPtr(28), ValidityUnit: "days", Currency: "CNY", ForSale: catalogBoolPtr(true)},
		Groups:          []PaymentCatalogImportGroup{},
		Plans:           []PaymentCatalogImportPlan{},
	}
	for _, g := range groups {
		key := fmt.Sprintf("group_%d", g.ID)
		cg := PaymentCatalogImportGroup{Key: key, Name: g.Name, Description: catalogStringValue(g.Description), Platform: g.Platform, SubscriptionType: g.SubscriptionType, RateMultiplier: floatPtr(g.RateMultiplier), IsExclusive: catalogBoolPtr(g.IsExclusive), Status: g.Status, DailyLimitUSD: cloneFloat(g.DailyLimitUsd), WeeklyLimitUSD: cloneFloat(g.WeeklyLimitUsd), MonthlyLimitUSD: cloneFloat(g.MonthlyLimitUsd), DefaultValidityDays: catalogIntPtr(g.DefaultValidityDays), SortOrder: catalogIntPtr(g.SortOrder)}
		if g.Platform == PlatformComposite {
			routes, routeErr := s.entClient.CompositeModelRoute.Query().Where(compositemodelroute.GroupIDEQ(int64(g.ID))).Order(compositemodelroute.ByPriority()).All(ctx)
			if routeErr != nil {
				return nil, routeErr
			}
			for _, route := range routes {
				cg.Routes = append(cg.Routes, PaymentCatalogImportRoute{PublicModel: route.PublicModel, MatchType: route.MatchType, TargetPlatform: route.TargetPlatform, UpstreamModel: route.UpstreamModel, Endpoint: route.Endpoint, Priority: route.Priority, Enabled: catalogBoolPtr(route.Enabled), Notes: catalogStringValue(route.Notes)})
			}
		}
		req.Groups = append(req.Groups, cg)
	}
	groupIDs := make(map[int64]string, len(groups))
	for _, g := range groups {
		groupIDs[int64(g.ID)] = fmt.Sprintf("group_%d", g.ID)
	}
	for _, p := range plans {
		includedGroupKeys := make([]string, 0, len(p.Edges.Groups)+1)
		includedGroupIDs := make([]int64, 0, len(p.Edges.Groups)+1)
		for _, includedGroupID := range normalizePlanGroupIDs(p.GroupID, planIncludedGroupIDs(p)) {
			if key, ok := groupIDs[includedGroupID]; ok {
				includedGroupKeys = append(includedGroupKeys, key)
			} else {
				includedGroupIDs = append(includedGroupIDs, includedGroupID)
			}
		}
		features := splitCatalogFeatures(p.Features)
		req.Plans = append(req.Plans, PaymentCatalogImportPlan{
			IncludedGroupKeys:     includedGroupKeys,
			IncludedGroupIDs:      includedGroupIDs,
			CycleQuotaUSD:         cloneFloat(p.CycleQuotaUsd),
			ResetIntervalSeconds:  p.ResetIntervalSeconds,
			WalletFallbackEnabled: catalogBoolPtr(p.WalletFallbackEnabled),
			Name:                  p.Name,
			Description:           p.Description,
			Price:                 p.Price,
			OriginalPrice:         cloneFloat(p.OriginalPrice),
			Currency:              p.Currency,
			ValidityDays:          catalogIntPtr(p.ValidityDays),
			ValidityUnit:          p.ValidityUnit,
			Features:              features,
			ProductName:           p.ProductName,
			ForSale:               catalogBoolPtr(p.ForSale),
			SortOrder:             catalogIntPtr(p.SortOrder),
		})
	}
	return req, nil
}

// buildCatalogPreview reads the complete current state and computes a stable
// diff. Apply calls it inside a serializable transaction, so a concurrent
// catalog write causes that transaction to abort instead of applying stale data.
func (s *PaymentConfigService) buildCatalogPreview(ctx context.Context, client *dbent.Client, n *normalizedCatalog) (*PaymentCatalogImportPreview, error) {
	preview := &PaymentCatalogImportPreview{
		Issues:  append([]PaymentCatalogImportIssue{}, n.issues...),
		Changes: []PaymentCatalogImportChange{},
	}
	if client == nil {
		return nil, infraerrors.InternalServer("CATALOG_DB_UNAVAILABLE", "catalog database is unavailable")
	}
	allNames := make([]string, 0, len(n.groups)*2)
	for _, g := range n.groups {
		allNames = append(allNames, strings.TrimSpace(g.Name))
		allNames = append(allNames, g.copySources...)
	}
	nameMap, err := s.loadCatalogGroups(ctx, client, uniqueTrimmed(allNames))
	if err != nil {
		return nil, err
	}
	referencedGroups, err := s.loadCatalogGroupsByID(ctx, client, catalogReferencedGroupIDs(n))
	if err != nil {
		return nil, err
	}
	for _, id := range catalogReferencedGroupIDs(n) {
		referenced := referencedGroups[id]
		if referenced == nil {
			preview.Issues = append(preview.Issues, PaymentCatalogImportIssue{Severity: "error", Code: "GROUP_ID_NOT_FOUND", Path: fmt.Sprintf("group_id:%d", id), Message: "referenced group does not exist"})
			continue
		}
		if referenced.Status != StatusActive {
			preview.Issues = append(preview.Issues, PaymentCatalogImportIssue{Severity: "error", Code: "GROUP_ID_INACTIVE", Path: fmt.Sprintf("group_id:%d", id), Message: "referenced group must be active"})
			continue
		}
		preview.Changes = append(preview.Changes, PaymentCatalogImportChange{Kind: "group", Action: "unchanged", Key: fmt.Sprintf("group_id:%d", id), Name: referenced.Name})
	}
	snapshot := &catalogEntitySnapshot{groups: nameMap, plans: map[string][]*dbent.SubscriptionPlan{}, routes: map[int64][]*dbent.CompositeModelRoute{}}
	groupIDs := make([]int64, 0, len(n.groups)+len(referencedGroups))
	seenGroupIDs := make(map[int64]struct{}, cap(groupIDs))
	for _, g := range n.groups {
		if rows := nameMap[g.Name]; len(rows) == 1 {
			seenGroupIDs[rows[0].ID] = struct{}{}
		}
	}
	for id := range referencedGroups {
		seenGroupIDs[id] = struct{}{}
	}
	for id := range seenGroupIDs {
		groupIDs = append(groupIDs, id)
	}
	if len(groupIDs) > 0 {
		planQuery := client.SubscriptionPlan.Query().Where(subscriptionplan.GroupIDIn(groupIDs...)).WithGroups()
		plans, queryErr := planQuery.All(ctx)
		if queryErr != nil {
			return nil, queryErr
		}
		for _, p := range plans {
			k := catalogPlanIdentity(p.GroupID, p.Name)
			snapshot.plans[k] = append(snapshot.plans[k], p)
		}
		routeQuery := client.CompositeModelRoute.Query().Where(compositemodelroute.GroupIDIn(groupIDs...))
		routes, queryErr := routeQuery.All(ctx)
		if queryErr != nil {
			return nil, queryErr
		}
		for _, r := range routes {
			snapshot.routes[int64(r.GroupID)] = append(snapshot.routes[int64(r.GroupID)], r)
		}
	}
	groupIDByKey := make(map[string]int64, len(n.groups))
	importedExistingGroupIDs := make(map[int64]struct{}, len(n.groups))
	for _, g := range n.groups {
		rows := nameMap[g.Name]
		if len(rows) > 1 {
			preview.Issues = append(preview.Issues, PaymentCatalogImportIssue{Severity: "error", Code: "GROUP_NAME_AMBIGUOUS", Path: "groups." + g.Key, Message: "more than one active group has this name"})
			continue
		}
		if len(rows) == 0 {
			preview.Changes = append(preview.Changes, PaymentCatalogImportChange{Kind: "group", Action: "create", Key: g.Key, Name: g.Name})
		} else {
			existing := rows[0]
			groupIDByKey[g.Key] = int64(existing.ID)
			importedExistingGroupIDs[int64(existing.ID)] = struct{}{}
			if existing.SubscriptionType != SubscriptionTypeSubscription || existing.Platform != g.platform {
				preview.Issues = append(preview.Issues, PaymentCatalogImportIssue{Severity: "error", Code: "GROUP_IDENTITY_CONFLICT", Path: "groups." + g.Key, Message: "existing group has a different platform or subscription type"})
				continue
			}
			changes := catalogGroupDiff(existing, g)
			act := "unchanged"
			if len(changes) > 0 {
				act = "update"
			}
			activeCount := 0
			if len(changes) > 0 {
				activeCount = s.countActiveCatalogSubscriptions(ctx, client, int64(existing.ID))
			}
			preview.Changes = append(preview.Changes, PaymentCatalogImportChange{Kind: "group", Action: act, Key: g.Key, Name: g.Name, Fields: changes, AffectedSubscriptions: activeCount})
		}
		if len(g.copySources) == 0 && len(rows) == 0 {
			preview.Issues = append(preview.Issues, PaymentCatalogImportIssue{Severity: "warning", Code: "GROUP_HAS_NO_ACCOUNT_SOURCE", Path: "groups." + g.Key, Message: "new group has no account source; it will be created without account bindings"})
		}
	}
	for id := range referencedGroups {
		if _, mutatesSameGroup := importedExistingGroupIDs[id]; mutatesSameGroup {
			preview.Issues = append(preview.Issues, PaymentCatalogImportIssue{Severity: "error", Code: "GROUP_REFERENCE_MUTATION_CONFLICT", Path: fmt.Sprintf("group_id:%d", id), Message: "a read-only group reference cannot also be managed by an imported group definition"})
		}
	}
	// Resolve source groups and account additions after target IDs are known.
	for _, g := range n.groups {
		if len(g.copySources) == 0 {
			continue
		}
		var sourceIDs []int64
		for _, sourceName := range g.copySources {
			rows := nameMap[sourceName]
			if len(rows) == 0 {
				preview.Issues = append(preview.Issues, PaymentCatalogImportIssue{Severity: "error", Code: "ACCOUNT_SOURCE_NOT_FOUND", Path: "groups." + g.Key + ".copy_accounts_from", Message: "account source group not found: " + sourceName})
				continue
			}
			if len(rows) > 1 {
				preview.Issues = append(preview.Issues, PaymentCatalogImportIssue{Severity: "error", Code: "ACCOUNT_SOURCE_AMBIGUOUS", Path: "groups." + g.Key + ".copy_accounts_from", Message: "account source group name is ambiguous: " + sourceName})
				continue
			}
			if !canCopyAccountsFromGroupPlatform(g.platform, rows[0].Platform) {
				preview.Issues = append(preview.Issues, PaymentCatalogImportIssue{Severity: "error", Code: "ACCOUNT_SOURCE_PLATFORM_MISMATCH", Path: "groups." + g.Key + ".copy_accounts_from", Message: "account source platform does not match target group: " + sourceName})
				continue
			}
			if rows[0].Name == g.Name {
				preview.Issues = append(preview.Issues, PaymentCatalogImportIssue{Severity: "error", Code: "ACCOUNT_SOURCE_SELF", Path: "groups." + g.Key + ".copy_accounts_from", Message: "group cannot copy accounts from itself"})
				continue
			}
			sourceIDs = append(sourceIDs, rows[0].ID)
		}
		if targetID, ok := groupIDByKey[g.Key]; ok && len(sourceIDs) > 0 {
			missing, countErr := s.catalogMissingBindings(ctx, client, targetID, sourceIDs)
			if countErr != nil {
				return nil, countErr
			}
			if missing > 0 {
				preview.Changes = append(preview.Changes, PaymentCatalogImportChange{Kind: "account_binding", Action: "update", Key: g.Key, Name: g.Name, Fields: []PaymentCatalogImportFieldDiff{{Field: "missing_accounts", Before: 0, After: missing}}})
			}
		} else if len(sourceIDs) > 0 {
			missing, countErr := s.catalogMissingBindings(ctx, client, 0, sourceIDs)
			if countErr != nil {
				return nil, countErr
			}
			if missing > 0 {
				preview.Changes = append(preview.Changes, PaymentCatalogImportChange{Kind: "account_binding", Action: "create", Key: g.Key, Name: g.Name, Fields: []PaymentCatalogImportFieldDiff{{Field: "missing_accounts", Before: 0, After: missing}}})
			}
		}
	}

	for _, p := range n.plans {
		compatibilityRef := p.compatibilityGroupRef()
		groupID, ok := resolveCatalogGroupRef(compatibilityRef, groupIDByKey)
		if compatibilityRef.id > 0 {
			referenced := referencedGroups[compatibilityRef.id]
			ok = referenced != nil && referenced.Status == StatusActive
		}
		changeKey := p.displayKey()
		if !ok {
			if compatibilityRef.key != "" {
				preview.Changes = append(preview.Changes, PaymentCatalogImportChange{Kind: "plan", Action: "create", Key: changeKey, Name: p.Name})
			}
			continue
		}
		rows := snapshot.plans[catalogPlanIdentity(groupID, p.Name)]
		if len(rows) > 1 {
			preview.Issues = append(preview.Issues, PaymentCatalogImportIssue{Severity: "error", Code: "PLAN_NAME_AMBIGUOUS", Path: "plans." + changeKey, Message: "more than one plan has this name in the target group"})
			continue
		}
		if len(rows) == 0 {
			preview.Changes = append(preview.Changes, PaymentCatalogImportChange{Kind: "plan", Action: "create", Key: changeKey, Name: p.Name})
			continue
		}
		changes := catalogPlanDiff(rows[0], p, groupIDByKey)
		action := "unchanged"
		if len(changes) > 0 {
			action = "update"
		}
		affectedSubscriptions := 0
		for _, change := range changes {
			if change.Field == "included_group_keys" {
				affectedSubscriptions = s.countActiveCatalogPlanSubscriptions(ctx, client, rows[0].ID)
				break
			}
		}
		preview.Changes = append(preview.Changes, PaymentCatalogImportChange{Kind: "plan", Action: action, Key: changeKey, Name: p.Name, Fields: changes, AffectedSubscriptions: affectedSubscriptions})
	}

	for _, g := range n.groups {
		if len(g.routes) == 0 {
			continue
		}
		groupID, ok := groupIDByKey[g.Key]
		if !ok {
			for _, raw := range g.routes {
				key := catalogRouteIdentity(raw.PublicModel, raw.MatchType, raw.Endpoint)
				preview.Changes = append(preview.Changes, PaymentCatalogImportChange{Kind: "route", Action: "create", Key: g.Key + ":" + key, Name: raw.PublicModel})
			}
			continue
		}
		current := snapshot.routes[groupID]
		routeMap := make(map[string][]*dbent.CompositeModelRoute)
		for _, r := range current {
			routeMap[catalogRouteIdentity(r.PublicModel, r.MatchType, r.Endpoint)] = append(routeMap[catalogRouteIdentity(r.PublicModel, r.MatchType, r.Endpoint)], r)
		}
		for _, raw := range g.routes {
			key := catalogRouteIdentity(raw.PublicModel, raw.MatchType, raw.Endpoint)
			rows := routeMap[key]
			if len(rows) > 1 {
				preview.Issues = append(preview.Issues, PaymentCatalogImportIssue{Severity: "error", Code: "ROUTE_AMBIGUOUS", Path: "groups." + g.Key + ".routes", Message: "duplicate existing composite route identity"})
				continue
			}
			if len(rows) == 0 {
				preview.Changes = append(preview.Changes, PaymentCatalogImportChange{Kind: "route", Action: "create", Key: g.Key + ":" + key, Name: raw.PublicModel})
				continue
			}
			changes := catalogRouteDiff(rows[0], raw)
			action := "unchanged"
			if len(changes) > 0 {
				action = "update"
			}
			preview.Changes = append(preview.Changes, PaymentCatalogImportChange{Kind: "route", Action: action, Key: g.Key + ":" + key, Name: raw.PublicModel, Fields: changes})
		}
	}

	if n.settings != nil {
		settings, settingsErr := s.loadCatalogSettings(ctx, client)
		if settingsErr != nil {
			return nil, settingsErr
		}
		if n.settings.BalanceRechargeMultiplier != nil {
			before := settings[SettingBalanceRechargeMult]
			after := *n.settings.BalanceRechargeMultiplier
			if before != after {
				preview.Changes = append(preview.Changes, PaymentCatalogImportChange{Kind: "setting", Action: "update", Key: SettingBalanceRechargeMult, Name: SettingBalanceRechargeMult, Fields: []PaymentCatalogImportFieldDiff{{Field: "value", Before: before, After: after}}})
			}
		}
		if n.settings.SubscriptionUSDToCNYRate != nil {
			before := settings[SettingSubscriptionUSDToCNYRate]
			after := *n.settings.SubscriptionUSDToCNYRate
			if before != after {
				preview.Changes = append(preview.Changes, PaymentCatalogImportChange{Kind: "setting", Action: "update", Key: SettingSubscriptionUSDToCNYRate, Name: SettingSubscriptionUSDToCNYRate, Fields: []PaymentCatalogImportFieldDiff{{Field: "value", Before: before, After: after}}})
			}
		}
	}
	preview.Summary = summarizeCatalogChanges(preview.Changes)
	preview.CanApply = !hasCatalogErrors(preview.Issues)
	preview.PreviewToken = catalogPreviewToken(preview)
	return preview, nil
}

func validCatalogPlatform(platform string) bool {
	switch platform {
	case PlatformAnthropic, PlatformOpenAI, PlatformGemini, PlatformAntigravity, PlatformGrok, PlatformComposite:
		return true
	default:
		return false
	}
}

func finiteNumber(v float64) bool   { return !math.IsNaN(v) && !math.IsInf(v, 0) }
func finitePositive(v float64) bool { return finiteNumber(v) && v > 0 }

func normalizeValidityUnit(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "day", "days":
		return "days"
	case "week", "weeks":
		return "weeks"
	case "month", "months":
		return "months"
	default:
		return ""
	}
}

func uniqueTrimmed(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	out := make([]string, 0, len(values))
	for _, raw := range values {
		value := strings.TrimSpace(raw)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		out = append(out, value)
	}
	return out
}

func normalizeCatalogPlanGroupKeys(primary string, values []string) []string {
	primary = strings.TrimSpace(primary)
	ordered := make([]string, 0, len(values)+1)
	if primary != "" {
		ordered = append(ordered, primary)
	}
	ordered = append(ordered, values...)
	return uniqueTrimmed(ordered)
}

func normalizeCatalogPlanGroupIDs(primary *int64, values []int64) []int64 {
	ordered := make([]int64, 0, len(values)+1)
	if primary != nil && *primary > 0 {
		ordered = append(ordered, *primary)
	}
	ordered = append(ordered, values...)
	seen := make(map[int64]struct{}, len(ordered))
	result := make([]int64, 0, len(ordered))
	for _, id := range ordered {
		if id <= 0 {
			continue
		}
		if _, exists := seen[id]; exists {
			continue
		}
		seen[id] = struct{}{}
		result = append(result, id)
	}
	return result
}

func normalizeCatalogPlanGroupRefs(primaryKey string, primaryID *int64, keys []string, ids []int64) []catalogGroupRef {
	refs := make([]catalogGroupRef, 0, len(keys)+len(ids)+1)
	primaryKey = strings.TrimSpace(primaryKey)
	if primaryKey != "" {
		refs = append(refs, catalogGroupRef{key: primaryKey})
	} else if primaryID != nil && *primaryID > 0 {
		refs = append(refs, catalogGroupRef{id: *primaryID})
	}
	for _, key := range keys {
		if key = strings.TrimSpace(key); key != "" {
			refs = append(refs, catalogGroupRef{key: key})
		}
	}
	for _, id := range ids {
		if id > 0 {
			refs = append(refs, catalogGroupRef{id: id})
		}
	}
	seen := make(map[string]struct{}, len(refs))
	result := make([]catalogGroupRef, 0, len(refs))
	for _, ref := range refs {
		label := catalogGroupRefLabel(ref)
		if _, exists := seen[label]; exists {
			continue
		}
		seen[label] = struct{}{}
		result = append(result, ref)
	}
	return result
}

func catalogGroupRefLabel(ref catalogGroupRef) string {
	if ref.key != "" {
		return ref.key
	}
	return fmt.Sprintf("group_id:%d", ref.id)
}

func catalogPlanImportIdentity(groupKey string, groupID *int64, name string) string {
	groupKey = strings.TrimSpace(groupKey)
	if groupKey != "" {
		return "key:" + groupKey + "\x00" + strings.TrimSpace(name)
	}
	if groupID != nil && *groupID > 0 {
		return fmt.Sprintf("id:%d\x00%s", *groupID, strings.TrimSpace(name))
	}
	return ""
}

func cloneFloat(value *float64) *float64 {
	if value == nil {
		return nil
	}
	v := *value
	return &v
}

func cloneInt64(value *int64) *int64 {
	if value == nil {
		return nil
	}
	v := *value
	return &v
}

func floatPtr(value float64) *float64 { return &value }
func catalogIntPtr(value int) *int    { return &value }
func catalogBoolPtr(value bool) *bool { return &value }
func catalogStringValue(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func hasCatalogErrors(issues []PaymentCatalogImportIssue) bool {
	for _, issue := range issues {
		if issue.Severity == "error" {
			return true
		}
	}
	return false
}

func catalogReferencedGroupIDs(n *normalizedCatalog) []int64 {
	if n == nil {
		return nil
	}
	seen := make(map[int64]struct{})
	result := make([]int64, 0)
	for _, plan := range n.plans {
		for _, ref := range plan.groupRefs {
			if ref.id <= 0 {
				continue
			}
			if _, exists := seen[ref.id]; exists {
				continue
			}
			seen[ref.id] = struct{}{}
			result = append(result, ref.id)
		}
	}
	sort.Slice(result, func(i, j int) bool { return result[i] < result[j] })
	return result
}

func (p catalogPlan) compatibilityGroupRef() catalogGroupRef {
	if p.groupKey != "" {
		return catalogGroupRef{key: p.groupKey}
	}
	if p.groupID != nil {
		return catalogGroupRef{id: *p.groupID}
	}
	return catalogGroupRef{}
}

func (p catalogPlan) displayKey() string {
	return catalogGroupRefLabel(p.compatibilityGroupRef()) + ":" + p.Name
}

func resolveCatalogGroupRef(ref catalogGroupRef, groupIDByKey map[string]int64) (int64, bool) {
	if ref.key != "" {
		id, ok := groupIDByKey[ref.key]
		return id, ok && id > 0
	}
	return ref.id, ref.id > 0
}

func resolveCatalogPlanGroupIDs(plan catalogPlan, groupIDByKey map[string]int64) ([]int64, error) {
	seen := make(map[int64]struct{}, len(plan.groupRefs))
	result := make([]int64, 0, len(plan.groupRefs))
	for _, ref := range plan.groupRefs {
		id, ok := resolveCatalogGroupRef(ref, groupIDByKey)
		if !ok {
			return nil, infraerrors.BadRequest("PLAN_GROUP_REFERENCE_UNRESOLVED", "plan references an unresolved group")
		}
		if _, exists := seen[id]; exists {
			continue
		}
		seen[id] = struct{}{}
		result = append(result, id)
	}
	return result, nil
}

func (n *normalizedCatalog) groupNameForKey(key string) string {
	for _, g := range n.groups {
		if g.Key == key {
			return g.Name
		}
	}
	return ""
}

func catalogPreviewToken(preview *PaymentCatalogImportPreview) string {
	copyPreview := *preview
	copyPreview.PreviewToken = ""
	data, _ := json.Marshal(copyPreview)
	hash := sha256.Sum256(data)
	return hex.EncodeToString(hash[:])
}

func (s *PaymentConfigService) loadCatalogGroups(ctx context.Context, client *dbent.Client, names []string) (map[string][]*dbent.Group, error) {
	result := make(map[string][]*dbent.Group, len(names))
	if len(names) == 0 {
		return result, nil
	}
	query := client.Group.Query().Where(group.NameIn(names...)).Order(dbent.Asc(group.FieldID))
	rows, err := query.All(ctx)
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		result[row.Name] = append(result[row.Name], row)
	}
	return result, nil
}

func (s *PaymentConfigService) loadCatalogGroupsByID(ctx context.Context, client *dbent.Client, ids []int64) (map[int64]*dbent.Group, error) {
	result := make(map[int64]*dbent.Group, len(ids))
	if len(ids) == 0 {
		return result, nil
	}
	rows, err := client.Group.Query().Where(group.IDIn(ids...)).All(ctx)
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		result[row.ID] = row
	}
	return result, nil
}

func catalogPlanIdentity(groupID int64, name string) string {
	return fmt.Sprintf("%d\x00%s", groupID, strings.TrimSpace(name))
}
func catalogRouteIdentity(publicModel, matchType, endpoint string) string {
	return strings.Join([]string{strings.TrimSpace(publicModel), strings.TrimSpace(matchType), strings.TrimSpace(endpoint)}, "\x00")
}

func appendCatalogDiff(diffs *[]PaymentCatalogImportFieldDiff, field string, before, after any) {
	if reflect.DeepEqual(before, after) {
		return
	}
	if bf, ok := before.(float64); ok {
		if af, ok := after.(float64); ok && math.Abs(bf-af) < 0.0000001 {
			return
		}
	}
	*diffs = append(*diffs, PaymentCatalogImportFieldDiff{Field: field, Before: before, After: after})
}

func optionalFloat(value *float64) any {
	if value == nil {
		return nil
	}
	return *value
}

func catalogGroupDiff(existing *dbent.Group, desired catalogGroup) []PaymentCatalogImportFieldDiff {
	diffs := make([]PaymentCatalogImportFieldDiff, 0)
	appendCatalogDiff(&diffs, "description", catalogStringValue(existing.Description), desired.Description)
	appendCatalogDiff(&diffs, "rate_multiplier", existing.RateMultiplier, desired.rateMultiplier)
	appendCatalogDiff(&diffs, "is_exclusive", existing.IsExclusive, desired.isExclusive)
	appendCatalogDiff(&diffs, "status", existing.Status, desired.status)
	appendCatalogDiff(&diffs, "daily_limit_usd", optionalFloat(existing.DailyLimitUsd), optionalFloat(desired.dailyLimit))
	appendCatalogDiff(&diffs, "weekly_limit_usd", optionalFloat(existing.WeeklyLimitUsd), optionalFloat(desired.weeklyLimit))
	appendCatalogDiff(&diffs, "monthly_limit_usd", optionalFloat(existing.MonthlyLimitUsd), optionalFloat(desired.monthlyLimit))
	appendCatalogDiff(&diffs, "default_validity_days", existing.DefaultValidityDays, desired.validityDays)
	appendCatalogDiff(&diffs, "sort_order", existing.SortOrder, desired.sortOrder)
	return diffs
}

func catalogPlanDiff(existing *dbent.SubscriptionPlan, desired catalogPlan, groupIDByKey map[string]int64) []PaymentCatalogImportFieldDiff {
	diffs := make([]PaymentCatalogImportFieldDiff, 0)
	labelByGroupID := make(map[int64]string, len(desired.groupRefs))
	desiredGroupLabels := make([]string, 0, len(desired.groupRefs))
	seenDesiredIDs := make(map[int64]struct{}, len(desired.groupRefs))
	for _, ref := range desired.groupRefs {
		label := catalogGroupRefLabel(ref)
		id, resolved := resolveCatalogGroupRef(ref, groupIDByKey)
		if resolved {
			if _, duplicate := seenDesiredIDs[id]; duplicate {
				continue
			}
			seenDesiredIDs[id] = struct{}{}
			labelByGroupID[id] = label
		}
		desiredGroupLabels = append(desiredGroupLabels, label)
	}
	existingGroupKeys := make([]string, 0, len(existing.Edges.Groups)+1)
	for _, id := range normalizePlanGroupIDs(existing.GroupID, planIncludedGroupIDs(existing)) {
		key, ok := labelByGroupID[id]
		if !ok {
			key = fmt.Sprintf("group_id:%d", id)
		}
		existingGroupKeys = append(existingGroupKeys, key)
	}
	appendCatalogDiff(&diffs, "included_group_keys", existingGroupKeys, desiredGroupLabels)
	appendCatalogDiff(&diffs, "cycle_quota_usd", optionalFloat(existing.CycleQuotaUsd), optionalFloat(desired.cycleQuotaUSD))
	appendCatalogDiff(&diffs, "reset_interval_seconds", existing.ResetIntervalSeconds, desired.resetIntervalSeconds)
	appendCatalogDiff(&diffs, "wallet_fallback_enabled", existing.WalletFallbackEnabled, desired.walletFallbackEnabled)
	appendCatalogDiff(&diffs, "description", existing.Description, desired.Description)
	appendCatalogDiff(&diffs, "price", existing.Price, desired.Price)
	appendCatalogDiff(&diffs, "original_price", optionalFloat(existing.OriginalPrice), optionalFloat(desired.OriginalPrice))
	appendCatalogDiff(&diffs, "currency", existing.Currency, desired.currency)
	appendCatalogDiff(&diffs, "validity_days", existing.ValidityDays, desired.validityDays)
	appendCatalogDiff(&diffs, "validity_unit", existing.ValidityUnit, desired.validityUnit)
	appendCatalogDiff(&diffs, "features", splitCatalogFeatures(existing.Features), desired.features)
	appendCatalogDiff(&diffs, "product_name", existing.ProductName, desired.ProductName)
	appendCatalogDiff(&diffs, "for_sale", existing.ForSale, desired.forSale)
	appendCatalogDiff(&diffs, "sort_order", existing.SortOrder, desired.sortOrder)
	return diffs
}

func catalogRouteDiff(existing *dbent.CompositeModelRoute, desired PaymentCatalogImportRoute) []PaymentCatalogImportFieldDiff {
	diffs := make([]PaymentCatalogImportFieldDiff, 0)
	appendCatalogDiff(&diffs, "target_platform", existing.TargetPlatform, desired.TargetPlatform)
	appendCatalogDiff(&diffs, "upstream_model", existing.UpstreamModel, desired.UpstreamModel)
	appendCatalogDiff(&diffs, "priority", existing.Priority, desired.Priority)
	appendCatalogDiff(&diffs, "enabled", existing.Enabled, desired.Enabled != nil && *desired.Enabled)
	appendCatalogDiff(&diffs, "notes", catalogStringValue(existing.Notes), desired.Notes)
	return diffs
}

func splitCatalogFeatures(raw string) []string {
	parts := strings.Split(raw, "\n")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		if part = strings.TrimSpace(part); part != "" {
			result = append(result, part)
		}
	}
	return result
}

func (s *PaymentConfigService) countActiveCatalogSubscriptions(ctx context.Context, client *dbent.Client, groupID int64) int {
	count, err := client.UserSubscription.Query().Where(
		usersubscription.GroupIDEQ(groupID),
		usersubscription.StatusEQ(SubscriptionStatusActive),
		usersubscription.ExpiresAtGT(time.Now()),
	).Count(ctx)
	if err != nil {
		return 0
	}
	return count
}

func (s *PaymentConfigService) countActiveCatalogPlanSubscriptions(ctx context.Context, client *dbent.Client, planID int64) int {
	count, err := client.UserSubscription.Query().Where(
		usersubscription.PlanIDEQ(planID),
		usersubscription.StatusEQ(SubscriptionStatusActive),
		usersubscription.ExpiresAtGT(time.Now()),
	).Count(ctx)
	if err != nil {
		return 0
	}
	return count
}

func (s *PaymentConfigService) catalogMissingBindings(ctx context.Context, client *dbent.Client, targetID int64, sourceIDs []int64) (int, error) {
	if len(sourceIDs) == 0 {
		return 0, nil
	}
	sourceRows, err := client.AccountGroup.Query().
		Where(accountgroup.GroupIDIn(sourceIDs...), accountgroup.HasAccountWith(account.DeletedAtIsNil())).
		All(ctx)
	if err != nil {
		return 0, err
	}
	if len(sourceRows) == 0 {
		return 0, nil
	}
	sourceSet := make(map[int64]struct{}, len(sourceRows))
	for _, row := range sourceRows {
		sourceSet[row.AccountID] = struct{}{}
	}
	if targetID > 0 {
		targetRows, err := client.AccountGroup.Query().Where(accountgroup.GroupIDEQ(targetID)).All(ctx)
		if err != nil {
			return 0, err
		}
		for _, row := range targetRows {
			delete(sourceSet, row.AccountID)
		}
	}
	return len(sourceSet), nil
}

func (s *PaymentConfigService) loadCatalogSettings(ctx context.Context, client *dbent.Client) (map[string]float64, error) {
	values := map[string]float64{SettingBalanceRechargeMult: 1, SettingSubscriptionUSDToCNYRate: 0}
	rows, err := client.Setting.Query().Where(setting.KeyIn(SettingBalanceRechargeMult, SettingSubscriptionUSDToCNYRate)).All(ctx)
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		parsed := pcParseFloat(row.Value, values[row.Key])
		values[row.Key] = parsed
	}
	return values, nil
}

func summarizeCatalogChanges(changes []PaymentCatalogImportChange) PaymentCatalogImportSummary {
	var summary PaymentCatalogImportSummary
	for _, change := range changes {
		switch change.Kind {
		case "group":
			switch change.Action {
			case "create":
				summary.GroupsCreated++
			case "update":
				summary.GroupsUpdated++
			case "unchanged":
				summary.GroupsUnchanged++
			}
		case "plan":
			switch change.Action {
			case "create":
				summary.PlansCreated++
			case "update":
				summary.PlansUpdated++
			case "unchanged":
				summary.PlansUnchanged++
			}
		case "route":
			switch change.Action {
			case "create":
				summary.RoutesCreated++
			case "update":
				summary.RoutesUpdated++
			case "unchanged":
				summary.RoutesUnchanged++
			}
		case "account_binding":
			if (change.Action == "create" || change.Action == "update") && len(change.Fields) > 0 {
				if count, ok := change.Fields[0].After.(int); ok {
					summary.BindingsAdded += count
				}
			}
		case "setting":
			summary.SettingsUpdated++
		}
	}
	return summary
}

type catalogApplyEffects struct {
	groupIDs      []int64
	subscriptions []catalogSubscriptionRef
}

type catalogSubscriptionRef struct{ userID, groupID int64 }

func (s *PaymentConfigService) applyCatalogWithinTx(ctx context.Context, client *dbent.Client, n *normalizedCatalog) (*catalogApplyEffects, error) {
	effects := &catalogApplyEffects{}
	groupIDs := make(map[string]int64, len(n.groups))
	touched := make(map[int64]struct{})
	referencedGroups, err := s.loadCatalogGroupsByID(ctx, client, catalogReferencedGroupIDs(n))
	if err != nil {
		return nil, err
	}
	for _, id := range catalogReferencedGroupIDs(n) {
		referenced := referencedGroups[id]
		if referenced == nil {
			return nil, infraerrors.BadRequest("GROUP_ID_NOT_FOUND", "referenced group does not exist")
		}
		if referenced.Status != StatusActive {
			return nil, infraerrors.BadRequest("GROUP_ID_INACTIVE", "referenced group must be active")
		}
	}

	for _, desired := range n.groups {
		rows, err := client.Group.Query().Where(group.NameEQ(desired.Name)).All(ctx)
		if err != nil {
			return nil, err
		}
		if len(rows) > 1 {
			return nil, infraerrors.Conflict("GROUP_NAME_AMBIGUOUS", "more than one active group has this name")
		}
		var current *dbent.Group
		if len(rows) == 1 {
			current = rows[0]
		}
		if current != nil && (current.Platform != desired.platform || current.SubscriptionType != SubscriptionTypeSubscription) {
			return nil, infraerrors.Conflict("GROUP_IDENTITY_CONFLICT", "existing group has a different platform or subscription type")
		}
		if current == nil {
			builder := client.Group.Create().SetName(desired.Name).SetDescription(desired.Description).SetPlatform(desired.platform).SetRateMultiplier(desired.rateMultiplier).SetIsExclusive(desired.isExclusive).SetStatus(desired.status).SetSubscriptionType(desired.subscriptionType).SetDefaultValidityDays(desired.validityDays).SetSortOrder(desired.sortOrder).SetNillableDailyLimitUsd(desired.dailyLimit).SetNillableWeeklyLimitUsd(desired.weeklyLimit).SetNillableMonthlyLimitUsd(desired.monthlyLimit)
			created, createErr := builder.Save(ctx)
			if createErr != nil {
				return nil, createErr
			}
			current = created
			touched[int64(current.ID)] = struct{}{}
		} else {
			if len(catalogGroupDiff(current, desired)) > 0 {
				update := client.Group.UpdateOneID(current.ID).SetDescription(desired.Description).SetPlatform(desired.platform).SetRateMultiplier(desired.rateMultiplier).SetIsExclusive(desired.isExclusive).SetStatus(desired.status).SetSubscriptionType(desired.subscriptionType).SetDefaultValidityDays(desired.validityDays).SetSortOrder(desired.sortOrder)
				if desired.dailyLimit == nil {
					update.ClearDailyLimitUsd()
				} else {
					update.SetDailyLimitUsd(*desired.dailyLimit)
				}
				if desired.weeklyLimit == nil {
					update.ClearWeeklyLimitUsd()
				} else {
					update.SetWeeklyLimitUsd(*desired.weeklyLimit)
				}
				if desired.monthlyLimit == nil {
					update.ClearMonthlyLimitUsd()
				} else {
					update.SetMonthlyLimitUsd(*desired.monthlyLimit)
				}
				updated, updateErr := update.Save(ctx)
				if updateErr != nil {
					return nil, updateErr
				}
				current = updated
				touched[int64(current.ID)] = struct{}{}
			}
		}
		groupIDs[desired.Key] = int64(current.ID)
	}
	for key, id := range groupIDs {
		if _, referenced := referencedGroups[id]; referenced {
			return nil, infraerrors.BadRequest("GROUP_REFERENCE_MUTATION_CONFLICT", "group "+key+" is both a read-only reference and an imported group definition")
		}
	}

	for _, desired := range n.groups {
		targetID := groupIDs[desired.Key]
		if len(desired.copySources) == 0 {
			continue
		}
		sourceRows, err := client.Group.Query().Where(group.NameIn(desired.copySources...)).All(ctx)
		if err != nil {
			return nil, err
		}
		sourceByName := make(map[string]*dbent.Group, len(sourceRows))
		for _, row := range sourceRows {
			sourceByName[row.Name] = row
		}
		var sourceIDs []int64
		for _, sourceName := range desired.copySources {
			row := sourceByName[sourceName]
			if row == nil {
				return nil, infraerrors.BadRequest("ACCOUNT_SOURCE_NOT_FOUND", "account source group not found: "+sourceName)
			}
			if int64(row.ID) == targetID {
				return nil, infraerrors.BadRequest("ACCOUNT_SOURCE_SELF", "group cannot copy accounts from itself")
			}
			if !canCopyAccountsFromGroupPlatform(desired.platform, row.Platform) {
				return nil, infraerrors.BadRequest("ACCOUNT_SOURCE_PLATFORM_MISMATCH", "account source platform does not match target group")
			}
			sourceIDs = append(sourceIDs, row.ID)
		}
		sourceAccounts, err := client.AccountGroup.Query().Where(accountgroup.GroupIDIn(sourceIDs...), accountgroup.HasAccountWith(account.DeletedAtIsNil())).All(ctx)
		if err != nil {
			return nil, err
		}
		priorityByAccount := make(map[int64]int)
		for _, row := range sourceAccounts {
			if old, ok := priorityByAccount[row.AccountID]; !ok || row.Priority < old {
				priorityByAccount[row.AccountID] = row.Priority
			}
		}
		targetAccounts, err := client.AccountGroup.Query().Where(accountgroup.GroupIDEQ(targetID)).All(ctx)
		if err != nil {
			return nil, err
		}
		for _, row := range targetAccounts {
			delete(priorityByAccount, row.AccountID)
		}
		if len(priorityByAccount) > 0 {
			builders := make([]*dbent.AccountGroupCreate, 0, len(priorityByAccount))
			for accountID, priority := range priorityByAccount {
				builders = append(builders, client.AccountGroup.Create().SetAccountID(accountID).SetGroupID(targetID).SetPriority(priority))
			}
			if err := client.AccountGroup.CreateBulk(builders...).OnConflictColumns(accountgroup.FieldAccountID, accountgroup.FieldGroupID).DoNothing().Exec(ctx); err != nil {
				return nil, err
			}
			touched[targetID] = struct{}{}
		}
	}

	for _, desired := range n.groups {
		if len(desired.routes) == 0 {
			continue
		}
		groupID := groupIDs[desired.Key]
		for _, route := range desired.routes {
			rows, err := client.CompositeModelRoute.Query().Where(compositemodelroute.GroupIDEQ(groupID), compositemodelroute.PublicModelEQ(route.PublicModel), compositemodelroute.MatchTypeEQ(route.MatchType), compositemodelroute.EndpointEQ(route.Endpoint)).All(ctx)
			if err != nil {
				return nil, err
			}
			if len(rows) > 1 {
				return nil, infraerrors.Conflict("ROUTE_AMBIGUOUS", "duplicate existing composite route identity")
			}
			if len(rows) == 0 {
				_, err = client.CompositeModelRoute.Create().SetGroupID(groupID).SetPublicModel(route.PublicModel).SetMatchType(route.MatchType).SetTargetPlatform(route.TargetPlatform).SetUpstreamModel(route.UpstreamModel).SetEndpoint(route.Endpoint).SetPriority(route.Priority).SetEnabled(route.Enabled != nil && *route.Enabled).SetNotes(route.Notes).Save(ctx)
				if err != nil {
					return nil, err
				}
				touched[groupID] = struct{}{}
			} else if len(catalogRouteDiff(rows[0], route)) > 0 {
				_, err = client.CompositeModelRoute.UpdateOneID(rows[0].ID).SetTargetPlatform(route.TargetPlatform).SetUpstreamModel(route.UpstreamModel).SetPriority(route.Priority).SetEnabled(route.Enabled != nil && *route.Enabled).SetNotes(route.Notes).Save(ctx)
				if err != nil {
					return nil, err
				}
				touched[groupID] = struct{}{}
			}
		}
	}

	for _, desired := range n.plans {
		groupID, ok := resolveCatalogGroupRef(desired.compatibilityGroupRef(), groupIDs)
		if !ok {
			return nil, infraerrors.BadRequest("PLAN_GROUP_REFERENCE_UNRESOLVED", "plan group could not be resolved")
		}
		rows, err := client.SubscriptionPlan.Query().Where(subscriptionplan.GroupIDEQ(groupID), subscriptionplan.NameEQ(strings.TrimSpace(desired.Name))).WithGroups().All(ctx)
		if err != nil {
			return nil, err
		}
		if len(rows) > 1 {
			return nil, infraerrors.Conflict("PLAN_NAME_AMBIGUOUS", "duplicate plan name in target group")
		}
		features := strings.Join(desired.features, "\n")
		includedGroupIDs, err := resolveCatalogPlanGroupIDs(desired, groupIDs)
		if err != nil {
			return nil, err
		}
		if len(rows) == 0 {
			builder := client.SubscriptionPlan.Create().
				SetGroupID(groupID).
				AddGroupIDs(includedGroupIDs...).
				SetName(strings.TrimSpace(desired.Name)).
				SetDescription(desired.Description).
				SetPrice(desired.Price).
				SetNillableOriginalPrice(desired.OriginalPrice).
				SetNillableCycleQuotaUsd(desired.cycleQuotaUSD).
				SetResetIntervalSeconds(desired.resetIntervalSeconds).
				SetWalletFallbackEnabled(desired.walletFallbackEnabled).
				SetCurrency(desired.currency).
				SetValidityDays(desired.validityDays).
				SetValidityUnit(desired.validityUnit).
				SetFeatures(features).
				SetProductName(desired.ProductName).
				SetForSale(desired.forSale).
				SetSortOrder(desired.sortOrder)
			if _, err := builder.Save(ctx); err != nil {
				return nil, err
			}
		} else if len(catalogPlanDiff(rows[0], desired, groupIDs)) > 0 {
			update := client.SubscriptionPlan.UpdateOneID(rows[0].ID).
				ClearGroups().
				AddGroupIDs(includedGroupIDs...).
				SetDescription(desired.Description).
				SetPrice(desired.Price).
				SetResetIntervalSeconds(desired.resetIntervalSeconds).
				SetWalletFallbackEnabled(desired.walletFallbackEnabled).
				SetCurrency(desired.currency).
				SetValidityDays(desired.validityDays).
				SetValidityUnit(desired.validityUnit).
				SetFeatures(features).
				SetProductName(desired.ProductName).
				SetForSale(desired.forSale).
				SetSortOrder(desired.sortOrder)
			if desired.OriginalPrice == nil {
				update.ClearOriginalPrice()
			} else {
				update.SetOriginalPrice(*desired.OriginalPrice)
			}
			if desired.cycleQuotaUSD == nil {
				update.ClearCycleQuotaUsd()
			} else {
				update.SetCycleQuotaUsd(*desired.cycleQuotaUSD)
			}
			if _, err := update.Save(ctx); err != nil {
				return nil, err
			}
		}
	}

	if n.settings != nil {
		settings := make([]*dbent.SettingCreate, 0, 2)
		currentSettings, err := s.loadCatalogSettings(ctx, client)
		if err != nil {
			return nil, err
		}
		if n.settings.BalanceRechargeMultiplier != nil {
			if currentSettings[SettingBalanceRechargeMult] != *n.settings.BalanceRechargeMultiplier {
				settings = append(settings, client.Setting.Create().SetKey(SettingBalanceRechargeMult).SetValue(formatPositiveFloatExact(n.settings.BalanceRechargeMultiplier)).SetUpdatedAt(time.Now()))
			}
		}
		if n.settings.SubscriptionUSDToCNYRate != nil {
			if currentSettings[SettingSubscriptionUSDToCNYRate] != *n.settings.SubscriptionUSDToCNYRate {
				settings = append(settings, client.Setting.Create().SetKey(SettingSubscriptionUSDToCNYRate).SetValue(formatPositiveFloatExact(n.settings.SubscriptionUSDToCNYRate)).SetUpdatedAt(time.Now()))
			}
		}
		if len(settings) > 0 {
			if err := client.Setting.CreateBulk(settings...).OnConflictColumns(setting.FieldKey).UpdateNewValues().Exec(ctx); err != nil {
				return nil, err
			}
		}
	}

	for id := range touched {
		if _, err := client.ExecContext(ctx, `INSERT INTO scheduler_outbox (event_type, group_id, payload) VALUES ($1, $2, $3)`, SchedulerOutboxEventGroupChanged, id, nil); err != nil {
			return nil, err
		}
		effects.groupIDs = append(effects.groupIDs, id)
		rows, err := client.UserSubscription.Query().Where(usersubscription.GroupIDEQ(id), usersubscription.StatusEQ(SubscriptionStatusActive), usersubscription.ExpiresAtGT(time.Now())).All(ctx)
		if err != nil {
			return nil, err
		}
		for _, row := range rows {
			effects.subscriptions = append(effects.subscriptions, catalogSubscriptionRef{userID: row.UserID, groupID: id})
		}
	}
	sort.Slice(effects.groupIDs, func(i, j int) bool { return effects.groupIDs[i] < effects.groupIDs[j] })
	return effects, nil
}

func (s *PaymentConfigService) invalidateCatalogCaches(ctx context.Context, effects *catalogApplyEffects) {
	if s == nil || effects == nil {
		return
	}
	for _, groupID := range effects.groupIDs {
		if s.catalogAuthInvalidator != nil {
			s.catalogAuthInvalidator.InvalidateAuthCacheByGroupID(ctx, groupID)
		}
	}
	if s.catalogBillingCache != nil {
		seen := make(map[string]struct{}, len(effects.subscriptions))
		for _, sub := range effects.subscriptions {
			key := fmt.Sprintf("%d:%d", sub.userID, sub.groupID)
			if _, ok := seen[key]; ok {
				continue
			}
			seen[key] = struct{}{}
			_ = s.catalogBillingCache.InvalidateSubscription(ctx, sub.userID, sub.groupID)
		}
	}
}
