package middleware

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/Wei-Shaw/sub2api/internal/config"
	"github.com/Wei-Shaw/sub2api/internal/pkg/ctxkey"
	"github.com/Wei-Shaw/sub2api/internal/pkg/ip"
	"github.com/Wei-Shaw/sub2api/internal/service"

	"github.com/gin-gonic/gin"
)

const maxAPIKeyAuthorizationHeaderBytes = service.MaxAPIKeyCredentialBytes + 128

var errAPIKeyInsufficientBalance = errors.New("insufficient account balance")

// NewAPIKeyAuthMiddleware 创建 API Key 认证中间件
func NewAPIKeyAuthMiddleware(apiKeyService *service.APIKeyService, subscriptionService *service.SubscriptionService, cfg *config.Config) APIKeyAuthMiddleware {
	return APIKeyAuthMiddleware(apiKeyAuthWithSubscription(apiKeyService, subscriptionService, cfg))
}

// NewPlaygroundAPIKeyAuthMiddleware authenticates an already signed-in user
// against an API key selected by ID. The credential never leaves the server;
// all post-lookup checks are shared with the public API-key middleware.
func NewPlaygroundAPIKeyAuthMiddleware(apiKeyService *service.APIKeyService, subscriptionService *service.SubscriptionService, cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		subject, ok := GetAuthSubjectFromContext(c)
		if !ok {
			AbortWithError(c, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated")
			return
		}

		keyID, err := strconv.ParseInt(strings.TrimSpace(c.Param("key_id")), 10, 64)
		if err != nil || keyID <= 0 {
			AbortWithError(c, http.StatusNotFound, "API_KEY_NOT_FOUND", "API key not found")
			return
		}

		apiKey, err := apiKeyService.GetByIDForPlayground(c.Request.Context(), keyID, subject.UserID)
		if err != nil {
			if errors.Is(err, service.ErrAPIKeyNotFound) {
				AbortWithError(c, http.StatusNotFound, "API_KEY_NOT_FOUND", "API key not found")
				return
			}
			AbortWithError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to load API key")
			return
		}
		authorizeLoadedAPIKey(c, apiKey, apiKeyService, subscriptionService, cfg)
	}
}

