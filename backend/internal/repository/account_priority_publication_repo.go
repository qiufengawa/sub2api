package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/service"
)

type accountPriorityPublicationRepository struct {
	db     *sql.DB
	mu     sync.Mutex
	leases map[string]*sql.Conn
}

func NewAccountPriorityPublicationRepository(db *sql.DB) service.AccountPriorityPublicationRepository {
	return &accountPriorityPublicationRepository{db: db, leases: make(map[string]*sql.Conn)}
}

func (r *accountPriorityPublicationRepository) Claim(ctx context.Context, migrationKey string) (*service.AccountPriorityPublication, bool, error) {
	r.mu.Lock()
	if _, exists := r.leases[migrationKey]; exists {
		r.mu.Unlock()
		return nil, false, nil
	}
	r.mu.Unlock()

	conn, err := r.db.Conn(ctx)
	if err != nil {
		return nil, false, err
	}
	release := true
	defer func() {
		if release {
			_, _ = conn.ExecContext(context.Background(), `SELECT pg_advisory_unlock(hashtextextended('account_priority_publication:' || $1, 0))`, migrationKey)
			_ = conn.Close()
		}
	}()
	var locked bool
	if err := conn.QueryRowContext(ctx, `SELECT pg_try_advisory_lock(hashtextextended('account_priority_publication:' || $1, 0))`, migrationKey).Scan(&locked); err != nil {
		return nil, false, err
	}
	if !locked {
		return nil, false, nil
	}
	tx, err := conn.BeginTx(ctx, nil)
	if err != nil {
		return nil, false, err
	}
	defer func() { _ = tx.Rollback() }()
	publication := &service.AccountPriorityPublication{MigrationKey: migrationKey}
	var nextRetry sql.NullTime
	err = tx.QueryRowContext(ctx, `
		SELECT semantic_epoch, priority_semantics, priority_pivot, bucket_set_frozen, status, next_retry_at
		FROM account_priority_semantic_publications
		WHERE migration_key = $1
		FOR UPDATE
	`, migrationKey).Scan(&publication.SemanticEpoch, &publication.PrioritySemantics, &publication.PriorityPivot, &publication.BucketSetFrozen, &publication.Status, &nextRetry)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, err
	}
	if nextRetry.Valid && nextRetry.Time.After(time.Now()) {
		return nil, false, nil
	}
	if publication.Status != "succeeded" {
		if _, err := tx.ExecContext(ctx, `
		UPDATE account_priority_semantic_publications
		SET status = 'running', attempts = attempts + 1, started_at = COALESCE(started_at, NOW()), updated_at = NOW()
		WHERE migration_key = $1
	`, migrationKey); err != nil {
			return nil, false, err
		}
	}
	if err := tx.Commit(); err != nil {
		return nil, false, err
	}
	r.mu.Lock()
	if _, exists := r.leases[migrationKey]; exists {
		r.mu.Unlock()
		return nil, false, nil
	}
	r.leases[migrationKey] = conn
	r.mu.Unlock()
	release = false
	return publication, true, nil
}

func (r *accountPriorityPublicationRepository) ReleaseClaim(ctx context.Context, migrationKey string) error {
	r.mu.Lock()
	conn := r.leases[migrationKey]
	delete(r.leases, migrationKey)
	r.mu.Unlock()
	if conn == nil {
		return nil
	}
	var unlocked bool
	err := conn.QueryRowContext(ctx, `SELECT pg_advisory_unlock(hashtextextended('account_priority_publication:' || $1, 0))`, migrationKey).Scan(&unlocked)
	closeErr := conn.Close()
	if err != nil {
		return errors.Join(err, closeErr)
	}
	if !unlocked {
		return errors.Join(fmt.Errorf("account priority publication lease was not held: %s", migrationKey), closeErr)
	}
	return closeErr
}

func (r *accountPriorityPublicationRepository) FreezeBuckets(ctx context.Context, migrationKey string, buckets []service.SchedulerBucket) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	var frozen bool
	if err := tx.QueryRowContext(ctx, `SELECT bucket_set_frozen FROM account_priority_semantic_publications WHERE migration_key=$1 FOR UPDATE`, migrationKey).Scan(&frozen); err != nil {
		return err
	}
	if frozen {
		return tx.Commit()
	}
	for _, bucket := range buckets {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO account_priority_semantic_publication_buckets (migration_key, group_id, platform, mode)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (migration_key, group_id, platform, mode) DO NOTHING
		`, migrationKey, bucket.GroupID, bucket.Platform, bucket.Mode); err != nil {
			return err
		}
	}
	if _, err := tx.ExecContext(ctx, `UPDATE account_priority_semantic_publications SET bucket_set_frozen=TRUE, updated_at=NOW() WHERE migration_key=$1`, migrationKey); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *accountPriorityPublicationRepository) ListRetryableBuckets(ctx context.Context, migrationKey string, now time.Time) ([]service.AccountPriorityPublicationBucket, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT group_id, platform, mode, attempts
		FROM account_priority_semantic_publication_buckets
		WHERE migration_key=$1
		  AND status IN ('pending', 'failed')
		  AND (next_retry_at IS NULL OR next_retry_at <= $2)
		ORDER BY group_id ASC, platform ASC, mode ASC
	`, migrationKey, now)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	var result []service.AccountPriorityPublicationBucket
	for rows.Next() {
		var entry service.AccountPriorityPublicationBucket
		if err := rows.Scan(&entry.Bucket.GroupID, &entry.Bucket.Platform, &entry.Bucket.Mode, &entry.Attempts); err != nil {
			return nil, err
		}
		result = append(result, entry)
	}
	return result, rows.Err()
}

