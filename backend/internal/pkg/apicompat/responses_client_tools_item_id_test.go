package apicompat

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestRetypedResponsesToolCallItemID(t *testing.T) {
	for _, tc := range []struct {
		name     string
		id       string
		itemType string
		want     string
	}{
		{"function to custom", "fc_abc", "custom_tool_call", "ctc_abc"},
		{"function to search", "fc_abc", "tool_search_call", "tsc_abc"},
		{"custom to function", "ctc_abc", "function_call", "fc_abc"},
		{"already typed", "ctc_abc", "custom_tool_call", "ctc_abc"},
		{"unknown prefix", "item_abc", "custom_tool_call", "item_abc"},
		{"unconstrained type", "fc_abc", "message", "fc_abc"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.want, retypedResponsesToolCallItemID(tc.id, tc.itemType))
		})
	}
}

func TestAdaptResponsesClientToolsRecoversRetypedItemID(t *testing.T) {
	req := map[string]any{
		"tools": []any{
			map[string]any{"type": "custom", "name": "exec"},
			map[string]any{"type": "tool_search"},
		},
		"input": []any{
			map[string]any{"type": "custom_tool_call", "id": "ctc_upstream1", "call_id": "call_1", "name": "exec", "input": "dir"},
			map[string]any{"type": "tool_search_call", "id": "tsc_upstream2", "call_id": "call_2", "arguments": map[string]any{"query": "git"}},
			map[string]any{"type": "custom_tool_call_output", "id": "ctco_client", "call_id": "call_1", "output": "ok"},
		},
	}

	_, changed, err := AdaptResponsesClientTools(req)
	require.NoError(t, err)
	require.True(t, changed)
	input := requireResponsesClientToolValue[[]any](t, req["input"])
	require.Equal(t, "fc_upstream1", requireResponsesClientToolValue[map[string]any](t, input[0])["id"])
	require.Equal(t, "fc_upstream2", requireResponsesClientToolValue[map[string]any](t, input[1])["id"])
	require.NotContains(t, requireResponsesClientToolValue[map[string]any](t, input[2]), "id")
}

func TestRestoreResponsesClientToolPayloadRetypesItemIDs(t *testing.T) {
	mapping := ResponsesClientToolMapping{CustomTools: map[string]bool{"exec": true}, ToolSearch: true}
	payload := []byte(`{"output":[{"type":"function_call","id":"fc_abc","call_id":"call_1","name":"exec","arguments":"{\"input\":\"dir\"}"},{"type":"function_call","id":"fc_def","call_id":"call_2","name":"tool_search","arguments":"{\"query\":\"git\"}"}]}`)

	restored, changed, err := RestoreResponsesClientToolPayload(payload, mapping)
	require.NoError(t, err)
	require.True(t, changed)
	require.JSONEq(t, `{"output":[{"type":"custom_tool_call","id":"ctc_abc","call_id":"call_1","name":"exec","input":"dir"},{"type":"tool_search_call","id":"tsc_def","call_id":"call_2","execution":"client","arguments":{"query":"git"}}]}`, string(restored))
}

func TestResponsesClientToolStreamRestorerRetypesItemID(t *testing.T) {
	const upstreamID = "fc_abc"
	const clientID = "ctc_abc"
	restorer := NewResponsesClientToolStreamRestorer(ResponsesClientToolMapping{CustomTools: map[string]bool{"exec": true}})

	added := restorer.Restore(ResponsesStreamEvent{
		Type: "response.output_item.added", OutputIndex: 0,
		Item: &ResponsesOutput{Type: "function_call", ID: upstreamID, CallID: "call_1", Name: "exec"},
	})
	require.Len(t, added, 1)
	require.Equal(t, clientID, added[0].Item.ID)

	done := restorer.Restore(ResponsesStreamEvent{
		Type: "response.function_call_arguments.done", OutputIndex: 0, ItemID: upstreamID,
		CallID: "call_1", Name: "exec", Arguments: `{"input":"dir"}`,
	})
	require.Len(t, done, 2)
	require.Equal(t, clientID, done[0].ItemID)
	require.Equal(t, clientID, done[1].ItemID)
}