// apiKeyAuthWithSubscription API Key认证中间件（支持订阅验证）
//
// 中间件职责分为两层：
//   - 鉴权（Authentication）：验证 Key 有效性、用户状态、IP 限制 —— 始终执行
//   - 计费执行（Billing Enforcement）：过期/配额/订阅/余额检查 —— skipBilling 时整块跳过
//
// /v1/usage、/v1/sub2api/billing 端点与异步生图任务查询只需鉴权，不需要计费执行。
// usage 允许过期/配额耗尽的 Key 查询自身用量，billing 用于读取当前 Key 的倍率配置，
// 异步生图查询允许已耗尽额度的 Key 拉取自身任务结果。
func apiKeyAuthWithSubscription(apiKeyService *service.APIKeyService, subscriptionService *service.SubscriptionService, cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		// ── 1. 提取 API Key ──────────────────────────────────────────
		if rejectInvalidAuthAbuse(c, apiKeyService) {
			AbortWithError(c, http.StatusTooManyRequests, "INVALID_AUTH_RATE_LIMITED", "Too many invalid authentication attempts; retry later")
			return
		}

		if apiKeyHeadersTooLarge(c) {
			recordInvalidAuthFailure(c, apiKeyService)
			MarkIngressRejected(c, IngressRejectInvalidAPIKey)
			AbortWithError(c, http.StatusUnauthorized, "INVALID_API_KEY", "Invalid API key")
			return
		}

		queryKey := strings.TrimSpace(c.Query("key"))
		queryApiKey := strings.TrimSpace(c.Query("api_key"))
		if queryKey != "" || queryApiKey != "" {
			recordInvalidAuthFailure(c, apiKeyService)
			MarkIngressRejected(c, IngressRejectQueryAPIKeyDeprecated)
			AbortWithError(c, 400, "api_key_in_query_deprecated", "API key in query parameter is deprecated. Please use Authorization header instead.")
			return
		}

		// 尝试从Authorization header中提取API key (Bearer scheme)
		authHeader := c.GetHeader("Authorization")
		var apiKeyString string

		if authHeader != "" {
			// 验证Bearer scheme
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
				apiKeyString = strings.TrimSpace(parts[1])
			}
		}

		// 如果Authorization header中没有，尝试从x-api-key header中提取
		if apiKeyString == "" {
			apiKeyString = c.GetHeader("x-api-key")
		}
		if len(apiKeyString) > service.MaxAPIKeyCredentialBytes {
			recordInvalidAuthFailure(c, apiKeyService)
			MarkIngressRejected(c, IngressRejectInvalidAPIKey)
			AbortWithError(c, http.StatusUnauthorized, "INVALID_API_KEY", "Invalid API key")
			return
		}

		// 如果x-api-key header中没有，尝试从x-goog-api-key header中提取（Gemini CLI兼容）
		if apiKeyString == "" {
			apiKeyString = c.GetHeader("x-goog-api-key")
		}

		// 如果所有header都没有API key
		if apiKeyString == "" {
			recordInvalidAuthFailure(c, apiKeyService)
			if hasAPIKeyCredentialInput(c) {
				MarkIngressRejected(c, IngressRejectInvalidAPIKey)
			} else {
				MarkIngressRejected(c, IngressRejectAPIKeyRequired)
			}
			AbortWithError(c, 401, "API_KEY_REQUIRED", "API key is required in Authorization header (Bearer scheme), x-api-key header, or x-goog-api-key header")
			return
		}

		// ── 2. 验证 Key 存在 ─────────────────────────────────────────

		apiKey, err := apiKeyService.GetByKey(c.Request.Context(), apiKeyString)
		if err != nil {
			if errors.Is(err, service.ErrAPIKeyNotFound) {
				recordInvalidAuthFailure(c, apiKeyService)
				MarkIngressRejected(c, IngressRejectInvalidAPIKey)
				AbortWithError(c, 401, "INVALID_API_KEY", "Invalid API key")
				return
			}
			if errors.Is(err, service.ErrAPIKeyAuthOverloaded) {
				MarkIngressRejected(c, IngressRejectAPIKeyAuthOverloaded)
				AbortWithError(c, http.StatusServiceUnavailable, "API_KEY_AUTH_OVERLOADED", "API key authentication is temporarily unavailable")
				return
			}
			AbortWithError(c, 500, "INTERNAL_ERROR", "Failed to validate API key")
			return
		}

		authorizeLoadedAPIKey(c, apiKey, apiKeyService, subscriptionService, cfg)
	}
}

