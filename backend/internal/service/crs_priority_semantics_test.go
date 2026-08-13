package service

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNormalizeCRSAccountPriorities(t *testing.T) {
	t.Run("higher wins remains unchanged", func(t *testing.T) {
		payload := &crsExportResponse{}
		payload.Data.PrioritySemanticsSnake = AccountPrioritySemanticsHigherWins
		payload.Data.OpenAIResponsesAccounts = []crsOpenAIResponsesAccount{
			{Priority: crsPriorityField{set: true, value: 2}},
			{Priority: crsPriorityField{set: true, value: 9}},
		}
		require.NoError(t, normalizeCRSAccountPriorities(payload))
		require.Equal(t, 2, payload.Data.OpenAIResponsesAccounts[0].Priority.value)
		require.Equal(t, 9, payload.Data.OpenAIResponsesAccounts[1].Priority.value)
	})

	t.Run("recognized legacy converts once with source pivot", func(t *testing.T) {
		payload := &crsExportResponse{}
		payload.Data.Version = 1
		payload.Data.PrioritySemantics = AccountPrioritySemanticsLowerWins
		payload.Data.PriorityPivotSnake = crsPriorityField{set: true, value: 50}
		payload.Data.ClaudeAccounts = []crsClaudeAccount{
			{Priority: crsPriorityField{set: true, value: 1}},
			{Priority: crsPriorityField{set: true, value: 50}},
		}
		require.NoError(t, normalizeCRSAccountPriorities(payload))
		require.Equal(t, 49, payload.Data.ClaudeAccounts[0].Priority.value)
		require.Equal(t, 0, payload.Data.ClaudeAccounts[1].Priority.value)
	})

	t.Run("ambiguous unversioned source is blocked", func(t *testing.T) {
		payload := &crsExportResponse{}
		payload.Data.GeminiAPIKeyAccounts = []crsGeminiAPIKeyAccount{
			{Priority: crsPriorityField{set: true, value: 1}},
		}
		require.ErrorContains(t, normalizeCRSAccountPriorities(payload), "missing priority_semantics")
	})

	t.Run("unknown semantics is blocked", func(t *testing.T) {
		payload := &crsExportResponse{}
		payload.Data.PrioritySemantics = "mixed"
		require.ErrorContains(t, normalizeCRSAccountPriorities(payload), "unsupported CRS priority semantics")
	})

	t.Run("legacy source without pivot is blocked", func(t *testing.T) {
		payload := &crsExportResponse{}
		payload.Data.Version = 1
		payload.Data.PrioritySemantics = AccountPrioritySemanticsLowerWins
		payload.Data.GeminiAPIKeyAccounts = []crsGeminiAPIKeyAccount{
			{Priority: crsPriorityField{set: true, value: 1}},
		}
		require.ErrorContains(t, normalizeCRSAccountPriorities(payload), "priority_pivot")
	})

	t.Run("missing higher wins priority remains absent", func(t *testing.T) {
		payload := &crsExportResponse{}
		payload.Data.PrioritySemantics = AccountPrioritySemanticsHigherWins
		payload.Data.ClaudeAccounts = []crsClaudeAccount{{}}
		require.NoError(t, normalizeCRSAccountPriorities(payload))
		require.False(t, payload.Data.ClaudeAccounts[0].Priority.set)
		require.Equal(t, DefaultAccountPriority, payload.Data.ClaudeAccounts[0].Priority.valueOrDefault())
	})

	t.Run("strict priority tokens are rejected by CRS decoding", func(t *testing.T) {
		for _, token := range []string{"null", "-0", "1.0", "1e3", `"1"`, "true", "2147483648"} {
			t.Run(token, func(t *testing.T) {
				var payload crsExportResponse
				raw := `{"success":true,"data":{"priority_semantics":"higher_wins","claudeAccounts":[{"priority":` + token + `}]}}`
				require.Error(t, json.Unmarshal([]byte(raw), &payload))
			})
		}
	})
}
