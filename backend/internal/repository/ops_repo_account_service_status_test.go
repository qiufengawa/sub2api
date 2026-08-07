package repository

import (
	"context"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/require"
)

func TestGetAccountServiceStatusBucketsScansBatchAggregates(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })

	start := time.Date(2026, time.August, 7, 1, 0, 0, 0, time.UTC)
	end := time.Date(2026, time.August, 7, 12, 30, 0, 0, time.UTC)
	bucketStart := time.Date(2026, time.August, 7, 10, 0, 0, 0, time.UTC)
	lastCall := time.Date(2026, time.August, 7, 10, 42, 0, 0, time.UTC)
	rows := sqlmock.NewRows([]string{
		"account_id", "bucket_start", "success_count", "failure_count",
		"avg_first_token_ms", "first_token_sample_count",
		"avg_tokens_per_second", "speed_sample_count", "last_call_at",
	}).
		AddRow(int64(7), bucketStart, int64(98), int64(2), 125.5, int64(90), 42.25, int64(80), lastCall).
		AddRow(int64(8), bucketStart, int64(0), int64(3), nil, int64(0), nil, int64(0), nil)

	mock.ExpectQuery(`(?s)WITH valid_failures AS .*FROM combined.*ORDER BY account_id, bucket_start`).
		WithArgs(sqlmock.AnyArg(), start, end).
		WillReturnRows(rows)

	repo := &opsRepository{db: db}
	result, err := repo.GetAccountServiceStatusBuckets(context.Background(), []int64{7, 8}, start, end)
	require.NoError(t, err)
	require.Len(t, result, 2)
	require.Equal(t, int64(7), result[0].AccountID)
	require.Equal(t, bucketStart, result[0].BucketStart)
	require.InDelta(t, 125.5, *result[0].AverageFirstTokenMs, 0.000001)
	require.InDelta(t, 42.25, *result[0].AverageTokensPerSec, 0.000001)
	require.Equal(t, lastCall, *result[0].LastCallAt)
	require.Nil(t, result[1].AverageFirstTokenMs)
	require.Nil(t, result[1].AverageTokensPerSec)
	require.Nil(t, result[1].LastCallAt)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestGetAccountServiceStatusBucketsSkipsInvalidBatch(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })
	repo := &opsRepository{db: db}
	now := time.Date(2026, time.August, 7, 12, 30, 0, 0, time.UTC)

	result, err := repo.GetAccountServiceStatusBuckets(context.Background(), nil, now.Add(-time.Hour), now)
	require.NoError(t, err)
	require.Empty(t, result)

	result, err = repo.GetAccountServiceStatusBuckets(context.Background(), []int64{1}, now, now)
	require.NoError(t, err)
	require.Empty(t, result)
	require.NoError(t, mock.ExpectationsWereMet())
}
