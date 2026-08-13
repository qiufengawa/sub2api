package service

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strconv"
)

type updatePlanRequestAlias UpdatePlanRequest
type createPlanRequestAlias CreatePlanRequest

func (r *CreatePlanRequest) UnmarshalJSON(data []byte) error {
	var decoded createPlanRequestAlias
	if err := json.Unmarshal(data, &decoded); err != nil {
		return err
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(data, &fields); err != nil {
		return err
	}
	if value, ok := fields["max_subscriptions_per_user"]; ok {
		parsed, err := parseMaxSubscriptionsPerUserJSON(value)
		if err != nil {
			return err
		}
		decoded.MaxSubscriptionsPerUser = &parsed
	}
	*r = CreatePlanRequest(decoded)
	return nil
}

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
	if value, ok := fields["five_hour_quota_usd"]; ok {
		r.FiveHourQuotaUSDSet = true
		if isJSONNull(value) {
			r.FiveHourQuotaUSD = nil
		}
	}
	if value, ok := fields["cycle_quota_usd"]; ok {
		r.CycleQuotaUSDSet = true
		if isJSONNull(value) {
			r.CycleQuotaUSD = nil
		}
	}
	if value, ok := fields["total_quota_usd"]; ok {
		r.TotalQuotaUSDSet = true
		if isJSONNull(value) {
			r.TotalQuotaUSD = nil
		}
	}
	if value, ok := fields["reset_interval_seconds"]; ok && isJSONNull(value) {
		return fmt.Errorf("reset_interval_seconds cannot be null")
	}
	if value, ok := fields["wallet_fallback_enabled"]; ok && isJSONNull(value) {
		return fmt.Errorf("wallet_fallback_enabled cannot be null")
	}
	if value, ok := fields["max_subscriptions_per_user"]; ok {
		parsed, err := parseMaxSubscriptionsPerUserJSON(value)
		if err != nil {
			return err
		}
		r.MaxSubscriptionsPerUser = &parsed
	}
	return nil
}

func parseMaxSubscriptionsPerUserJSON(value json.RawMessage) (int, error) {
	raw := bytes.TrimSpace(value)
	if len(raw) == 0 || raw[0] < '1' || raw[0] > '9' {
		return 0, fmt.Errorf("max_subscriptions_per_user must be a positive decimal integer")
	}
	for _, ch := range raw[1:] {
		if ch < '0' || ch > '9' {
			return 0, fmt.Errorf("max_subscriptions_per_user must be a positive decimal integer")
		}
	}
	parsed, err := strconv.ParseInt(string(raw), 10, 32)
	if err != nil {
		return 0, fmt.Errorf("max_subscriptions_per_user exceeds PostgreSQL INTEGER range")
	}
	return int(parsed), nil
}

func isJSONNull(value json.RawMessage) bool {
	return bytes.Equal(bytes.TrimSpace(value), []byte("null"))
}
