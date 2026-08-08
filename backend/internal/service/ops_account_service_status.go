package service

import (
	"context"
	"fmt"
	"sort"
	"time"
)

const (
	// The status timeline is intentionally minute-granular so the admin account
	// list can show recent changes without turning the passive metric into an
	// active upstream probe.
	AccountServiceStatusWindowMinutes = 60
	AccountServiceStatusBucketMinutes = 1
	AccountServiceStatusBucketCount   = AccountServiceStatusWindowMinutes / AccountServiceStatusBucketMinutes

	AccountServiceStatusOperational = "operational"
	AccountServiceStatusDegraded    = "degraded"
	AccountServiceStatusFailed      = "failed"
	AccountServiceStatusUnknown     = "unknown"
)

// AccountServiceStatusBucketAggregate is the repository-level aggregate for one account/minute.
type AccountServiceStatusBucketAggregate struct {
	AccountID             int64
	BucketStart           time.Time
	SuccessCount          int64
	FailureCount          int64
	AverageFirstTokenMs   *float64
	FirstTokenSampleCount int64
	AverageTokensPerSec   *float64
	SpeedSampleCount      int64
	LastCallAt            *time.Time
}

type accountServiceStatusRepository interface {
	GetAccountServiceStatusBuckets(
		ctx context.Context,
		accountIDs []int64,
		startTime time.Time,
		endTime time.Time,
	) ([]AccountServiceStatusBucketAggregate, error)
}

type AccountServiceStatusBucket struct {
	StartTime           time.Time  `json:"start_time"`
	EndTime             time.Time  `json:"end_time"`
	Status              string     `json:"status"`
	SuccessRate         *float64   `json:"success_rate"`
	SuccessCount        int64      `json:"success_count"`
	FailureCount        int64      `json:"failure_count"`
	RequestCount        int64      `json:"request_count"`
	AverageFirstTokenMs *float64   `json:"average_first_token_ms"`
	AverageTokensPerSec *float64   `json:"average_tokens_per_second"`
	LastCallAt          *time.Time `json:"last_call_at"`
}

type AccountServiceStatus struct {
	AccountID           int64                        `json:"account_id"`
	Status              string                       `json:"status"`
	SuccessRate         *float64                     `json:"success_rate"`
	SuccessCount        int64                        `json:"success_count"`
	FailureCount        int64                        `json:"failure_count"`
	RequestCount        int64                        `json:"request_count"`
	AverageFirstTokenMs *float64                     `json:"average_first_token_ms"`
	AverageTokensPerSec *float64                     `json:"average_tokens_per_second"`
	LastCallAt          *time.Time                   `json:"last_call_at"`
	Buckets             []AccountServiceStatusBucket `json:"buckets"`
}

type AccountServiceStatusBatch struct {
	Enabled       bool                            `json:"enabled"`
	WindowStart   time.Time                       `json:"window_start"`
	WindowEnd     time.Time                       `json:"window_end"`
	BucketSeconds int                             `json:"bucket_seconds"`
	Accounts      map[int64]*AccountServiceStatus `json:"accounts"`
}

// GetAccountServiceStatusBatch summarizes passive, real-request outcomes for the requested accounts.
// It never probes an account or calls an upstream provider.
func (s *OpsService) GetAccountServiceStatusBatch(ctx context.Context, accountIDs []int64) (*AccountServiceStatusBatch, error) {
	return s.getAccountServiceStatusBatchAt(ctx, accountIDs, time.Now().UTC())
}

