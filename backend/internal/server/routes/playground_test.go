//go:build unit

package routes

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/Wei-Shaw/sub2api/internal/config"
	"github.com/Wei-Shaw/sub2api/internal/handler"
	"github.com/Wei-Shaw/sub2api/internal/server/middleware"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type playgroundRouteSettingRepoStub struct {
	values map[string]string
}

func (s *playgroundRouteSettingRepoStub) Get(context.Context, string) (*service.Setting, error) {
	panic("unexpected Get call")
}

func (s *playgroundRouteSettingRepoStub) GetValue(_ context.Context, key string) (string, error) {
	return s.values[key], nil
}

func (s *playgroundRouteSettingRepoStub) Set(context.Context, string, string) error {
	panic("unexpected Set call")
}

func (s *playgroundRouteSettingRepoStub) GetMultiple(_ context.Context, keys []string) (map[string]string, error) {
	values := make(map[string]string, len(keys))
	for _, key := range keys {
		if value, ok := s.values[key]; ok {
			values[key] = value
		}
	}
	return values, nil
}

func (s *playgroundRouteSettingRepoStub) SetMultiple(context.Context, map[string]string) error {
	panic("unexpected SetMultiple call")
}

func (s *playgroundRouteSettingRepoStub) GetAll(context.Context) (map[string]string, error) {
	panic("unexpected GetAll call")
}

func (s *playgroundRouteSettingRepoStub) Delete(context.Context, string) error {
	panic("unexpected Delete call")
}

func TestPlaygroundRoutesDoNotCaptureChatBodiesInManagementAudit(t *testing.T) {
	source, err := os.ReadFile("playground.go")
	require.NoError(t, err)
	text := string(source)
	require.NotContains(t, text, "AuditLogMiddleware")
	require.NotContains(t, text, "gin.HandlerFunc(auditLog)")
	require.True(t, strings.Contains(text, `c.Header("Cache-Control", "no-store")`))
	require.Contains(t, text, `keyRoutes(cfg.Gateway.TextMaxBodySize)`)
	require.Contains(t, text, `keyRoutes(cfg.Gateway.MaxBodySize)`)
	require.Contains(t, text, `imageRoutes.POST("/images/generations"`)
	require.Less(t,
		strings.Index(text, `c.Header("Cache-Control", "no-store")`),
		strings.Index(text, "playground.Use(gin.HandlerFunc(jwtAuth))"),
	)
}

func TestPlaygroundRoutesDisabledReturnNotFoundWithoutCaching(t *testing.T) {
	gin.SetMode(gin.TestMode)
	settingService := service.NewSettingService(&playgroundRouteSettingRepoStub{values: map[string]string{
		service.SettingKeyPlaygroundEnabled: "false",
	}}, &config.Config{})
	handlers := &handler.Handlers{
		Playground:    handler.NewPlaygroundHandler(nil),
		Gateway:       &handler.GatewayHandler{},
		OpenAIGateway: &handler.OpenAIGatewayHandler{},
	}
	router := gin.New()
	jwtAuth := middleware.JWTAuthMiddleware(func(c *gin.Context) {
		c.Set(string(middleware.ContextKeyUser), middleware.AuthSubject{UserID: 7})
		c.Next()
	})
	RegisterPlaygroundRoutes(
		router.Group("/api/v1"),
		handlers,
		jwtAuth,
		settingService,
		nil,
		nil,
		nil,
		nil,
		nil,
		&config.Config{Gateway: config.GatewayConfig{MaxBodySize: 2048, TextMaxBodySize: 1024}},
	)

	requests := []struct {
		method string
		path   string
	}{
		{method: http.MethodGet, path: "/api/v1/playground/keys"},
		{method: http.MethodGet, path: "/api/v1/playground/keys/41/models"},
		{method: http.MethodPost, path: "/api/v1/playground/keys/41/chat/completions"},
		{method: http.MethodPost, path: "/api/v1/playground/keys/41/images/generations"},
	}
	for _, request := range requests {
		t.Run(request.method+" "+request.path, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			router.ServeHTTP(recorder, httptest.NewRequest(request.method, request.path, nil))

			require.Equal(t, http.StatusNotFound, recorder.Code)
			require.Equal(t, "no-store", recorder.Header().Get("Cache-Control"))
		})
	}
}
