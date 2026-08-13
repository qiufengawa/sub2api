package admin

import (
	"bytes"
	"errors"
	"fmt"
	"strconv"

	"github.com/Wei-Shaw/sub2api/internal/service"
)

// accountPriorityField preserves JSON presence separately from its value.
// The wire contract accepts only canonical, non-negative decimal integers:
// an omitted key means default/no change, while null and alternate number
// spellings such as -0, 1.0, and 1e3 are rejected.
type accountPriorityField struct {
	set   bool
	value int
}

func (f *accountPriorityField) UnmarshalJSON(data []byte) error {
	f.set = true
	parsed, err := parseCanonicalPriorityInteger(data, service.MaxAccountPriority)
	if err != nil {
		return err
	}
	f.value = parsed
	return nil
}

func parseCanonicalPriorityInteger(data []byte, max int64) (int, error) {
	raw := bytes.TrimSpace(data)
	if bytes.Equal(raw, []byte("null")) {
		return 0, errors.New("priority must be a non-negative integer")
	}
	if len(raw) == 0 || (len(raw) > 1 && raw[0] == '0') || raw[0] == '-' {
		return 0, errors.New("priority must use canonical non-negative integer syntax")
	}
	for _, ch := range raw {
		if ch < '0' || ch > '9' {
			return 0, errors.New("priority must use canonical non-negative integer syntax")
		}
	}
	parsed, err := strconv.ParseInt(string(raw), 10, 64)
	if err != nil || parsed < 0 || parsed > max || parsed > int64(^uint(0)>>1) {
		return 0, fmt.Errorf("priority exceeds the integer storage range")
	}
	return int(parsed), nil
}

// MarshalJSON keeps presence semantics in idempotency fingerprints and any
// internal request serialization.  An omitted field is represented as null
// here only for the internal hash; inbound null remains invalid in
// UnmarshalJSON.  Explicit zero is serialized as the canonical integer 0.
func (f accountPriorityField) MarshalJSON() ([]byte, error) {
	if !f.set {
		return []byte("null"), nil
	}
	return []byte(strconv.Itoa(f.value)), nil
}

func (f accountPriorityField) ValueOrDefault() int {
	if !f.set {
		return service.DefaultAccountPriority
	}
	return f.value
}

func (f accountPriorityField) OptionalValue() *int {
	if !f.set {
		return nil
	}
	value := f.value
	return &value
}