func authorizeLoadedAPIKey(c *gin.Context, apiKey *service.APIKey, apiKeyService *service.APIKeyService, subscriptionService *service.SubscriptionService, cfg *config.Config) {
	// apiKey 已加载（含 User/Group）。即便后续因分组停用/Key 停用/用户停用/
	// IP 限制等早退中断，也让 Ops 错误日志能回退取到 user/group/platform。
	SetOpsFallbackAPIKey(c, apiKey)

	// disabled / 未知状态 → 无条件拦截（expired 和 quota_exhausted 留给计费阶段）
	if !apiKey.IsActive() &&
		apiKey.Status != service.StatusAPIKeyExpired &&
		apiKey.Status != service.StatusAPIKeyQuotaExhausted {
		MarkIngressRejected(c, IngressRejectAPIKeyDisabled)
		AbortWithError(c, http.StatusUnauthorized, "API_KEY_DISABLED", "API key is disabled")
		return
	}

	if len(apiKey.IPWhitelist) > 0 || len(apiKey.IPBlacklist) > 0 {
		clientIP := ip.GetSecurityClientIP(c, cfg.TrustForwardedIPForAPIKeyACL())
		allowed, _ := ip.CheckIPRestrictionWithCompiledRules(clientIP, apiKey.CompiledIPWhitelist, apiKey.CompiledIPBlacklist)
		if !allowed {
			if clientIP == "" {
				clientIP = "unknown"
			}
			service.MarkOpsClientBusinessLimited(c, service.OpsClientBusinessLimitedReasonIPRestriction)
			MarkIngressRejected(c, IngressRejectIPRestricted)
			AbortWithError(c, http.StatusForbidden, "ACCESS_DENIED", fmt.Sprintf("Access denied. Your IP is %s", clientIP))
			return
		}
	}

	if apiKey.User == nil {
		AbortWithError(c, http.StatusUnauthorized, "USER_NOT_FOUND", "User associated with API key not found")
		return
	}
	if !apiKey.User.IsActive() {
		MarkIngressRejected(c, IngressRejectUserInactive)
		AbortWithError(c, http.StatusUnauthorized, "USER_INACTIVE", "User account is not active")
		return
	}
	if abortIfAPIKeyGroupUnavailable(c, apiKey) || abortIfAPIKeyGroupNotAllowed(c, apiKey) {
		return
	}

	ctx := context.WithValue(c.Request.Context(), ctxkey.UserID, apiKey.User.ID)
	c.Request = c.Request.WithContext(ctx)
	billingInfoRequest := c.Request.URL.Path == "/v1/sub2api/billing"
	skipBilling := c.Request.URL.Path == "/v1/usage" || billingInfoRequest || isAsyncImageTaskRead(c.Request.Method, c.Request.URL.Path)

	if cfg.RunMode == config.RunModeSimple {
		setAuthenticatedAPIKeyContext(c, apiKey, nil)
		if !billingInfoRequest {
			_ = apiKeyService.TouchLastUsed(c.Request.Context(), apiKey.ID)
		}
		c.Next()
		return
	}

	var subscription *service.UserSubscription
	if apiKey.Group != nil && subscriptionService != nil && !billingInfoRequest {
		sub, subErr := subscriptionService.GetActiveSubscriptionForGroup(c.Request.Context(), apiKey.User.ID, apiKey.Group.ID)
		if subErr == nil {
			subscription = sub
		} else if !errors.Is(subErr, service.ErrSubscriptionNotFound) {
			AbortWithError(c, http.StatusInternalServerError, "SUBSCRIPTION_LOOKUP_FAILED", "Failed to resolve subscription coverage")
			return
		}
	}

	if !skipBilling {
		switch apiKey.Status {
		case service.StatusAPIKeyQuotaExhausted:
			abortWithAPIKeyQuotaError(c)
			return
		case service.StatusAPIKeyExpired:
			AbortWithError(c, http.StatusForbidden, "API_KEY_EXPIRED", "API key 已过期")
			return
		}
		if apiKey.IsExpired() {
			AbortWithError(c, http.StatusForbidden, "API_KEY_EXPIRED", "API key 已过期")
			return
		}
		if apiKey.IsQuotaExhausted() {
			abortWithAPIKeyQuotaError(c)
			return
		}

		if subscription != nil {
			refreshed, maintenanceErr := subscriptionService.EnsureWindowMaintenance(c.Request.Context(), subscription)
			if maintenanceErr != nil {
				AbortWithError(c, http.StatusInternalServerError, "SUBSCRIPTION_MAINTENANCE_FAILED", "Failed to maintain subscription usage windows")
				return
			}
			subscription = refreshed
		}
		if fundingErr := validateAPIKeyFunding(c.Request.Context(), apiKey, subscription, subscriptionService, cfg); fundingErr != nil {
			if errors.Is(fundingErr, errAPIKeyInsufficientBalance) {
				AbortWithError(c, http.StatusForbidden, "INSUFFICIENT_BALANCE", "Insufficient account balance")
				return
			}
			AbortWithError(c, http.StatusTooManyRequests, "USAGE_LIMIT_EXCEEDED", fundingErr.Error())
			return
		}
	}

	setAuthenticatedAPIKeyContext(c, apiKey, subscription)
	if !billingInfoRequest {
		_ = apiKeyService.TouchLastUsed(c.Request.Context(), apiKey.ID)
	}
	c.Next()
}

