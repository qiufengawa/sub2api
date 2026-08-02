package handler

import (
	"context"
	"strings"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/pkg/logger"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

type requestBillingReserver interface {
	ReserveRequestBilling(context.Context, *service.User, *service.APIKey, service.RequestBillingEstimate, string) (*service.RequestBillingReservationHandle, error)
}

func reserveRequestBilling(
	c *gin.Context,
	reserver requestBillingReserver,
	user *service.User,
	apiKey *service.APIKey,
	estimate service.RequestBillingEstimate,
	payloadHash string,
) (*service.RequestBillingReservationHandle, error) {
	if reserver == nil {
		return &service.RequestBillingReservationHandle{}, nil
	}
	requestCtx := service.EnsureUsageBillingRequestContext(c.Request.Context())
	c.Request = c.Request.WithContext(requestCtx)
	return reserver.ReserveRequestBilling(requestCtx, user, apiKey, estimate, payloadHash)
}

func requestBillingEstimateModel(requestedModel string, mapping service.ChannelMappingResult) string {
	if mapping.Mapped && mapping.BillingModelSource == service.BillingModelSourceChannelMapped {
		if mappedModel := strings.TrimSpace(mapping.MappedModel); mappedModel != "" {
			return mappedModel
		}
	}
	return strings.TrimSpace(requestedModel)
}

func runUsageRecordTaskSynchronously(task service.UsageRecordTask, component string) (completed bool) {
	return runUsageRecordTaskSynchronouslyWithTimeout(task, component, 10*time.Second)
}

func runUsageRecordTaskSynchronouslyWithTimeout(task service.UsageRecordTask, component string, timeout time.Duration) bool {
	if task == nil {
		return false
	}
	if timeout <= 0 {
		timeout = 10 * time.Second
	}
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	result := make(chan bool, 1)
	go func() {
		completed := true
		defer func() {
			if recovered := recover(); recovered != nil {
				completed = false
				logger.L().With(
					zap.String("component", component),
					zap.Any("panic", recovered),
				).Error("gateway.usage_record_task_panic_recovered")
			}
			result <- completed
		}()
		task(ctx)
	}()

	select {
	case completed := <-result:
		return completed
	case <-ctx.Done():
		logger.L().With(
			zap.String("component", component),
			zap.Duration("timeout", timeout),
		).Warn("gateway.usage_record_task_sync_fallback_timeout")
		// The goroutine owns the settlement attempt after this point. Returning
		// true prevents the request defer from releasing the same reservation;
		// the database lease is the final recovery boundary if it never settles.
		return true
	}
}
