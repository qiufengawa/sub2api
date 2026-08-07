package admin

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/pkg/response"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/gin-gonic/gin"
)

const maxAccountServiceStatusBatchSize = 200

var accountServiceStatusBatchCache = newSnapshotCache(30 * time.Second)

type accountServiceStatusBatchRequest struct {
	AccountIDs []int64 `json:"account_ids" binding:"required"`
}

// GetAccountServiceStatus returns passive service-health history for a batch of accounts.
// POST /api/v1/admin/ops/account-service-status
func (h *OpsHandler) GetAccountServiceStatus(c *gin.Context) {
	if h == nil || h.opsService == nil {
		response.Error(c, http.StatusServiceUnavailable, "Ops service not available")
		return
	}
	// Check the runtime switch before consulting the snapshot cache so disabling
	// monitoring cannot briefly expose a stale, apparently healthy result.
	if err := h.opsService.RequireMonitoringEnabled(c.Request.Context()); err != nil {
		response.ErrorFrom(c, err)
		return
	}

	var req accountServiceStatusBatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	accountIDs := normalizeInt64IDList(req.AccountIDs)
	if len(accountIDs) > maxAccountServiceStatusBatchSize {
		response.BadRequest(c, "A maximum of 200 account IDs is allowed")
		return
	}
	if len(accountIDs) == 0 {
		now := time.Now().UTC()
		response.Success(c, &service.AccountServiceStatusBatch{
			Enabled:       true,
			WindowStart:   now.Truncate(time.Hour).Add(-(service.AccountServiceStatusWindowHours - 1) * time.Hour),
			WindowEnd:     now,
			BucketSeconds: int(time.Hour / time.Second),
			Accounts:      map[int64]*service.AccountServiceStatus{},
		})
		return
	}

	cacheKey := buildAccountServiceStatusBatchCacheKey(accountIDs)
	entry, hit, err := accountServiceStatusBatchCache.GetOrLoad(cacheKey, func() (any, error) {
		return h.opsService.GetAccountServiceStatusBatch(c.Request.Context(), accountIDs)
	})
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}

	if entry.ETag != "" {
		c.Header("ETag", entry.ETag)
		c.Header("Vary", "If-None-Match")
		if ifNoneMatchMatched(c.GetHeader("If-None-Match"), entry.ETag) {
			c.Status(http.StatusNotModified)
			return
		}
	}
	if hit {
		c.Header("X-Snapshot-Cache", "hit")
	} else {
		c.Header("X-Snapshot-Cache", "miss")
	}
	response.Success(c, entry.Payload)
}

func buildAccountServiceStatusBatchCacheKey(accountIDs []int64) string {
	var builder strings.Builder
	builder.Grow(len(accountIDs) * 6)
	_, _ = builder.WriteString("account_service_status:")
	for index, accountID := range accountIDs {
		if index > 0 {
			_ = builder.WriteByte(',')
		}
		_, _ = builder.WriteString(strconv.FormatInt(accountID, 10))
	}
	return builder.String()
}
