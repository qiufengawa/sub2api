package service

import (
	infraerrors "github.com/Wei-Shaw/sub2api/internal/pkg/errors"
)

const (
	AccountPrioritySemanticsHigherWins = "higher_wins"
	AccountPrioritySemanticsLowerWins  = "lower_wins"
	// AccountPrioritySemanticMigrationKey identifies the database semantic epoch
	// understood by this binary. A different key is accepted only when the
	// database still declares higher_wins; the epoch provides cache fencing.
	AccountPrioritySemanticMigrationKey = "account_priority_higher_wins_v1"
	// DefaultAccountPriority is deliberately the lowest priority so a newly
	// created account cannot unexpectedly preempt an existing account pool.
	DefaultAccountPriority = 0
	// MaxAccountPriority is a storage boundary, not a product-level limit.
	// accounts.priority is a PostgreSQL INTEGER column.
	MaxAccountPriority int64 = 1<<31 - 1
)

// ValidateAccountPriority keeps every account write path on the same contract.
// Priority is an ordinal scheduling tier: larger values are preferred.
func ValidateAccountPriority(priority int) error {
	if priority < 0 {
		return infraerrors.BadRequest("ACCOUNT_PRIORITY_INVALID", "priority must be >= 0")
	}
	if int64(priority) > MaxAccountPriority {
		return infraerrors.BadRequest("ACCOUNT_PRIORITY_INVALID", "priority exceeds the integer storage range")
	}
	return nil
}

// ValidateAccountPriorityValues validates a complete batch before any write.
func ValidateAccountPriorityValues(values []int) error {
	for _, priority := range values {
		if err := ValidateAccountPriority(priority); err != nil {
			return err
		}
	}
	return nil
}

func isHigherAccountPriority(candidate, current int) bool {
	return candidate > current
}

func accountPriorityFactor(priority, minPriority, maxPriority int) float64 {
	if maxPriority <= minPriority {
		return 1
	}
	return float64(priority-minPriority) / float64(maxPriority-minPriority)
}

//nolint:unused // retained for compatibility with older scheduler callers.
func filterAccountsByMaxPriority(accounts []*Account) []*Account {
	if len(accounts) == 0 {
		return nil
	}
	maxPriority := accounts[0].Priority
	for _, account := range accounts[1:] {
		if account != nil && account.Priority > maxPriority {
			maxPriority = account.Priority
		}
	}
	filtered := make([]*Account, 0, len(accounts))
	for _, account := range accounts {
		if account != nil && account.Priority == maxPriority {
			filtered = append(filtered, account)
		}
	}
	return filtered
}
