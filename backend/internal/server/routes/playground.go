package routes

import (
	"net/http"

	"github.com/Wei-Shaw/sub2api/internal/config"
	"github.com/Wei-Shaw/sub2api/internal/handler"
	"github.com/Wei-Shaw/sub2api/internal/pkg/response"
	"github.com/Wei-Shaw/sub2api/internal/server/middleware"
	"github.com/Wei-Shaw/sub2api/internal/service"

	"github.com/gin-gonic/gin"
)

// RegisterPlaygroundRoutes registers the authenticated, panel-only model Playground.
func RegisterPlaygroundRoutes(
	v1 *gin.RouterGroup,
	h *handler.Handlers,
	jwtAuth middleware.JWTAuthMiddleware,
	settingService *service.SettingService,
	panelRateLimiter *middleware.PanelRateLimiter,
	apiKeyService *service.APIKeyService,
	subscriptionService *service.SubscriptionService,
	opsService *service.OpsService,
	compositeResolver *service.CompositeRouteResolver,
	cfg *config.Config,
) {
	playground := v1.Group("/playground")
	playground.Use(func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		c.Next()
	})
	playground.Use(gin.HandlerFunc(jwtAuth))
	playground.Use(middleware.BackendModeUserGuard(settingService))
	playground.Use(panelRateLimiter.Global())
	playground.Use(func(c *gin.Context) {
		if settingService == nil || !settingService.IsPlaygroundEnabled(c.Request.Context()) {
			response.NotFound(c, "Playground is disabled")
			c.Abort()
			return
		}
		c.Next()
	})

	playground.GET("/keys", h.Playground.ListKeys)

	keyRoutes := func(bodySize int64) *gin.RouterGroup {
		routes := playground.Group("/keys/:key_id")
		routes.Use(middleware.RequestBodyLimit(bodySize))
		routes.Use(middleware.ClientRequestID())
		routes.Use(handler.OpsErrorLoggerMiddleware(opsService))
		routes.Use(handler.InboundEndpointMiddleware())
		routes.Use(middleware.NewPlaygroundAPIKeyAuthMiddleware(apiKeyService, subscriptionService, cfg))
		routes.Use(compositeTargetPlatformMiddleware(compositeResolver))
		routes.Use(middleware.RequireGroupAssignment(settingService, middleware.AnthropicErrorWriter))
		return routes
	}

	textRoutes := keyRoutes(cfg.Gateway.TextMaxBodySize)
	textRoutes.GET("/models", h.Gateway.Models)
	textRoutes.POST("/chat/completions", func(c *gin.Context) {
		switch getGroupPlatform(c) {
		case service.PlatformOpenAI, service.PlatformGrok:
			h.OpenAIGateway.ChatCompletions(c)
		default:
			h.Gateway.ChatCompletions(c)
		}
	})

	imageRoutes := keyRoutes(cfg.Gateway.MaxBodySize)
	imageRoutes.POST("/images/generations", func(c *gin.Context) {
		switch getGroupPlatform(c) {
		case service.PlatformOpenAI:
			h.OpenAIGateway.Images(c)
		case service.PlatformGrok:
			h.OpenAIGateway.GrokImages(c)
		default:
			service.MarkOpsClientBusinessLimited(c, service.OpsClientBusinessLimitedReasonLocalFeatureGate)
			c.JSON(http.StatusNotFound, gin.H{
				"error": gin.H{
					"type":    "not_found_error",
					"message": "Images API is not supported for this platform",
				},
			})
		}
	})
}
