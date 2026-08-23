package admin

import (
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/stretchr/testify/require"
)

func TestChannelMonitorRunResponseOnlyExposesRequestableStatuses(t *testing.T) {
	require.True(t, isRequestableMonitorStatus(service.MonitorStatusOperational))
	require.True(t, isRequestableMonitorStatus(service.MonitorStatusDegraded))
	require.False(t, isRequestableMonitorStatus(service.MonitorStatusFailed))
	require.False(t, isRequestableMonitorStatus(service.MonitorStatusError))

	result := checkResultToResponse(&service.CheckResult{
		Model:     "model-a",
		Status:    service.MonitorStatusOperational,
		Message:   "upstream private error details",
		CheckedAt: time.Now(),
	})
	require.Empty(t, result.Message)
}
