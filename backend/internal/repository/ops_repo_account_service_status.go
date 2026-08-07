package repository

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/lib/pq"
)

// GetAccountServiceStatusBuckets aggregates real gateway outcomes for a page of accounts.
// The query is intentionally passive: it reads existing usage/error logs and never probes upstream.
func (r *opsRepository) GetAccountServiceStatusBuckets(
	ctx context.Context,
	accountIDs []int64,
	startTime time.Time,
	endTime time.Time,
) ([]service.AccountServiceStatusBucketAggregate, error) {
	if r == nil || r.db == nil {
		return nil, fmt.Errorf("nil ops repository")
	}
	if len(accountIDs) == 0 || !endTime.After(startTime) {
		return []service.AccountServiceStatusBucketAggregate{}, nil
	}

	const query = `
WITH valid_failures AS (
  SELECT
    oel.id,
    oel.account_id,
    oel.request_id,
    oel.created_at
  FROM ops_error_logs oel
  WHERE oel.account_id = ANY($1)
    AND oel.created_at >= $2
    AND oel.created_at < $3
    AND COALESCE(oel.status_code, 0) >= 400
    AND NOT COALESCE(oel.is_business_limited, FALSE)
    AND NOT COALESCE(oel.is_count_tokens, FALSE)
    AND oel.error_owner = 'provider'
    AND oel.error_phase IN ('upstream', 'network', 'account_auth')
    AND COALESCE(oel.error_source, '') <> 'client_request'
    AND (
      oel.error_phase = 'account_auth'
      OR COALESCE(oel.upstream_status_code, oel.status_code, 0) IN (401, 403, 408, 409, 425, 429)
      OR COALESCE(oel.upstream_status_code, oel.status_code, 0) >= 500
    )
    AND LOWER(COALESCE(oel.error_message, '')) NOT LIKE '%context canceled%'
    AND LOWER(COALESCE(oel.error_body, '')) NOT LIKE '%context canceled%'
    AND COALESCE(oel.request_path, '') !~ '^/api/v1/admin/accounts/[0-9]+/test($|/)'
),
successful AS (
  SELECT
    ul.account_id,
    date_trunc('hour', ul.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AS bucket_start,
    COUNT(*)::bigint AS success_count,
    AVG(ul.first_token_ms) FILTER (WHERE ul.first_token_ms IS NOT NULL AND ul.first_token_ms >= 0)::float8 AS avg_first_token_ms,
    COUNT(ul.first_token_ms) FILTER (WHERE ul.first_token_ms >= 0)::bigint AS first_token_sample_count,
    AVG(ul.output_tokens * 1000.0 / ul.duration_ms)
      FILTER (WHERE ul.output_tokens > 0 AND ul.duration_ms > 0)::float8 AS avg_tokens_per_second,
    COUNT(*) FILTER (WHERE ul.output_tokens > 0 AND ul.duration_ms > 0)::bigint AS speed_sample_count,
    MAX(ul.created_at) AS last_call_at
  FROM usage_logs ul
  WHERE ul.account_id = ANY($1)
    AND ul.created_at >= $2
    AND ul.created_at < $3
    AND COALESCE(ul.request_type, 0) <> 4
    AND NOT EXISTS (
      SELECT 1
      FROM valid_failures vf
      WHERE vf.account_id = ul.account_id
        AND NULLIF(vf.request_id, '') IS NOT NULL
        AND vf.request_id = ul.request_id
    )
  GROUP BY ul.account_id, bucket_start
),
failed AS (
  SELECT
    vf.account_id,
    date_trunc('hour', vf.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AS bucket_start,
    COUNT(DISTINCT COALESCE(NULLIF(vf.request_id, ''), 'ops:' || vf.id::text))::bigint AS failure_count,
    MAX(vf.created_at) AS last_call_at
  FROM valid_failures vf
  GROUP BY vf.account_id, bucket_start
),
combined AS (
  SELECT
    s.account_id,
    s.bucket_start,
    s.success_count,
    0::bigint AS failure_count,
    s.avg_first_token_ms,
    s.first_token_sample_count,
    s.avg_tokens_per_second,
    s.speed_sample_count,
    s.last_call_at
  FROM successful s
  UNION ALL
  SELECT
    f.account_id,
    f.bucket_start,
    0::bigint AS success_count,
    f.failure_count,
    NULL::float8 AS avg_first_token_ms,
    0::bigint AS first_token_sample_count,
    NULL::float8 AS avg_tokens_per_second,
    0::bigint AS speed_sample_count,
    f.last_call_at
  FROM failed f
)
SELECT
  account_id,
  bucket_start,
  SUM(success_count)::bigint AS success_count,
  SUM(failure_count)::bigint AS failure_count,
  CASE WHEN SUM(first_token_sample_count) > 0
    THEN SUM(avg_first_token_ms * first_token_sample_count) / SUM(first_token_sample_count)
  END::float8 AS avg_first_token_ms,
  SUM(first_token_sample_count)::bigint AS first_token_sample_count,
  CASE WHEN SUM(speed_sample_count) > 0
    THEN SUM(avg_tokens_per_second * speed_sample_count) / SUM(speed_sample_count)
  END::float8 AS avg_tokens_per_second,
  SUM(speed_sample_count)::bigint AS speed_sample_count,
  MAX(last_call_at) AS last_call_at
FROM combined
GROUP BY account_id, bucket_start
ORDER BY account_id, bucket_start
`

	rows, err := r.db.QueryContext(ctx, query, pq.Array(accountIDs), startTime.UTC(), endTime.UTC())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]service.AccountServiceStatusBucketAggregate, 0, len(accountIDs))
	for rows.Next() {
		var item service.AccountServiceStatusBucketAggregate
		var averageFirstToken sql.NullFloat64
		var averageTokensPerSecond sql.NullFloat64
		var lastCallAt sql.NullTime
		if err := rows.Scan(
			&item.AccountID,
			&item.BucketStart,
			&item.SuccessCount,
			&item.FailureCount,
			&averageFirstToken,
			&item.FirstTokenSampleCount,
			&averageTokensPerSecond,
			&item.SpeedSampleCount,
			&lastCallAt,
		); err != nil {
			return nil, err
		}
		item.BucketStart = item.BucketStart.UTC()
		if averageFirstToken.Valid {
			value := averageFirstToken.Float64
			item.AverageFirstTokenMs = &value
		}
		if averageTokensPerSecond.Valid {
			value := averageTokensPerSecond.Float64
			item.AverageTokensPerSec = &value
		}
		if lastCallAt.Valid {
			value := lastCallAt.Time.UTC()
			item.LastCallAt = &value
		}
		result = append(result, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return result, nil
}
