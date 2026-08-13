package service

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestValidateAccountPriority(t *testing.T) {
	tests := []struct {
		name     string
		priority int
		wantErr  bool
	}{
		{name: "zero", priority: 0},
		{name: "one", priority: 1},
		{name: "large product value", priority: 1000},
		{name: "storage maximum", priority: int(MaxAccountPriority)},
		{name: "negative", priority: -1, wantErr: true},
	}
	if int64(^uint(0)>>1) > MaxAccountPriority {
		tests = append(tests, struct {
			name     string
			priority int
			wantErr  bool
		}{name: "above storage maximum", priority: int(MaxAccountPriority + 1), wantErr: true})
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateAccountPriority(tt.priority)
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
		})
	}
}

func TestAccountPriorityFactorHigherWins(t *testing.T) {
	require.Equal(t, 1.0, accountPriorityFactor(5, 5, 5))
	require.Equal(t, 0.0, accountPriorityFactor(0, 0, 1000))
	require.Equal(t, 0.5, accountPriorityFactor(500, 0, 1000))
	require.Equal(t, 1.0, accountPriorityFactor(1000, 0, 1000))
}
