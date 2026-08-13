package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/Wei-Shaw/sub2api/internal/service"
)

// ValidateAccountPrioritySemanticState is a fail-closed startup gate. The
// scheduler code in this binary only understands higher-wins account
// priorities, so a rolled-back or partially migrated database must never be
// allowed to serve requests.
func ValidateAccountPrioritySemanticState(ctx context.Context, db *sql.DB) error {
	if db == nil {
		return errors.New("nil sql db")
	}
	var semantics, migrationKey, migrationSemantics string
	var statePivot, migrationPivot int64
	var epoch int64
	err := db.QueryRowContext(ctx, `
		SELECT s.priority_semantics,
		       s.migration_key,
		       s.pivot,
		       s.semantic_epoch,
		       m.priority_semantics,
		       m.pivot
		FROM account_priority_semantic_state AS s
		JOIN account_priority_semantic_migrations AS m
		  ON m.migration_key = s.migration_key
		 AND m.rolled_back_at IS NULL
		WHERE s.id = 1
	`).Scan(&semantics, &migrationKey, &statePivot, &epoch, &migrationSemantics, &migrationPivot)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return errors.New("account priority semantic state is missing")
		}
		return fmt.Errorf("read account priority semantic state: %w", err)
	}
	if strings.TrimSpace(semantics) != service.AccountPrioritySemanticsHigherWins {
		return fmt.Errorf("unsupported account priority semantics %q; expected %q", semantics, service.AccountPrioritySemanticsHigherWins)
	}
	if strings.TrimSpace(migrationKey) != service.AccountPrioritySemanticMigrationKey || epoch <= 0 {
		return fmt.Errorf("invalid account priority semantic state: migration_key=%q epoch=%d", migrationKey, epoch)
	}
	if strings.TrimSpace(migrationSemantics) != service.AccountPrioritySemanticsHigherWins || statePivot != migrationPivot {
		return fmt.Errorf("account priority semantic state does not match migration record: state=%q/%d migration=%q/%d", semantics, statePivot, migrationSemantics, migrationPivot)
	}
	return nil
}

// ValidateAccountPriorityPublicationReady is an application startup gate. The
// maintenance publisher may validate the DB semantic state while publication
// is pending, but an ordinary server may only run after the durable manifest
// has completed successfully.
func ValidateAccountPriorityPublicationReady(ctx context.Context, db *sql.DB) error {
	if db == nil {
		return errors.New("nil sql db")
	}
	var status, publicationSemantics, stateSemantics, migrationSemantics string
	var frozen bool
	var publicationEpoch, stateEpoch, migrationEpoch int64
	var publicationPivot, statePivot, migrationPivot int64
	err := db.QueryRowContext(ctx, `
		SELECT p.status,
		       p.bucket_set_frozen,
		       p.semantic_epoch,
		       p.priority_semantics,
		       p.priority_pivot,
		       s.semantic_epoch,
		       s.priority_semantics,
		       s.pivot,
		       m.semantic_epoch,
		       m.priority_semantics,
		       m.pivot
		FROM account_priority_semantic_publications AS p
		JOIN account_priority_semantic_state AS s
		  ON s.id = 1
		 AND s.migration_key = p.migration_key
		JOIN account_priority_semantic_migrations AS m
		  ON m.migration_key = p.migration_key
		 AND m.rolled_back_at IS NULL
		WHERE p.migration_key = $1
	`, service.AccountPrioritySemanticMigrationKey).Scan(
		&status,
		&frozen,
		&publicationEpoch,
		&publicationSemantics,
		&publicationPivot,
		&stateEpoch,
		&stateSemantics,
		&statePivot,
		&migrationEpoch,
		&migrationSemantics,
		&migrationPivot,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return errors.New("account priority semantic publication is missing")
		}
		return fmt.Errorf("read account priority semantic publication: %w", err)
	}
	if strings.TrimSpace(status) != "succeeded" || !frozen {
		return fmt.Errorf("account priority semantic publication is not ready: status=%q bucket_set_frozen=%t", status, frozen)
	}
	if publicationEpoch <= 0 || publicationEpoch != stateEpoch || publicationEpoch != migrationEpoch ||
		strings.TrimSpace(publicationSemantics) != service.AccountPrioritySemanticsHigherWins ||
		publicationSemantics != stateSemantics || publicationSemantics != migrationSemantics ||
		publicationPivot != statePivot || publicationPivot != migrationPivot {
		return fmt.Errorf(
			"account priority semantic publication does not match durable state: publication=%q/%d/%d state=%q/%d/%d migration=%q/%d/%d",
			publicationSemantics, publicationPivot, publicationEpoch,
			stateSemantics, statePivot, stateEpoch,
			migrationSemantics, migrationPivot, migrationEpoch,
		)
	}
	return nil
}
