package admin

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type accountServiceStatusHandlerRepo struct {
	service.OpsRepository
	calls int
}

func (r *accountServiceStatusHandlerRepo) GetAccountServiceStatusBuckets(
	_ context.Context,
	_ []int64,
	_ time.Time,
	_ time.Time,
) ([]service.AccountServiceStatusBucketAggregate, error) {
	r.calls++
	return []service.AccountServiceStatusBucketAggregate{}, nil
}

func newAccountServiceStatusTestRouter(handler *OpsHandler) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.POST("/account-service-status", handler.GetAccountServiceStatus)
	return router
}

func performAccountServiceStatusRequest(
	router http.Handler,
	body any,
	etag string,
) *httptest.ResponseRecorder {
	raw, _ := json.Marshal(body)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/account-service-status", bytes.NewReader(raw))
	request.Header.Set("Content-Type", "application/json")
	if etag != "" {
		request.Header.Set("If-None-Match", etag)
	}
	router.ServeHTTP(recorder, request)
	return recorder
}

func TestAccountServiceStatusHandlerCachesBatchAndSupportsETag(t *testing.T) {
	previousCache := accountServiceStatusBatchCache
	accountServiceStatusBatchCache = newSnapshotCache(5 * time.Second)
	t.Cleanup(func() { accountServiceStatusBatchCache = previousCache })

	repo := &accountServiceStatusHandlerRepo{}
	svc := service.NewOpsService(repo, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil)
	router := newAccountServiceStatusTestRouter(NewOpsHandler(svc))
	body := map[string]any{"account_ids": []int64{7, 8, 7}}

	first := performAccountServiceStatusRequest(router, body, "")
	require.Equal(t, http.StatusOK, first.Code)
	require.Equal(t, "miss", first.Header().Get("X-Snapshot-Cache"))
	etag := first.Header().Get("ETag")
	require.NotEmpty(t, etag)
	require.Equal(t, 1, repo.calls)

	second := performAccountServiceStatusRequest(router, body, "")
	require.Equal(t, http.StatusOK, second.Code)
	require.Equal(t, "hit", second.Header().Get("X-Snapshot-Cache"))
	require.Equal(t, 1, repo.calls)

	notModified := performAccountServiceStatusRequest(router, body, etag)
	require.Equal(t, http.StatusNotModified, notModified.Code)
	require.Empty(t, notModified.Body.String())
	require.Equal(t, 1, repo.calls)
}

func TestAccountServiceStatusHandlerDoesNotServeCachedHealthAfterDisable(t *testing.T) {
	previousCache := accountServiceStatusBatchCache
	accountServiceStatusBatchCache = newSnapshotCache(5 * time.Second)
	t.Cleanup(func() { accountServiceStatusBatchCache = previousCache })

	repo := &accountServiceStatusHandlerRepo{}
	svc := service.NewOpsService(repo, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil)
	router := newAccountServiceStatusTestRouter(NewOpsHandler(svc))
	body := map[string]any{"account_ids": []int64{7}}

	first := performAccountServiceStatusRequest(router, body, "")
	require.Equal(t, http.StatusOK, first.Code)
	svc.SetMonitoringEnabled(false)

	disabled := performAccountServiceStatusRequest(router, body, "")
	require.Equal(t, http.StatusNotFound, disabled.Code)
	require.Equal(t, 1, repo.calls)
}

func TestAccountServiceStatusHandlerRejectsOversizedBatch(t *testing.T) {
	svc := service.NewOpsService(&accountServiceStatusHandlerRepo{}, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil)
	router := newAccountServiceStatusTestRouter(NewOpsHandler(svc))
	accountIDs := make([]int64, maxAccountServiceStatusBatchSize+1)
	for index := range accountIDs {
		accountIDs[index] = int64(index + 1)
	}

	response := performAccountServiceStatusRequest(router, map[string]any{"account_ids": accountIDs}, "")
	require.Equal(t, http.StatusBadRequest, response.Code)
}