func setAuthenticatedAPIKeyContext(c *gin.Context, apiKey *service.APIKey, subscription *service.UserSubscription) {
	if subscription != nil {
		c.Set(string(ContextKeySubscription), subscription)
	}
	c.Set(string(ContextKeyAPIKey), apiKey)
	c.Set(string(ContextKeyUser), AuthSubject{
		UserID:      apiKey.User.ID,
		Concurrency: apiKey.User.Concurrency,
	})
	c.Set(string(ContextKeyUserRole), apiKey.User.Role)
	setGroupContext(c, apiKey.Group)
}

func apiKeyHeadersTooLarge(c *gin.Context) bool {
	if c == nil {
		return false
	}
	return len(c.GetHeader("Authorization")) > maxAPIKeyAuthorizationHeaderBytes ||
		len(c.GetHeader("x-api-key")) > service.MaxAPIKeyCredentialBytes ||
		len(c.GetHeader("x-goog-api-key")) > service.MaxAPIKeyCredentialBytes
}

func hasAPIKeyCredentialInput(c *gin.Context) bool {
	if c == nil {
		return false
	}
	return c.GetHeader("Authorization") != "" ||
		c.GetHeader("x-api-key") != "" ||
		c.GetHeader("x-goog-api-key") != ""
}

func abortWithAPIKeyQuotaError(c *gin.Context) {
	const message = "API key 额度已用完"
	if isOpenAICompatibleAPIKeyRequest(c) {
		abortWithOpenAIQuotaError(c, http.StatusTooManyRequests, message)
		return
	}
	AbortWithError(c, http.StatusTooManyRequests, "API_KEY_QUOTA_EXHAUSTED", message)
}

func isOpenAICompatibleAPIKeyRequest(c *gin.Context) bool {
	if c == nil || c.Request == nil || c.Request.URL == nil {
		return false
	}

	path := strings.TrimRight(c.Request.URL.Path, "/")
	for _, root := range []string{
		"/v1/responses",
		"/openai/v1/responses",
		"/responses",
		"/backend-api/codex/responses",
	} {
		if path == root || strings.HasPrefix(path, root+"/") {
			return true
		}
	}
	return false
}

func isAsyncImageTaskRead(method, path string) bool {
	if method != http.MethodGet {
		return false
	}
	return strings.HasPrefix(path, "/v1/images/tasks/") || strings.HasPrefix(path, "/images/tasks/")
}

// GetAPIKeyFromContext 从上下文中获取API key
func GetAPIKeyFromContext(c *gin.Context) (*service.APIKey, bool) {
	value, exists := c.Get(string(ContextKeyAPIKey))
	if !exists {
		return nil, false
	}
	apiKey, ok := value.(*service.APIKey)
	return apiKey, ok
}

// SetOpsFallbackAPIKey 记录已加载的 API Key，供 Ops 错误日志在鉴权早退时回退使用。
// 与 ContextKeyAPIKey 区分：写入它不代表请求已通过鉴权，因此不影响 handler、
// 审计日志等对“已鉴权”的判断。
func SetOpsFallbackAPIKey(c *gin.Context, apiKey *service.APIKey) {
	if c == nil || apiKey == nil {
		return
	}
	c.Set(string(ContextKeyOpsFallbackAPIKey), apiKey)
}

// GetOpsFallbackAPIKey 读取 Ops 错误日志专用的回退 API Key。
func GetOpsFallbackAPIKey(c *gin.Context) (*service.APIKey, bool) {
	value, exists := c.Get(string(ContextKeyOpsFallbackAPIKey))
	if !exists {
		return nil, false
	}
	apiKey, ok := value.(*service.APIKey)
	return apiKey, ok
}

// GetSubscriptionFromContext 从上下文中获取订阅信息
func GetSubscriptionFromContext(c *gin.Context) (*service.UserSubscription, bool) {
	value, exists := c.Get(string(ContextKeySubscription))
	if !exists {
		return nil, false
	}
	subscription, ok := value.(*service.UserSubscription)
	return subscription, ok
}

