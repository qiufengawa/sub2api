package service

import (
	"bytes"
	"encoding/json"
	"fmt"
)

type updatePlanRequestAlias UpdatePlanRequest

func (r *UpdatePlanRequest) UnmarshalJSON(data []byte) error {
	var decoded updatePlanRequestAlias
	if err := json.Unmarshal(data, &decoded); err != nil {
		return err
	}

	var fields map[string]json.RawMessage
	if err := json.Unmarshal(data, &fields); err != nil {
		return err
	}

	*r = UpdatePlanRequest(decoded)
	if value, ok := fields["cycle_quota_usd"]; ok {
		r.CycleQuotaUSDSet = true
		if isJSONNull(value) {
			r.CycleQuotaUSD = nil
		}
	}
	if value, ok := fields["reset_interval_seconds"]; ok && isJSONNull(value) {
		return fmt.Errorf("reset_interval_seconds cannot be null")
	}
	if value, ok := fields["wallet_fallback_enabled"]; ok && isJSONNull(value) {
		return fmt.Errorf("wallet_fallback_enabled cannot be null")
	}
	return nil
}

func isJSONNull(value json.RawMessage) bool {
	return bytes.Equal(bytes.TrimSpace(value), []byte("null"))
}
