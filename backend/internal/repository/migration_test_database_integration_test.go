//go:build integration

package repository

import (
	"context"
	"database/sql"
	"io/fs"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"
	"testing/fstest"
	"time"

	dbmigrations "github.com/Wei-Shaw/sub2api/migrations"
	"github.com/lib/pq"
	"github.com/stretchr/testify/require"
)

var migrationTestDatabaseSequence uint64

func newIsolatedPostgresDatabase(t *testing.T) *sql.DB {
	t.Helper()
	require.NotEmpty(t, integrationPostgresDSN, "integration postgres DSN")

	sequence := atomic.AddUint64(&migrationTestDatabaseSequence, 1)
	name := "qiu_priority_migration_" + time.Now().UTC().Format("20060102150405") + "_" +
		strconv.FormatUint(sequence, 10)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	_, err := integrationDB.ExecContext(ctx, "CREATE DATABASE "+pq.QuoteIdentifier(name))
	require.NoError(t, err)

	parsed, err := url.Parse(integrationPostgresDSN)
	require.NoError(t, err)
	require.NotEmpty(t, parsed.Scheme, "integration postgres DSN must be a URL")
	parsed.Path = "/" + name
	db, err := openSQLWithRetry(ctx, parsed.String(), 30*time.Second)
	require.NoError(t, err)

	t.Cleanup(func() {
		_ = db.Close()
		cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cleanupCancel()
		_, _ = integrationDB.ExecContext(cleanupCtx, "DROP DATABASE IF EXISTS "+pq.QuoteIdentifier(name)+" WITH (FORCE)")
	})
	return db
}

func migrationFSBefore(t *testing.T, exclusiveName string) fstest.MapFS {
	t.Helper()
	entries, err := fs.ReadDir(dbmigrations.FS, ".")
	require.NoError(t, err)

	result := make(fstest.MapFS)
	for _, entry := range entries {
		name := entry.Name()
		if entry.IsDir() || !strings.HasSuffix(name, ".sql") || name >= exclusiveName {
			continue
		}
		content, readErr := fs.ReadFile(dbmigrations.FS, name)
		require.NoError(t, readErr)
		result[name] = &fstest.MapFile{Data: content, Mode: 0o644}
	}
	return result
}

func newAccountPriorityMigrationBaseline(t *testing.T) *sql.DB {
	t.Helper()
	db := newIsolatedPostgresDatabase(t)
	require.NoError(t, applyMigrationsFS(
		context.Background(),
		db,
		migrationFSBefore(t, "199_account_priority_higher_wins.sql"),
	))
	return db
}

func readAccountPriorityMigrationSQL(t *testing.T) string {
	t.Helper()
	content, err := fs.ReadFile(dbmigrations.FS, "199_account_priority_higher_wins.sql")
	require.NoError(t, err)
	return string(content)
}

func readAccountPriorityRollbackSQL(t *testing.T) string {
	t.Helper()
	_, sourceFile, _, ok := runtime.Caller(0)
	require.True(t, ok, "resolve migration test source path")
	path := filepath.Join(filepath.Dir(sourceFile), "..", "..", "migrations", "manual", "rollback_199_account_priority_higher_wins.sql")
	content, err := os.ReadFile(path)
	require.NoError(t, err)
	return string(content)
}

func accountPriorityRollbackBody(t *testing.T) string {
	t.Helper()
	rollbackSQL := strings.TrimSpace(readAccountPriorityRollbackSQL(t))
	beginIndex := strings.Index(rollbackSQL, "BEGIN;")
	require.GreaterOrEqual(t, beginIndex, 0)
	rollbackSQL = strings.TrimSpace(rollbackSQL[beginIndex+len("BEGIN;"):])
	require.True(t, strings.HasSuffix(rollbackSQL, "COMMIT;"))
	return strings.TrimSpace(strings.TrimSuffix(rollbackSQL, "COMMIT;"))
}
