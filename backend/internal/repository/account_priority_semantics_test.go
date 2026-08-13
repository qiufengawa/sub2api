package repository

import (
	"context"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/require"
)

func TestValidateAccountPrioritySemanticState(t *testing.T) {
	t.Run("accepts higher wins epoch", func(t *testing.T) {
		db, mock, err := sqlmock.New()
		require.NoError(t, err)
		t.Cleanup(func() { _ = db.Close() })
		mock.ExpectQuery("SELECT s\\.priority_semantics").
			WillReturnRows(sqlmock.NewRows([]string{"priority_semantics", "migration_key", "state_pivot", "semantic_epoch", "migration_semantics", "migration_pivot"}).
				AddRow("higher_wins", "account_priority_higher_wins_v1", int64(50), int64(1), "higher_wins", int64(50)))
		require.NoError(t, ValidateAccountPrioritySemanticState(context.Background(), db))
		require.NoError(t, mock.ExpectationsWereMet())
	})

	t.Run("rejects rolled back lower wins state", func(t *testing.T) {
		db, mock, err := sqlmock.New()
		require.NoError(t, err)
		t.Cleanup(func() { _ = db.Close() })
		mock.ExpectQuery("SELECT s\\.priority_semantics").
			WillReturnRows(sqlmock.NewRows([]string{"priority_semantics", "migration_key", "state_pivot", "semantic_epoch", "migration_semantics", "migration_pivot"}).
				AddRow("lower_wins", "account_priority_higher_wins_v1:rollback", int64(50), int64(2), "lower_wins", int64(50)))
		require.ErrorContains(t, ValidateAccountPrioritySemanticState(context.Background(), db), "unsupported account priority semantics")
		require.NoError(t, mock.ExpectationsWereMet())
	})

	t.Run("rejects missing state", func(t *testing.T) {
		db, mock, err := sqlmock.New()
		require.NoError(t, err)
		t.Cleanup(func() { _ = db.Close() })
		mock.ExpectQuery("SELECT s\\.priority_semantics").
			WillReturnRows(sqlmock.NewRows([]string{"priority_semantics", "migration_key", "state_pivot", "semantic_epoch", "migration_semantics", "migration_pivot"}))
		require.ErrorContains(t, ValidateAccountPrioritySemanticState(context.Background(), db), "semantic state is missing")
		require.NoError(t, mock.ExpectationsWereMet())
	})

	t.Run("rejects unknown migration key", func(t *testing.T) {
		db, mock, err := sqlmock.New()
		require.NoError(t, err)
		t.Cleanup(func() { _ = db.Close() })
		mock.ExpectQuery("SELECT s\\.priority_semantics").
			WillReturnRows(sqlmock.NewRows([]string{"priority_semantics", "migration_key", "state_pivot", "semantic_epoch", "migration_semantics", "migration_pivot"}).
				AddRow("higher_wins", "unknown", int64(50), int64(1), "higher_wins", int64(50)))
		require.ErrorContains(t, ValidateAccountPrioritySemanticState(context.Background(), db), "invalid account priority semantic state")
		require.NoError(t, mock.ExpectationsWereMet())
	})
}

func TestValidateAccountPriorityPublicationReady(t *testing.T) {
	tests := []struct {
		name    string
		rows    *sqlmock.Rows
		wantErr string
	}{
		{
			name: "accepts completed frozen publication",
			rows: priorityPublicationReadyRows().AddRow("succeeded", true, int64(2), "higher_wins", int64(50), int64(2), "higher_wins", int64(50), int64(2), "higher_wins", int64(50)),
		},
		{
			name:    "rejects pending publication",
			rows:    priorityPublicationReadyRows().AddRow("pending", false, int64(2), "higher_wins", int64(50), int64(2), "higher_wins", int64(50), int64(2), "higher_wins", int64(50)),
			wantErr: "publication is not ready",
		},
		{
			name:    "rejects succeeded publication without frozen bucket set",
			rows:    priorityPublicationReadyRows().AddRow("succeeded", false, int64(2), "higher_wins", int64(50), int64(2), "higher_wins", int64(50), int64(2), "higher_wins", int64(50)),
			wantErr: "publication is not ready",
		},
		{
			name:    "rejects stale publication epoch",
			rows:    priorityPublicationReadyRows().AddRow("succeeded", true, int64(1), "higher_wins", int64(50), int64(2), "higher_wins", int64(50), int64(2), "higher_wins", int64(50)),
			wantErr: "does not match durable state",
		},
		{
			name:    "rejects stale publication pivot",
			rows:    priorityPublicationReadyRows().AddRow("succeeded", true, int64(2), "higher_wins", int64(49), int64(2), "higher_wins", int64(50), int64(2), "higher_wins", int64(50)),
			wantErr: "does not match durable state",
		},
		{
			name:    "rejects stale publication semantics",
			rows:    priorityPublicationReadyRows().AddRow("succeeded", true, int64(2), "lower_wins", int64(50), int64(2), "higher_wins", int64(50), int64(2), "higher_wins", int64(50)),
			wantErr: "does not match durable state",
		},
		{
			name:    "rejects missing publication",
			rows:    priorityPublicationReadyRows(),
			wantErr: "publication is missing",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			db, mock, err := sqlmock.New()
			require.NoError(t, err)
			t.Cleanup(func() { _ = db.Close() })
			mock.ExpectQuery("SELECT p\\.status").
				WithArgs("account_priority_higher_wins_v1").
				WillReturnRows(tt.rows)
			err = ValidateAccountPriorityPublicationReady(context.Background(), db)
			if tt.wantErr == "" {
				require.NoError(t, err)
			} else {
				require.ErrorContains(t, err, tt.wantErr)
			}
			require.NoError(t, mock.ExpectationsWereMet())
		})
	}
}

func priorityPublicationReadyRows() *sqlmock.Rows {
	return sqlmock.NewRows([]string{
		"status", "bucket_set_frozen",
		"publication_epoch", "publication_semantics", "publication_pivot",
		"state_epoch", "state_semantics", "state_pivot",
		"migration_epoch", "migration_semantics", "migration_pivot",
	})
}
