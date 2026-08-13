package service

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func priorityLayerTestAccounts() []*Account {
	return []*Account{
		{ID: 1, Priority: 10},
		{ID: 2, Priority: 10},
		{ID: 3, Priority: 9},
	}
}

func priorityLayerAccountIDs(accounts []*Account) []int64 {
	ids := make([]int64, 0, len(accounts))
	for _, account := range accounts {
		ids = append(ids, account.ID)
	}
	return ids
}

func TestSelectOpenAIActivePriorityLayerStartsAtHighestLayer(t *testing.T) {
	selected, blocked := selectOpenAIActivePriorityLayer(priorityLayerTestAccounts(), OpenAIAccountScheduleRequest{
		FailoverState: NewOpenAIAccountFailoverState(),
	})

	require.False(t, blocked)
	require.Equal(t, []int64{1, 2}, priorityLayerAccountIDs(selected))
}

func TestSelectOpenAIActivePriorityLayerKeepsRemainingHighPriorityAccount(t *testing.T) {
	state := NewOpenAIAccountFailoverState()
	state.MarkRetryableRuntimeFailure(1)

	selected, blocked := selectOpenAIActivePriorityLayer(priorityLayerTestAccounts(), OpenAIAccountScheduleRequest{
		FailoverState: state,
	})

	require.False(t, blocked)
	require.Equal(t, []int64{2}, priorityLayerAccountIDs(selected))
}

func TestSelectOpenAIActivePriorityLayerDescendsOnlyAfterRuntimeFailureExhaustsLayer(t *testing.T) {
	state := NewOpenAIAccountFailoverState()
	state.MarkRetryableRuntimeFailure(1)
	state.MarkRetryableRuntimeFailure(2)

	selected, blocked := selectOpenAIActivePriorityLayer(priorityLayerTestAccounts(), OpenAIAccountScheduleRequest{
		FailoverState: state,
	})

	require.False(t, blocked)
	require.Equal(t, []int64{3}, priorityLayerAccountIDs(selected))
}

func TestSelectOpenAIActivePriorityLayerSelectionRejectionNeverAuthorizesDescent(t *testing.T) {
	state := NewOpenAIAccountFailoverState()
	state.MarkSelectionRejected(1)
	state.MarkSelectionRejected(2)

	selected, blocked := selectOpenAIActivePriorityLayer(priorityLayerTestAccounts(), OpenAIAccountScheduleRequest{
		FailoverState: state,
	})

	require.True(t, blocked)
	require.Empty(t, selected)
}

func TestSelectOpenAIActivePriorityLayerMixedFailureReasonsRemainBlocked(t *testing.T) {
	state := NewOpenAIAccountFailoverState()
	state.MarkRetryableRuntimeFailure(1)
	state.MarkSelectionRejected(2)

	selected, blocked := selectOpenAIActivePriorityLayer(priorityLayerTestAccounts(), OpenAIAccountScheduleRequest{
		FailoverState: state,
	})

	require.True(t, blocked)
	require.Empty(t, selected)
}

func TestOpenAIAccountFailoverStateClonePreservesFailureReasonsIndependently(t *testing.T) {
	original := NewOpenAIAccountFailoverState()
	original.MarkRetryableRuntimeFailure(1)
	original.MarkSelectionRejected(2)

	clone := original.Clone()
	clone.MarkSelectionRejected(3)

	require.True(t, clone.IsRetryableRuntimeFailure(1))
	require.False(t, clone.IsRetryableRuntimeFailure(2))
	require.True(t, clone.IsExcluded(2))
	require.False(t, original.IsExcluded(3))
}