func (s *OpsService) getAccountServiceStatusBatchAt(
	ctx context.Context,
	accountIDs []int64,
	now time.Time,
) (*AccountServiceStatusBatch, error) {
	if err := s.RequireMonitoringEnabled(ctx); err != nil {
		return nil, err
	}

	ids := normalizeAccountServiceStatusIDs(accountIDs)
	windowEnd := now.UTC()
	bucketDuration := time.Duration(AccountServiceStatusBucketMinutes) * time.Minute
	currentBucket := windowEnd.Truncate(bucketDuration)
	// Keep the current, still-open minute visible as the rightmost bar. The
	// first bar is consequently the oldest complete minute in the 60-minute
	// view, while the final bar grows as new requests arrive.
	windowStart := currentBucket.Add(-time.Duration(AccountServiceStatusBucketCount-1) * bucketDuration)
	result := newEmptyAccountServiceStatusBatch(ids, windowStart, windowEnd)
	if len(ids) == 0 {
		return result, nil
	}

	repo, ok := s.opsRepo.(accountServiceStatusRepository)
	if !ok || repo == nil {
		return nil, fmt.Errorf("account service status repository is not available")
	}

	aggregates, err := repo.GetAccountServiceStatusBuckets(ctx, ids, windowStart, windowEnd)
	if err != nil {
		return nil, fmt.Errorf("get account service status buckets: %w", err)
	}

	for _, aggregate := range aggregates {
		account := result.Accounts[aggregate.AccountID]
		if account == nil {
			continue
		}
		bucketIndex := int(aggregate.BucketStart.UTC().Sub(windowStart) / bucketDuration)
		if bucketIndex < 0 || bucketIndex >= len(account.Buckets) {
			continue
		}

		bucket := &account.Buckets[bucketIndex]
		bucket.SuccessCount = aggregate.SuccessCount
		bucket.FailureCount = aggregate.FailureCount
		bucket.RequestCount = aggregate.SuccessCount + aggregate.FailureCount
		bucket.SuccessRate = serviceStatusSuccessRate(aggregate.SuccessCount, aggregate.FailureCount)
		bucket.Status = accountServiceStatusLevel(bucket.SuccessRate)
		bucket.AverageFirstTokenMs = aggregate.AverageFirstTokenMs
		bucket.AverageTokensPerSec = aggregate.AverageTokensPerSec
		bucket.LastCallAt = utcTimePointer(aggregate.LastCallAt)

		account.SuccessCount += aggregate.SuccessCount
		account.FailureCount += aggregate.FailureCount
		if aggregate.LastCallAt != nil && (account.LastCallAt == nil || aggregate.LastCallAt.After(*account.LastCallAt)) {
			account.LastCallAt = utcTimePointer(aggregate.LastCallAt)
		}
	}

	// Calculate overall timing averages in a second pass so sample counts stay exact.
	for _, account := range result.Accounts {
		account.RequestCount = account.SuccessCount + account.FailureCount
		account.SuccessRate = serviceStatusSuccessRate(account.SuccessCount, account.FailureCount)
		account.Status = accountServiceStatusLevel(account.SuccessRate)
		account.AverageFirstTokenMs = weightedAggregateAverage(aggregates, account.AccountID, true)
		account.AverageTokensPerSec = weightedAggregateAverage(aggregates, account.AccountID, false)
	}

	return result, nil
}

func newEmptyAccountServiceStatusBatch(accountIDs []int64, windowStart, windowEnd time.Time) *AccountServiceStatusBatch {
	result := &AccountServiceStatusBatch{
		Enabled:       true,
		WindowStart:   windowStart,
		WindowEnd:     windowEnd,
		BucketSeconds: AccountServiceStatusBucketMinutes * 60,
		Accounts:      make(map[int64]*AccountServiceStatus, len(accountIDs)),
	}
	for _, accountID := range accountIDs {
		bucketDuration := time.Duration(AccountServiceStatusBucketMinutes) * time.Minute
		buckets := make([]AccountServiceStatusBucket, AccountServiceStatusBucketCount)
		for index := range buckets {
			start := windowStart.Add(time.Duration(index) * bucketDuration)
			end := start.Add(bucketDuration)
			if end.After(windowEnd) {
				end = windowEnd
			}
			buckets[index] = AccountServiceStatusBucket{
				StartTime: start,
				EndTime:   end,
				Status:    AccountServiceStatusUnknown,
			}
		}
		result.Accounts[accountID] = &AccountServiceStatus{
			AccountID: accountID,
			Status:    AccountServiceStatusUnknown,
			Buckets:   buckets,
		}
	}
	return result
}

func normalizeAccountServiceStatusIDs(accountIDs []int64) []int64 {
	seen := make(map[int64]struct{}, len(accountIDs))
	ids := make([]int64, 0, len(accountIDs))
	for _, accountID := range accountIDs {
		if accountID <= 0 {
			continue
		}
		if _, exists := seen[accountID]; exists {
			continue
		}
		seen[accountID] = struct{}{}
		ids = append(ids, accountID)
	}
	sort.Slice(ids, func(i, j int) bool { return ids[i] < ids[j] })
	return ids
}

func serviceStatusSuccessRate(successCount, failureCount int64) *float64 {
	total := successCount + failureCount
	if total <= 0 {
		return nil
	}
	rate := float64(successCount) / float64(total)
	return &rate
}

func accountServiceStatusLevel(successRate *float64) string {
	if successRate == nil {
		return AccountServiceStatusUnknown
	}
	if *successRate >= 0.98 {
		return AccountServiceStatusOperational
	}
	if *successRate >= 0.80 {
		return AccountServiceStatusDegraded
	}
	return AccountServiceStatusFailed
}

func utcTimePointer(value *time.Time) *time.Time {
	if value == nil {
		return nil
	}
	utc := value.UTC()
	return &utc
}

func weightedAggregateAverage(aggregates []AccountServiceStatusBucketAggregate, accountID int64, firstToken bool) *float64 {
	var weightedSum float64
	var sampleCount int64
	for _, aggregate := range aggregates {
		if aggregate.AccountID != accountID {
			continue
		}
		average := aggregate.AverageTokensPerSec
		count := aggregate.SpeedSampleCount
		if firstToken {
			average = aggregate.AverageFirstTokenMs
			count = aggregate.FirstTokenSampleCount
		}
		if average == nil || count <= 0 {
			continue
		}
		weightedSum += *average * float64(count)
		sampleCount += count
	}
	if sampleCount == 0 {
		return nil
	}
	average := weightedSum / float64(sampleCount)
	return &average
}