func (r *accountPriorityPublicationRepository) ListBuckets(ctx context.Context, migrationKey string) ([]service.AccountPriorityPublicationBucket, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT group_id, platform, mode, attempts
		FROM account_priority_semantic_publication_buckets
		WHERE migration_key=$1
		ORDER BY group_id ASC, platform ASC, mode ASC
	`, migrationKey)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	var result []service.AccountPriorityPublicationBucket
	for rows.Next() {
		var entry service.AccountPriorityPublicationBucket
		if err := rows.Scan(&entry.Bucket.GroupID, &entry.Bucket.Platform, &entry.Bucket.Mode, &entry.Attempts); err != nil {
			return nil, err
		}
		result = append(result, entry)
	}
	return result, rows.Err()
}

func (r *accountPriorityPublicationRepository) MarkBucketSucceeded(ctx context.Context, migrationKey string, bucket service.SchedulerBucket) error {
	result, err := r.db.ExecContext(ctx, `
		UPDATE account_priority_semantic_publication_buckets
		SET status='succeeded', attempts=attempts+1, next_retry_at=NULL, last_error='', completed_at=NOW(), updated_at=NOW()
		WHERE migration_key=$1 AND group_id=$2 AND platform=$3 AND mode=$4 AND status <> 'succeeded'
	`, migrationKey, bucket.GroupID, bucket.Platform, bucket.Mode)
	if err != nil {
		return err
	}
	return requirePublicationBucketUpdate(result, migrationKey, bucket, true)
}

func (r *accountPriorityPublicationRepository) MarkBucketFailed(ctx context.Context, migrationKey string, bucket service.SchedulerBucket, nextRetry time.Time, failure string) error {
	result, err := r.db.ExecContext(ctx, `
		UPDATE account_priority_semantic_publication_buckets
		SET status='failed', attempts=attempts+1, next_retry_at=$5, last_error=$6, updated_at=NOW()
		WHERE migration_key=$1 AND group_id=$2 AND platform=$3 AND mode=$4 AND status <> 'succeeded'
	`, migrationKey, bucket.GroupID, bucket.Platform, bucket.Mode, nextRetry, failure)
	if err != nil {
		return err
	}
	return requirePublicationBucketUpdate(result, migrationKey, bucket, false)
}

func requirePublicationBucketUpdate(result sql.Result, migrationKey string, bucket service.SchedulerBucket, allowAlreadySucceeded bool) error {
	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 1 {
		return nil
	}
	if allowAlreadySucceeded {
		return nil
	}
	return fmt.Errorf("account priority publication bucket not updateable: migration=%s bucket=%s", migrationKey, bucket.String())
}

func (r *accountPriorityPublicationRepository) CompleteIfReady(ctx context.Context, migrationKey string) (bool, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return false, err
	}
	defer func() { _ = tx.Rollback() }()
	var frozen bool
	if err := tx.QueryRowContext(ctx, `SELECT bucket_set_frozen FROM account_priority_semantic_publications WHERE migration_key=$1 FOR UPDATE`, migrationKey).Scan(&frozen); err != nil {
		return false, err
	}
	if !frozen {
		return false, nil
	}
	var remaining int
	if err := tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM account_priority_semantic_publication_buckets WHERE migration_key=$1 AND status <> 'succeeded'`, migrationKey).Scan(&remaining); err != nil {
		return false, err
	}
	if remaining != 0 {
		if _, err := tx.ExecContext(ctx, `UPDATE account_priority_semantic_publications SET status='failed', updated_at=NOW() WHERE migration_key=$1`, migrationKey); err != nil {
			return false, err
		}
		return false, tx.Commit()
	}
	if _, err := tx.ExecContext(ctx, `UPDATE account_priority_semantic_publications SET status='succeeded', next_retry_at=NULL, last_error='', completed_at=NOW(), updated_at=NOW() WHERE migration_key=$1`, migrationKey); err != nil {
		return false, err
	}
	return true, tx.Commit()
}

func (r *accountPriorityPublicationRepository) MarkFailed(ctx context.Context, migrationKey string, nextRetry time.Time, failure string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE account_priority_semantic_publications SET status='failed', next_retry_at=$2, last_error=$3, updated_at=NOW() WHERE migration_key=$1`, migrationKey, nextRetry, failure)
	return err
}
