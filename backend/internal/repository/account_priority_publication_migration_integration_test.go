//go:build integration

package repository

import (
	"context"
	"io/fs"
	"testing"
	"testing/fstest"

	dbmigrations "github.com/Wei-Shaw/sub2api/migrations"
	"github.com/stretchr/testify/require"
)

func accountPriorityPublicationMigrationFS(t *testing.T) fstest.MapFS {
	t.Helper()
	result := migrationFSBefore(t, "201_")
	for _, name := range []string{"199_account_priority_higher_wins.sql", "200_account_priority_semantic_publication_manifest.sql"} {
		content, err := fs.ReadFile(dbmigrations.FS, name)
		require.NoError(t, err)
		result[name] = &fstest.MapFile{Data: content, Mode: 0o644}
	}
	return result
}

func TestMigration200CreatesPendingPriorityPublicationManifest(t *testing.T) {
	db := newAccountPriorityMigrationBaseline(t)
	ctx := context.Background()
	require.NoError(t, applyMigrationsFS(ctx, db, accountPriorityPublicationMigrationFS(t)))

	var status, semantics string
	var epoch, pivot int64
	var frozen bool
	require.NoError(t, db.QueryRowContext(ctx, `
		SELECT status, priority_semantics, semantic_epoch, priority_pivot, bucket_set_frozen
		FROM account_priority_semantic_publications
		WHERE migration_key=$1
	`, accountPriorityMigrationKey).Scan(&status, &semantics, &epoch, &pivot, &frozen))
	require.Equal(t, "pending", status)
	require.Equal(t, "higher_wins", semantics)
	require.Equal(t, int64(1), epoch)
	require.Equal(t, int64(0), pivot)
	require.False(t, frozen)

	var bucketCount int
	require.NoError(t, db.QueryRowContext(ctx, `SELECT COUNT(*) FROM account_priority_semantic_publication_buckets WHERE migration_key=$1`, accountPriorityMigrationKey).Scan(&bucketCount))
	require.Zero(t, bucketCount)

	require.NoError(t, applyMigrationsFS(ctx, db, accountPriorityPublicationMigrationFS(t)))
	var publicationCount int
	require.NoError(t, db.QueryRowContext(ctx, `SELECT COUNT(*) FROM account_priority_semantic_publications WHERE migration_key=$1`, accountPriorityMigrationKey).Scan(&publicationCount))
	require.Equal(t, 1, publicationCount)
}

func TestMigration200ResetsStaleSucceededPriorityPublication(t *testing.T) {
	db := newAccountPriorityMigrationBaseline(t)
	ctx := context.Background()
	require.NoError(t, applyMigrationsFS(ctx, db, accountPriorityPublicationMigrationFS(t)))

	_, err := db.ExecContext(ctx, `
		UPDATE account_priority_semantic_publications
		SET status='succeeded', bucket_set_frozen=TRUE, completed_at=NOW()
		WHERE migration_key=$1
	`, accountPriorityMigrationKey)
	require.NoError(t, err)
	_, err = db.ExecContext(ctx, `
		INSERT INTO account_priority_semantic_publication_buckets
			(migration_key, group_id, platform, mode, status)
		VALUES ($1, 0, 'openai', 'single', 'succeeded')
	`, accountPriorityMigrationKey)
	require.NoError(t, err)
	_, err = db.ExecContext(ctx, `
		UPDATE account_priority_semantic_state
		SET semantic_epoch=semantic_epoch+1, pivot=pivot+1
		WHERE id=1
	`)
	require.NoError(t, err)
	_, err = db.ExecContext(ctx, `
		UPDATE account_priority_semantic_migrations
		SET semantic_epoch=semantic_epoch+1, pivot=pivot+1
		WHERE migration_key=$1
	`, accountPriorityMigrationKey)
	require.NoError(t, err)

	content, err := fs.ReadFile(dbmigrations.FS, "200_account_priority_semantic_publication_manifest.sql")
	require.NoError(t, err)
	_, err = db.ExecContext(ctx, string(content))
	require.NoError(t, err)

	var status string
	var frozen bool
	var bucketCount int
	require.NoError(t, db.QueryRowContext(ctx, `
		SELECT status, bucket_set_frozen
		FROM account_priority_semantic_publications
		WHERE migration_key=$1
	`, accountPriorityMigrationKey).Scan(&status, &frozen))
	require.Equal(t, "pending", status)
	require.False(t, frozen)
	require.NoError(t, db.QueryRowContext(ctx, `SELECT COUNT(*) FROM account_priority_semantic_publication_buckets WHERE migration_key=$1`, accountPriorityMigrationKey).Scan(&bucketCount))
	require.Zero(t, bucketCount)
}
