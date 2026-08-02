package service

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/config"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/require"
)

type requestBillingReservationRepoStub struct {
	mu sync.Mutex

	releaseCalls int
	rebindCalls  int
	heartbeats   int
	cleanupCalls int
	cleanupBatch int
	rebindCmd    *UsageBillingReservationRebindCommand
	cleanupCount int
}

func (r *requestBillingReservationRepoStub) ReserveRequestBilling(context.Context, *UsageBillingReservationCommand) (*UsageBillingReservationResult, error) {
	return &UsageBillingReservationResult{}, nil
}

func (r *requestBillingReservationRepoStub) RebindRequestBilling(_ context.Context, cmd *UsageBillingReservationRebindCommand) (*UsageBillingReservationResult, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.rebindCalls++
	copyCmd := *cmd
	r.rebindCmd = &copyCmd
	return &UsageBillingReservationResult{
		Applied:        true,
		Status:         "pending",
		GroupID:        cloneOptionalInt64(cmd.GroupID),
		ReservedAmount: cmd.EstimatedAmount,
		LeaseOwner:     cmd.LeaseOwner,
	}, nil
}

func (r *requestBillingReservationRepoStub) ReleaseRequestBilling(context.Context, *UsageBillingReservationReleaseCommand) (*UsageBillingReservationResult, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.releaseCalls++
	return &UsageBillingReservationResult{Applied: true, Status: "released"}, nil
}

func (r *requestBillingReservationRepoStub) HeartbeatRequestBilling(context.Context, *UsageBillingReservationHeartbeatCommand) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.heartbeats++
	return false, nil
}

func (r *requestBillingReservationRepoStub) ReleaseExpiredRequestBilling(_ context.Context, batchSize int) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.cleanupCalls++
	r.cleanupBatch = batchSize
	return r.cleanupCount, nil
}

func (r *requestBillingReservationRepoStub) counts() (release, rebind, heartbeat int) {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.releaseCalls, r.rebindCalls, r.heartbeats
}

func TestRequestBillingReservationHandle_MarkForSettlementPreventsRelease(t *testing.T) {
	repo := &requestBillingReservationRepoStub{}
	handle := &RequestBillingReservationHandle{
		repo:       repo,
		releaseCmd: UsageBillingReservationReleaseCommand{RequestID: "request", APIKeyID: 7, UserID: 42},
		reserved:   true,
	}
	handle.MarkForSettlement()
	handle.Close(context.Background())
	releaseCalls, _, _ := repo.counts()
	require.Zero(t, releaseCalls)
}

func TestRequestBillingReservationHandle_CloseIsIdempotent(t *testing.T) {
	repo := &requestBillingReservationRepoStub{}
	handle := &RequestBillingReservationHandle{
		repo:       repo,
		releaseCmd: UsageBillingReservationReleaseCommand{RequestID: "request", APIKeyID: 7, UserID: 42},
		reserved:   true,
	}
	handle.Close(context.Background())
	handle.Close(context.Background())
	releaseCalls, _, _ := repo.counts()
	require.Equal(t, 1, releaseCalls)
}

func TestRequestBillingReservationHandle_ConcurrentTerminalTransition(t *testing.T) {
	for i := 0; i < 100; i++ {
		repo := &requestBillingReservationRepoStub{}
		handle := &RequestBillingReservationHandle{
			repo:       repo,
			releaseCmd: UsageBillingReservationReleaseCommand{RequestID: "request", APIKeyID: 7, UserID: 42},
			reserved:   true,
		}
		var wait sync.WaitGroup
		wait.Add(2)
		go func() {
			defer wait.Done()
			handle.MarkForSettlement()
		}()
		go func() {
			defer wait.Done()
			handle.Close(context.Background())
		}()
		wait.Wait()
		releaseCalls, _, _ := repo.counts()
		require.LessOrEqual(t, releaseCalls, 1)
	}
}

func TestRequestBillingReservationHandle_RebindUsesCurrentGroupGuard(t *testing.T) {
	repo := &requestBillingReservationRepoStub{}
	oldGroupID := int64(10)
	newGroupID := int64(20)
	handle := &RequestBillingReservationHandle{
		repo:       repo,
		releaseCmd: UsageBillingReservationReleaseCommand{RequestID: "request", APIKeyID: 7, UserID: 42},
		groupID:    &oldGroupID,
		leaseOwner: "owner",
		reserved:   true,
	}
	err := handle.rebind(context.Background(), 42, 7, &newGroupID, decimal.NewFromInt(3), "payload", 900)
	require.NoError(t, err)
	_, rebindCalls, _ := repo.counts()
	require.Equal(t, 1, rebindCalls)
	require.NotNil(t, repo.rebindCmd)
	require.Equal(t, oldGroupID, *repo.rebindCmd.ExpectedGroupID)
	require.Equal(t, newGroupID, *repo.rebindCmd.GroupID)
}

func TestRequestBillingReservationHandle_HeartbeatStopsWhenReservationDisappears(t *testing.T) {
	repo := &requestBillingReservationRepoStub{}
	handle := &RequestBillingReservationHandle{
		repo:       repo,
		releaseCmd: UsageBillingReservationReleaseCommand{RequestID: "request", APIKeyID: 7, UserID: 42},
		leaseOwner: "owner",
		reserved:   true,
	}
	handle.startHeartbeat(5*time.Millisecond, 30)
	require.Eventually(t, func() bool {
		_, _, heartbeats := repo.counts()
		return heartbeats == 1
	}, time.Second, 5*time.Millisecond)
	handle.MarkForSettlement()
}

func TestRequestBillingReservationHandle_MarkForSettlementKeepsHeartbeat(t *testing.T) {
	repo := &requestBillingReservationRepoStub{}
	handle := &RequestBillingReservationHandle{
		repo:       repo,
		releaseCmd: UsageBillingReservationReleaseCommand{RequestID: "request", APIKeyID: 7, UserID: 42},
		leaseOwner: "owner",
		reserved:   true,
	}
	heartbeatCtx, cancel := context.WithCancel(context.Background())
	handle.heartbeat = cancel
	t.Cleanup(cancel)

	handle.MarkForSettlement()

	handle.mu.Lock()
	heartbeat := handle.heartbeat
	settle := handle.settle
	handle.mu.Unlock()
	require.True(t, settle)
	require.NotNil(t, heartbeat)
	require.NoError(t, heartbeatCtx.Err())
}

func TestUsageBillingReservationCleanupService_UsesConfigAndReleasesBatch(t *testing.T) {
	repo := &requestBillingReservationRepoStub{cleanupCount: 3}
	svc := NewUsageBillingReservationCleanupService(repo, &config.Config{
		Billing: config.BillingConfig{
			RequestReservationCleanupIntervalSeconds: 7,
			RequestReservationCleanupBatchSize:       25,
		},
	})
	require.Equal(t, 7*time.Second, svc.interval)
	require.Equal(t, 25, svc.batch)
	svc.cleanupOnce()
	repo.mu.Lock()
	defer repo.mu.Unlock()
	require.Equal(t, 1, repo.cleanupCalls)
	require.Equal(t, 25, repo.cleanupBatch)
}

func TestRequestReservationOutputTokens_UsesPracticalDefaultUnlessExplicit(t *testing.T) {
	require.Equal(t, requestReservationFallbackOutputTokens, requestReservationOutputTokens([]byte(`{"model":"test"}`), 128000))
	require.Equal(t, 12000, requestReservationOutputTokens([]byte(`{"max_output_tokens":12000}`), 128000))
	require.Equal(t, 8000, requestReservationOutputTokens([]byte(`{"max_tokens":12000}`), 8000))
}
