package admin

import (
	"encoding/json"
	"testing"

	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/stretchr/testify/require"
)

func TestAccountPriorityFieldJSONContract(t *testing.T) {
	tests := []struct {
		name      string
		payload   string
		wantSet   bool
		wantValue int
		wantErr   bool
	}{
		{name: "omitted", payload: `{}`, wantValue: 0},
		{name: "zero", payload: `{"priority":0}`, wantSet: true, wantValue: 0},
		{name: "positive", payload: `{"priority":1000}`, wantSet: true, wantValue: 1000},
		{name: "storage maximum", payload: `{"priority":2147483647}`, wantSet: true, wantValue: 2147483647},
		{name: "null", payload: `{"priority":null}`, wantErr: true},
		{name: "negative", payload: `{"priority":-1}`, wantErr: true},
		{name: "negative zero", payload: `{"priority":-0}`, wantErr: true},
		{name: "fraction", payload: `{"priority":1.0}`, wantErr: true},
		{name: "exponent", payload: `{"priority":1e3}`, wantErr: true},
		{name: "string", payload: `{"priority":"1"}`, wantErr: true},
		{name: "boolean", payload: `{"priority":true}`, wantErr: true},
		{name: "storage overflow", payload: `{"priority":2147483648}`, wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var req struct {
				Priority accountPriorityField `json:"priority"`
			}
			err := json.Unmarshal([]byte(tt.payload), &req)
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tt.wantSet, req.Priority.set)
			require.Equal(t, tt.wantValue, req.Priority.ValueOrDefault())
			if tt.wantSet {
				require.NotNil(t, req.Priority.OptionalValue())
				require.Equal(t, tt.wantValue, *req.Priority.OptionalValue())
			} else {
				require.Nil(t, req.Priority.OptionalValue())
			}
		})
	}
}

func TestAccountPriorityFieldMarshalPreservesPresence(t *testing.T) {
	tests := []struct {
		name  string
		field accountPriorityField
		want  string
	}{
		{name: "omitted", field: accountPriorityField{}, want: "null"},
		{name: "explicit zero", field: accountPriorityField{set: true, value: 0}, want: "0"},
		{name: "large integer", field: accountPriorityField{set: true, value: 2147483647}, want: "2147483647"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			encoded, err := json.Marshal(tt.field)
			require.NoError(t, err)
			require.Equal(t, tt.want, string(encoded))
		})
	}
}

func TestAccountPriorityFieldPresenceChangesIdempotencyFingerprint(t *testing.T) {
	type payload struct {
		Priority accountPriorityField `json:"priority"`
	}

	omitted, err := service.BuildIdempotencyFingerprint(
		"POST",
		"/api/v1/admin/accounts",
		"admin:1",
		payload{},
	)
	require.NoError(t, err)

	explicitZero, err := service.BuildIdempotencyFingerprint(
		"POST",
		"/api/v1/admin/accounts",
		"admin:1",
		payload{Priority: accountPriorityField{set: true, value: 0}},
	)
	require.NoError(t, err)
	require.NotEqual(t, omitted, explicitZero)
}