func setGroupContext(c *gin.Context, group *service.Group) {
	if !service.IsGroupContextValid(group) {
		return
	}
	if existing, ok := c.Request.Context().Value(ctxkey.Group).(*service.Group); ok && existing != nil && existing.ID == group.ID && service.IsGroupContextValid(existing) {
		return
	}
	ctx := context.WithValue(c.Request.Context(), ctxkey.Group, group)
	c.Request = c.Request.WithContext(ctx)
}

// apiKeyBalanceBelowAuthThreshold 保持鉴权层的历史语义：仅在余额耗尽（<=0）时拒绝。
// MinimumBalanceReserve 只作为 billing-cache 预检的保守下限，不得复用为鉴权硬门槛，
// 否则已配置该值的存量部署升级后，0 < balance < reserve 的用户会在所有端点被静默 403。
func apiKeyBalanceBelowAuthThreshold(balance float64, _ *config.Config) bool {
	return balance <= 0
}

// validateAPIKeyFunding closes the entitlement decision for a routed request:
// an eligible plan pays first, an exhausted plan may fall back to wallet only
// when the plan allows it, and an uncovered route always requires wallet funds.
func validateAPIKeyFunding(
	ctx context.Context,
	apiKey *service.APIKey,
	subscription *service.UserSubscription,
	subscriptionService *service.SubscriptionService,
	cfg *config.Config,
) error {
	if apiKey == nil || apiKey.User == nil {
		return errAPIKeyInsufficientBalance
	}
	if subscription == nil {
		if apiKeyBalanceBelowAuthThreshold(apiKey.User.Balance, cfg) {
			return errAPIKeyInsufficientBalance
		}
		return nil
	}

	if !subscription.HasCycleQuota() || subscriptionService == nil {
		return nil
	}
	if err := subscriptionService.CheckUsageLimits(ctx, subscription, apiKey.Group, 0); err == nil {
		return nil
	} else if !subscription.WalletFallbackEnabled {
		return err
	}

	if apiKeyBalanceBelowAuthThreshold(apiKey.User.Balance, cfg) {
		return errAPIKeyInsufficientBalance
	}
	return nil
}

func abortIfAPIKeyGroupUnavailable(c *gin.Context, apiKey *service.APIKey) bool {
	code, message, ok := validateAPIKeyGroupAvailable(apiKey)
	if ok {
		return false
	}
	service.MarkOpsClientBusinessLimited(c, service.OpsClientBusinessLimitedReasonAPIKeyGroupUnavailable)
	if code == "GROUP_DELETED" {
		MarkIngressRejected(c, IngressRejectGroupDeleted)
	} else {
		MarkIngressRejected(c, IngressRejectGroupDisabled)
	}
	AbortWithError(c, 403, code, message)
	return true
}

func abortIfAPIKeyGroupNotAllowed(c *gin.Context, apiKey *service.APIKey) bool {
	if validateAPIKeyGroupAllowed(apiKey) {
		return false
	}
	service.MarkOpsClientBusinessLimited(c, service.OpsClientBusinessLimitedReasonAPIKeyGroupUnavailable)
	MarkIngressRejected(c, IngressRejectGroupNotAllowed)
	AbortWithError(c, 403, "GROUP_NOT_ALLOWED", "API Key 所属专属分组不再允许当前用户使用")
	return true
}

func validateAPIKeyGroupAllowed(apiKey *service.APIKey) bool {
	if apiKey == nil || apiKey.GroupID == nil || apiKey.User == nil || apiKey.Group == nil {
		return true
	}
	return apiKey.User.CanBindGroup(apiKey.Group.ID, apiKey.Group.IsExclusive)
}

func validateAPIKeyGroupAvailable(apiKey *service.APIKey) (string, string, bool) {
	if apiKey == nil || apiKey.GroupID == nil {
		return "", "", true
	}
	group := apiKey.Group
	if group == nil || strings.EqualFold(group.Status, "deleted") {
		return "GROUP_DELETED", "API Key 所属分组已删除", false
	}
	if !group.IsActive() {
		return "GROUP_DISABLED", "API Key 所属分组已停用", false
	}
	return "", "", true
}
