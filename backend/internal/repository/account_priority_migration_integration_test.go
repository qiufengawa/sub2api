//go:build integration

package repository

import (
	"context"
	"database/sql"
	"sort"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

const accountPriorityMigrationKey = "account_priority_higher_wins_v1"

func insertPriorityAccount(t *testing.T, exec interface {
	QueryRowContext(context.Context, string, ...any) *sql.Row
}, name string, priority int, updatedAt time.Time) int64 {
	t.Helper()
	var id int64
	require.NoError(t, exec.QueryRowContext(context.Background(), `
INSERT INTO accounts (name, platform, type, priority, updated_at)
VALUES ($1, 'openai', 'oauth', $2, $3)
RETURNING id
`, name, priority, updatedAt).Scan(&id))
	return id
}

func readPriorityOrder(t *testing.T, query interface {
	QueryContext(context.Context, string, ...any) (*sql.Rows, error)
}, order string) []int64 {
	t.Helper()
	rows, err := query.QueryContext(context.Background(), "SELECT id FROM accounts ORDER BY "+order)
	require.NoError(t, err)
	defer rows.Close()

	var result []int64
	for rows.Next() {
		var id int64
		require.NoError(t, rows.Scan(&id))
		result = append(result, id)
	}
	require.NoError(t, rows.Err())
	return result
}

func TestMigration199AccountPriorityHigherWins(t *testing.T) {
	db := newAccountPriorityMigrationBaseline(t)
	forwardSQL := readAccountPriorityMigrationSQL(t)
	ctx := context.Background()

	t.Run("dynamic pivot preserves effective ordering and group priority", func(t *testing.T) {
		tx, err := db.BeginTx(ctx, nil)
		require.NoError(t, err)
		defer tx.Rollback()

		updatedAt := time.Date(2026, time.August, 12, 3, 4, 5, 123456000, time.UTC)
		ids := []int64{
			insertPriorityAccount(t, tx, "priority-7", 7, updatedAt),
			insertPriorityAccount(t, tx, "priority-42", 42, updatedAt.Add(time.Second)),
			insertPriorityAccount(t, tx, "priority-900", 900, updatedAt.Add(2*time.Second)),
		}
		var groupID int64
		require.NoError(t, tx.QueryRowContext(ctx, `
INSERT INTO groups (name) VALUES ('priority-migration-group') RETURNING id
`).Scan(&groupID))
		_, err = tx.ExecContext(ctx, `
INSERT INTO account_groups (account_id, group_id, priority) VALUES ($1, $2, 17)
`, ids[0], groupID)
		require.NoError(t, err)

		oldOrder := readPriorityOrder(t, tx, "priority ASC, id ASC")
		_, err = tx.ExecContext(ctx, forwardSQL)
		require.NoError(t, err)
		require.Equal(t, oldOrder, readPriorityOrder(t, tx, "priority DESC, id ASC"))

		expected := map[int64]int{ids[0]: 893, ids[1]: 858, ids[2]: 0}
		for id, priority := range expected {
			var actual int
			require.NoError(t, tx.QueryRowContext(ctx, "SELECT priority FROM accounts WHERE id = $1", id).Scan(&actual))
			require.Equal(t, priority, actual)
		}

		var pivot, epoch, migrated, backupCount int64
		var semantics string
		require.NoError(t, tx.QueryRowContext(ctx, `
SELECT pivot, semantic_epoch, migrated_accounts, backup_count, priority_semantics
FROM account_priority_semantic_migrations
WHERE migration_key = $1
`, accountPriorityMigrationKey).Scan(&pivot, &epoch, &migrated, &backupCount, &semantics))
		require.Equal(t, int64(900), pivot)
		require.Equal(t, int64(1), epoch)
		require.Equal(t, int64(3), migrated)
		require.Equal(t, int64(3), backupCount)
		require.Equal(t, "higher_wins", semantics)

		var groupPriority int
		require.NoError(t, tx.QueryRowContext(ctx, `
SELECT priority FROM account_groups WHERE account_id = $1 AND group_id = $2
`, ids[0], groupID).Scan(&groupPriority))
		require.Equal(t, 17, groupPriority)

		var outboxCount int
		require.NoError(t, tx.QueryRowContext(ctx, `
SELECT COUNT(*) FROM scheduler_outbox
WHERE event_type = 'full_rebuild'
  AND payload->>'migration_key' = $1
`, accountPriorityMigrationKey).Scan(&outboxCount))
		require.Equal(t, 1, outboxCount)

		var publicationStatus, publicationSemantics string
		var publicationEpoch, publicationPivot int64
		require.NoError(t, tx.QueryRowContext(ctx, `
SELECT status, priority_semantics, semantic_epoch, priority_pivot
FROM account_priority_semantic_publications
WHERE migration_key = $1
`, accountPriorityMigrationKey).Scan(&publicationStatus, &publicationSemantics, &publicationEpoch, &publicationPivot))
		require.Equal(t, "pending", publicationStatus)
		require.Equal(t, "higher_wins", publicationSemantics)
		require.Equal(t, epoch, publicationEpoch)
		require.Equal(t, pivot, publicationPivot)
	})

	t.Run("empty account table records a valid zero pivot", func(t *testing.T) {
		tx, err := db.BeginTx(ctx, nil)
		require.NoError(t, err)
		defer tx.Rollback()

		_, err = tx.ExecContext(ctx, forwardSQL)
		require.NoError(t, err)
		var pivot, migrated, backupCount int64
		require.NoError(t, tx.QueryRowContext(ctx, `
SELECT pivot, migrated_accounts, backup_count
FROM account_priority_semantic_migrations
WHERE migration_key = $1
`, accountPriorityMigrationKey).Scan(&pivot, &migrated, &backupCount))
		require.Zero(t, pivot)
		require.Zero(t, migrated)
		require.Zero(t, backupCount)
	})

	t.Run("all equal priorities become zero with stable id order", func(t *testing.T) {
		tx, err := db.BeginTx(ctx, nil)
		require.NoError(t, err)
		defer tx.Rollback()

		now := time.Now().UTC()
		insertPriorityAccount(t, tx, "equal-a", 73, now)
		insertPriorityAccount(t, tx, "equal-b", 73, now)
		insertPriorityAccount(t, tx, "equal-c", 73, now)
		oldOrder := readPriorityOrder(t, tx, "priority ASC, id ASC")

		_, err = tx.ExecContext(ctx, forwardSQL)
		require.NoError(t, err)
		require.Equal(t, oldOrder, readPriorityOrder(t, tx, "priority DESC, id ASC"))
		var nonZero int
		require.NoError(t, tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM accounts WHERE priority <> 0").Scan(&nonZero))
		require.Zero(t, nonZero)
	})

	t.Run("negative legacy value fails atomically", func(t *testing.T) {
		tx, err := db.BeginTx(ctx, nil)
		require.NoError(t, err)
		insertPriorityAccount(t, tx, "negative", -1, time.Now().UTC())
		_, err = tx.ExecContext(ctx, forwardSQL)
		require.ErrorContains(t, err, "negative legacy value")
		require.NoError(t, tx.Rollback())

		var migrationTable sql.NullString
		require.NoError(t, db.QueryRowContext(ctx, "SELECT to_regclass('public.account_priority_semantic_migrations')::text").Scan(&migrationTable))
		require.False(t, migrationTable.Valid)
	})

	t.Run("direct reexecution does not reflect values twice", func(t *testing.T) {
		tx, err := db.BeginTx(ctx, nil)
		require.NoError(t, err)
		defer tx.Rollback()

		id := insertPriorityAccount(t, tx, "rerun", 9, time.Now().UTC())
		insertPriorityAccount(t, tx, "pivot", 50, time.Now().UTC())
		_, err = tx.ExecContext(ctx, forwardSQL)
		require.NoError(t, err)
		var first int
		require.NoError(t, tx.QueryRowContext(ctx, "SELECT priority FROM accounts WHERE id = $1", id).Scan(&first))
		require.Equal(t, 41, first)

		_, err = tx.ExecContext(ctx, forwardSQL)
		require.NoError(t, err)
		var second int
		require.NoError(t, tx.QueryRowContext(ctx, "SELECT priority FROM accounts WHERE id = $1", id).Scan(&second))
		require.Equal(t, first, second)

		var migrationRows, backupRows int
		require.NoError(t, tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM account_priority_semantic_migrations").Scan(&migrationRows))
		require.NoError(t, tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM account_priority_semantic_migration_backup").Scan(&backupRows))
		require.Equal(t, 1, migrationRows)
		require.Equal(t, 2, backupRows)
	})

	t.Run("reexecution rejects inconsistent semantic state", func(t *testing.T) {
		tx, err := db.BeginTx(ctx, nil)
		require.NoError(t, err)
		defer tx.Rollback()

		insertPriorityAccount(t, tx, "state-tamper", 1, time.Now().UTC())
		_, err = tx.ExecContext(ctx, forwardSQL)
		require.NoError(t, err)
		_, err = tx.ExecContext(ctx, "DELETE FROM account_priority_semantic_state")
		require.NoError(t, err)
		_, err = tx.ExecContext(ctx, forwardSQL)
		require.ErrorContains(t, err, "semantic state is missing or inconsistent")
	})

	t.Run("reexecution rejects missing publication manifest", func(t *testing.T) {
		tx, err := db.BeginTx(ctx, nil)
		require.NoError(t, err)
		defer tx.Rollback()

		insertPriorityAccount(t, tx, "publication-tamper", 1, time.Now().UTC())
		_, err = tx.ExecContext(ctx, forwardSQL)
		require.NoError(t, err)
		_, err = tx.ExecContext(ctx, "DELETE FROM account_priority_semantic_publications")
		require.NoError(t, err)
		_, err = tx.ExecContext(ctx, forwardSQL)
		require.ErrorContains(t, err, "publication manifest is missing or inconsistent")
	})
}

func TestApplySetupMigrationsPrioritySafety(t *testing.T) {
	t.Run("pristine database completes higher wins setup", func(t *testing.T) {
		db := newIsolatedPostgresDatabase(t)
		ctx := context.Background()
		require.NoError(t, ApplySetupMigrations(ctx, db))

		var applied, markerExists bool
		require.NoError(t, db.QueryRowContext(ctx, `
			SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE filename=$1),
			       to_regclass('public.sub2api_setup_bootstrap_marker') IS NOT NULL
		`, accountPrioritySemanticMigrationFilename).Scan(&applied, &markerExists))
		require.True(t, applied)
		require.False(t, markerExists)
		require.NoError(t, ValidateAccountPrioritySemanticState(ctx, db))
	})

	t.Run("legacy database requires explicit maintenance without applying migration", func(t *testing.T) {
		db := newAccountPriorityMigrationBaseline(t)
		ctx := context.Background()
		_, err := db.ExecContext(ctx, `INSERT INTO accounts (name, platform, type, status, schedulable, priority, concurrency, load_factor, created_at, updated_at)
			VALUES ('legacy-setup-guard', 'openai', 'oauth', 'active', TRUE, 37, 1, 1, NOW(), NOW())`)
		require.NoError(t, err)

		err = ApplySetupMigrations(ctx, db)
		require.ErrorIs(t, err, ErrAccountPriorityMaintenanceRequired)

		var afterPriority int
		var applied bool
		require.NoError(t, db.QueryRowContext(ctx, `SELECT priority FROM accounts WHERE name='legacy-setup-guard'`).Scan(&afterPriority))
		require.NoError(t, db.QueryRowContext(ctx, `SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE filename=$1)`, accountPrioritySemanticMigrationFilename).Scan(&applied))
		require.Equal(t, 37, afterPriority)
		require.False(t, applied)
	})
}

func TestMigration199RollbackRejectsInconsistentState(t *testing.T) {
	db := newAccountPriorityMigrationBaseline(t)
	forwardSQL := readAccountPriorityMigrationSQL(t)
	rollbackBody := accountPriorityRollbackBody(t)
	ctx := context.Background()

	tests := []struct {
		name   string
		tamper func(t *testing.T, tx *sql.Tx, accountID int64)
		match  string
	}{
		{
			name: "semantic state removed",
			tamper: func(t *testing.T, tx *sql.Tx, _ int64) {
				_, err := tx.ExecContext(ctx, "DELETE FROM account_priority_semantic_state")
				require.NoError(t, err)
			},
			match: "semantic state is missing or inconsistent",
		},
		{
			name: "backup row removed",
			tamper: func(t *testing.T, tx *sql.Tx, accountID int64) {
				_, err := tx.ExecContext(ctx, `
DELETE FROM account_priority_semantic_migration_backup
WHERE migration_key = $1 AND account_id = $2
`, accountPriorityMigrationKey, accountID)
				require.NoError(t, err)
			},
			match: "backup integrity check failed",
		},
		{
			name: "live priority changed after migration",
			tamper: func(t *testing.T, tx *sql.Tx, accountID int64) {
				_, err := tx.ExecContext(ctx, "UPDATE accounts SET priority = priority + 1 WHERE id = $1", accountID)
				require.NoError(t, err)
			},
			match: "priorities changed after migration",
		},
		{
			name: "captured account deleted",
			tamper: func(t *testing.T, tx *sql.Tx, accountID int64) {
				_, err := tx.ExecContext(ctx, "DELETE FROM accounts WHERE id = $1", accountID)
				require.NoError(t, err)
			},
			match: "account set differs",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tx, err := db.BeginTx(ctx, nil)
			require.NoError(t, err)
			defer tx.Rollback()

			accountID := insertPriorityAccount(t, tx, "rollback-block", 10, time.Now().UTC())
			insertPriorityAccount(t, tx, "rollback-pivot", 50, time.Now().UTC())
			_, err = tx.ExecContext(ctx, forwardSQL)
			require.NoError(t, err)
			tt.tamper(t, tx, accountID)
			_, err = tx.ExecContext(ctx, rollbackBody)
			require.ErrorContains(t, err, tt.match)
		})
	}
}

func TestMigration199ManualRollbackRestoresExactState(t *testing.T) {
	db := newAccountPriorityMigrationBaseline(t)
	forwardSQL := readAccountPriorityMigrationSQL(t)
	rollbackSQL := readAccountPriorityRollbackSQL(t)
	ctx := context.Background()

	conn, err := db.Conn(ctx)
	require.NoError(t, err)
	defer conn.Close()

	_, err = conn.ExecContext(ctx, `
ALTER TABLE accounts ALTER COLUMN priority SET DEFAULT 73;
COMMENT ON COLUMN accounts.priority IS 'Legacy lower-wins account priority';
ALTER TABLE accounts ADD CONSTRAINT accounts_priority_legacy_range CHECK (priority BETWEEN 0 AND 1000);
ALTER TABLE accounts ADD CONSTRAINT accounts_priority_legacy_not_valid CHECK (priority <> 777) NOT VALID;
ALTER TABLE accounts ADD CONSTRAINT accounts_extra_priority_marker CHECK (NOT (extra ? 'priority')) NOT VALID;
`)
	require.NoError(t, err)

	firstUpdatedAt := time.Date(2026, time.August, 12, 1, 2, 3, 456789000, time.FixedZone("UTC+14", 14*60*60))
	secondUpdatedAt := time.Date(2026, time.August, 11, 5, 6, 7, 123456000, time.FixedZone("UTC-7", -7*60*60))
	firstID := insertPriorityAccount(t, conn, "rollback-first", 7, firstUpdatedAt)
	secondID := insertPriorityAccount(t, conn, "rollback-second", 900, secondUpdatedAt)

	var groupID int64
	require.NoError(t, conn.QueryRowContext(ctx, `
INSERT INTO groups (name) VALUES ('rollback-priority-group') RETURNING id
`).Scan(&groupID))
	_, err = conn.ExecContext(ctx, `
INSERT INTO account_groups (account_id, group_id, priority, created_at)
VALUES ($1, $2, 19, '2026-08-12T00:00:00Z')
`, firstID, groupID)
	require.NoError(t, err)

	_, err = conn.ExecContext(ctx, "SET TIME ZONE 'Pacific/Kiritimati'")
	require.NoError(t, err)
	_, err = conn.ExecContext(ctx, forwardSQL)
	require.NoError(t, err)

	var unrelatedConstraintCount int
	require.NoError(t, conn.QueryRowContext(ctx, `
SELECT COUNT(*) FROM pg_constraint
WHERE conrelid = 'accounts'::regclass AND conname = 'accounts_extra_priority_marker'
`).Scan(&unrelatedConstraintCount))
	require.Equal(t, 1, unrelatedConstraintCount)

	_, err = conn.ExecContext(ctx, "SET TIME ZONE 'America/Los_Angeles'")
	require.NoError(t, err)
	_, err = conn.ExecContext(ctx, rollbackSQL)
	require.NoError(t, err)

	priorities := map[int64]int{}
	rows, err := conn.QueryContext(ctx, "SELECT id, priority FROM accounts ORDER BY id")
	require.NoError(t, err)
	for rows.Next() {
		var id int64
		var priority int
		require.NoError(t, rows.Scan(&id, &priority))
		priorities[id] = priority
	}
	require.NoError(t, rows.Close())
	require.Equal(t, 7, priorities[firstID])
	require.Equal(t, 900, priorities[secondID])

	var restoredFirst, restoredSecond time.Time
	require.NoError(t, conn.QueryRowContext(ctx, "SELECT updated_at FROM accounts WHERE id = $1", firstID).Scan(&restoredFirst))
	require.NoError(t, conn.QueryRowContext(ctx, "SELECT updated_at FROM accounts WHERE id = $1", secondID).Scan(&restoredSecond))
	require.True(t, restoredFirst.Equal(firstUpdatedAt), "first updated_at must be restored exactly")
	require.True(t, restoredSecond.Equal(secondUpdatedAt), "second updated_at must be restored exactly")

	var defaultExpression, comment string
	require.NoError(t, conn.QueryRowContext(ctx, `
SELECT pg_get_expr(ad.adbin, ad.adrelid), col_description(a.attrelid, a.attnum)
FROM pg_attribute a
JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
WHERE a.attrelid = 'accounts'::regclass AND a.attname = 'priority'
`).Scan(&defaultExpression, &comment))
	require.Equal(t, "73", defaultExpression)
	require.Equal(t, "Legacy lower-wins account priority", comment)

	type constraintState struct {
		name      string
		validated bool
	}
	var constraints []constraintState
	constraintRows, err := conn.QueryContext(ctx, `
SELECT conname, convalidated
FROM pg_constraint
WHERE conrelid = 'accounts'::regclass
  AND conname IN (
      'accounts_priority_legacy_range',
      'accounts_priority_legacy_not_valid',
      'accounts_extra_priority_marker'
  )
ORDER BY conname
`)
	require.NoError(t, err)
	for constraintRows.Next() {
		var state constraintState
		require.NoError(t, constraintRows.Scan(&state.name, &state.validated))
		constraints = append(constraints, state)
	}
	require.NoError(t, constraintRows.Close())
	sort.Slice(constraints, func(i, j int) bool { return constraints[i].name < constraints[j].name })
	require.Equal(t, []constraintState{
		{name: "accounts_extra_priority_marker", validated: false},
		{name: "accounts_priority_legacy_not_valid", validated: false},
		{name: "accounts_priority_legacy_range", validated: true},
	}, constraints)

	var groupPriority int
	var groupCreatedAt time.Time
	require.NoError(t, conn.QueryRowContext(ctx, `
SELECT priority, created_at FROM account_groups WHERE account_id = $1 AND group_id = $2
`, firstID, groupID).Scan(&groupPriority, &groupCreatedAt))
	require.Equal(t, 19, groupPriority)
	require.True(t, groupCreatedAt.Equal(time.Date(2026, time.August, 12, 0, 0, 0, 0, time.UTC)))

	var semantics, migrationKey string
	var epoch int64
	require.NoError(t, conn.QueryRowContext(ctx, `
SELECT priority_semantics, migration_key, semantic_epoch
FROM account_priority_semantic_state WHERE id = 1
`).Scan(&semantics, &migrationKey, &epoch))
	require.Equal(t, "lower_wins", semantics)
	require.Equal(t, accountPriorityMigrationKey+":rollback", migrationKey)
	require.Equal(t, int64(2), epoch)

	var publicationCount int
	require.NoError(t, conn.QueryRowContext(ctx, `
SELECT COUNT(*) FROM account_priority_semantic_publications WHERE migration_key = $1
`, accountPriorityMigrationKey).Scan(&publicationCount))
	require.Zero(t, publicationCount)
}
