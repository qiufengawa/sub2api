//go:build unit

package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	servermiddleware "github.com/Wei-Shaw/sub2api/internal/server/middleware"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type playgroundOptionListerStub struct {
	result *service.PlaygroundAPIKeyOptionList
	err    error
	calls  int
}

func (s *playgroundOptionListerStub) ListPlaygroundOptions(_ context.Context, _ int64) (*service.PlaygroundAPIKeyOptionList, error) {
	s.calls++
	return s.result, s.err
}

func TestPlaygroundListKeysReturnsCredentialFreeProjection(t *testing.T) {
	gin.SetMode(gin.TestMode)
	groupID := int64(9)
	stub := &playgroundOptionListerStub{result: &service.PlaygroundAPIKeyOptionList{
		Items: []service.PlaygroundAPIKeyOption{{
			ID: 3, Name: "  long key name  ", Status: service.StatusAPIKeyActive,
			GroupID: &groupID, GroupName: "  OpenAI plan  ", Platform: service.PlatformOpenAI,
		}},
		Truncated: true,
	}}
	h := &PlaygroundHandler{apiKeyService: stub}
	r := gin.New()
	r.GET("/api/v1/playground/keys", func(c *gin.Context) {
		c.Set(string(servermiddleware.ContextKeyUser), servermiddleware.AuthSubject{UserID: 7})
		h.ListKeys(c)
	})

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/v1/playground/keys", nil))
	require.Equal(t, http.StatusOK, w.Code)
	require.Equal(t, "no-store", w.Header().Get("Cache-Control"))
	require.NotContains(t, w.Body.String(), "sk-")

	var envelope struct {
		Code int                     `json:"code"`
		Data playgroundKeyOptionList `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &envelope))
	require.Zero(t, envelope.Code)
	require.True(t, envelope.Data.Truncated)
	require.Len(t, envelope.Data.Items, 1)
	require.Equal(t, "long key name", envelope.Data.Items[0].Name)
	require.Equal(t, "OpenAI plan", envelope.Data.Items[0].GroupName)
	require.Equal(t, service.PlatformOpenAI, envelope.Data.Items[0].Platform)
	require.NotContains(t, w.Body.String(), `"key"`)
}

func TestPlaygroundListKeysRequiresAuthSubject(t *testing.T) {
	gin.SetMode(gin.TestMode)
	stub := &playgroundOptionListerStub{}
	h := &PlaygroundHandler{apiKeyService: stub}
	r := gin.New()
	r.GET("/api/v1/playground/keys", h.ListKeys)

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/v1/playground/keys", nil))
	require.Equal(t, http.StatusUnauthorized, w.Code)
	require.Equal(t, "no-store", w.Header().Get("Cache-Control"))
	require.Zero(t, stub.calls)
}
