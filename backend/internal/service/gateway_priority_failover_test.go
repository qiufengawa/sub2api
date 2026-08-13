//go:build unit

package service

import (
	"context"
	"testing"

	"github.com/Wei-Shaw/sub2api/internal/pkg/ctxkey"
	"github.com/stretchr/testify/require"
)

func newGatewayPriorityFailoverTestService() *GatewayService {
	accounts := []Account{
		{ID: 20, Name: "primary", Platform: PlatformAnthropic, Type: AccountTypeAPIKey, Priority: 10, Status: StatusActive, Schedulable: true},
		{ID: 10, Name: "standby", Platform: PlatformAnthropic, Type: AccountTypeAPIKey, Priority: 9, Status: StatusActive, Schedulable: true},
	}
	repo := &mockAccountRepoForPlatform{accounts: accounts, accountsByID: make(map[int64]*Account, len(accounts))}
	for i := range repo.accounts {
		repo.accountsByID[repo.accounts[i].ID] = &repo.accounts[i]
	}
	return &GatewayService{accountRepo: repo, cfg: testConfig()}
}

func TestGatewaySinglePlatformPriorityFailoverReasons(t *testing.T) {
	ctx := context.WithValue(context.Background(), ctxkey.ForcePlatform, PlatformAnthropic)

	t.Run("initial selection stays in highest priority layer", func(t *testing.T) {
		account, err := newGatewayPriorityFailoverTestService().SelectAccountForModelWithFailoverState(ctx, nil, "", "", NewAccountFailoverState())
		require.NoError(t, err)
		require.Equal(t, int64(20), account.ID)
	})

	t.Run("selection rejection blocks lower layer", func(t *testing.T) {
		state := NewAccountFailoverState()
		state.MarkSelectionRejected(20)
		account, err := newGatewayPriorityFailoverTestService().SelectAccountForModelWithFailoverState(ctx, nil, "", "", state)
		require.Nil(t, account)
		require.ErrorContains(t, err, "priority_layer_blocked")
	})

	t.Run("retryable runtime failure unlocks lower layer", func(t *testing.T) {
		state := NewAccountFailoverState()
		state.MarkRetryableRuntimeFailure(20)
		account, err := newGatewayPriorityFailoverTestService().SelectAccountForModelWithFailoverState(ctx, nil, "", "", state)
		require.NoError(t, err)
		require.Equal(t, int64(10), account.ID)
	})
}

func TestGatewayMixedPlatformPriorityFailoverReasons(t *testing.T) {
	ctx := context.Background()

	t.Run("initial selection stays in highest priority layer", func(t *testing.T) {
		account, err := newGatewayPriorityFailoverTestService().SelectAccountForModelWithFailoverState(ctx, nil, "", "", NewAccountFailoverState())
		require.NoError(t, err)
		require.Equal(t, int64(20), account.ID)
	})

	t.Run("selection rejection blocks lower layer", func(t *testing.T) {
		state := NewAccountFailoverState()
		state.MarkSelectionRejected(20)
		account, err := newGatewayPriorityFailoverTestService().SelectAccountForModelWithFailoverState(ctx, nil, "", "", state)
		require.Nil(t, account)
		require.ErrorContains(t, err, "priority_layer_blocked")
	})

	t.Run("retryable runtime failure unlocks lower layer", func(t *testing.T) {
		state := NewAccountFailoverState()
		state.MarkRetryableRuntimeFailure(20)
		account, err := newGatewayPriorityFailoverTestService().SelectAccountForModelWithFailoverState(ctx, nil, "", "", state)
		require.NoError(t, err)
		require.Equal(t, int64(10), account.ID)
	})
}
