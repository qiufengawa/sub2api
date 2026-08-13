-- Manual emergency rollback for account_priority_higher_wins_v1.
-- Stop every application instance before running this script and deploy a
-- lower-wins compatible binary before serving traffic again.
-- The script is deliberately fail-closed: it validates the integrity-checked backup
-- set and its digest before changing any account or schema state.

BEGIN;

DO $$
DECLARE
    migration_name CONSTANT TEXT := 'account_priority_higher_wins_v1';
    migration_row account_priority_semantic_migrations%ROWTYPE;
    backup_rows BIGINT;
    backup_digest TEXT;
    metadata_digest TEXT;
    expected_default TEXT;
    constraint_row JSONB;
    restore_name TEXT;
    restore_definition TEXT;
    restore_validated BOOLEAN;
    new_semantic_epoch BIGINT;
    state_row account_priority_semantic_state%ROWTYPE;
BEGIN
    -- Serialize rollback with the semantic publisher. The publisher holds the
    -- matching session advisory lock through Redis promotion, so this
    -- transaction cannot restore lower-wins while a higher-wins epoch is still
    -- being published.
    PERFORM pg_advisory_xact_lock(hashtextextended('account_priority_publication:' || migration_name, 0));
    SELECT *
    INTO migration_row
    FROM account_priority_semantic_migrations
    WHERE migration_key = migration_name
      AND rolled_back_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'account priority migration is absent or already rolled back';
    END IF;

    SELECT *
    INTO state_row
    FROM account_priority_semantic_state
    WHERE id = 1
    FOR UPDATE;

    IF NOT FOUND
       OR state_row.priority_semantics <> 'higher_wins'
       OR state_row.migration_key <> migration_name
       OR state_row.pivot <> migration_row.pivot
       OR state_row.semantic_epoch <> migration_row.semantic_epoch THEN
        RAISE EXCEPTION 'account priority rollback semantic state is missing or inconsistent';
    END IF;

    LOCK TABLE accounts IN SHARE ROW EXCLUSIVE MODE;

    SELECT COUNT(*),
           md5(COALESCE(string_agg(
               account_id::text || ':' || old_priority::text || ':' || COALESCE(to_char(old_updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'), '<null>'),
               '|' ORDER BY account_id
           ), ''))
    INTO backup_rows, backup_digest
    FROM account_priority_semantic_migration_backup
    WHERE migration_key = migration_name;

    IF backup_rows <> migration_row.backup_count
       OR backup_rows <> migration_row.migrated_accounts
       OR backup_digest <> migration_row.backup_digest THEN
        RAISE EXCEPTION 'account priority migration backup integrity check failed: rows=% expected=% digest=% expected_digest=%',
            backup_rows, migration_row.backup_count, backup_digest, migration_row.backup_digest;
    END IF;

    metadata_digest := md5(
        COALESCE(migration_row.original_priority_default, '<null>') || '|' ||
        COALESCE(migration_row.original_priority_comment, '<null>') || '|' ||
        migration_row.original_priority_constraints::text
    );
    IF metadata_digest <> migration_row.metadata_digest THEN
        RAISE EXCEPTION 'account priority migration metadata integrity check failed';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM account_priority_semantic_migration_backup b
        WHERE b.migration_key = migration_name
          AND b.row_digest <> md5(b.account_id::text || ':' || b.old_priority::text || ':' || COALESCE(to_char(b.old_updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'), '<null>'))
    ) THEN
        RAISE EXCEPTION 'account priority migration backup row digest validation failed';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM accounts a
        JOIN account_priority_semantic_migration_backup b
          ON b.migration_key = migration_name AND b.account_id = a.id
        WHERE a.priority IS NULL
    ) THEN
        RAISE EXCEPTION 'account priority rollback found a NULL current priority';
    END IF;

    -- Rows created after the forward migration have no original value.  Do
    -- not guess a legacy value when their higher-wins priority is above the
    -- recorded pivot; that would map to a negative lower-wins value.
    IF EXISTS (
        SELECT 1
        FROM accounts a
        LEFT JOIN account_priority_semantic_migration_backup b
          ON b.migration_key = migration_name AND b.account_id = a.id
        WHERE b.account_id IS NULL
    ) THEN
        RAISE EXCEPTION 'account priority rollback found accounts created after migration; remove or migrate them explicitly before rollback';
    END IF;

	-- Every captured account must still exist.  Otherwise a join-based UPDATE
	-- would silently leave the deleted historical row unrestored and falsely
	-- report a precise rollback.
	IF EXISTS (
		SELECT 1
		FROM account_priority_semantic_migration_backup b
		LEFT JOIN accounts a ON a.id = b.account_id
		WHERE b.migration_key = migration_name
		  AND a.id IS NULL
	) OR (SELECT COUNT(*) FROM accounts) <> migration_row.backup_count THEN
		RAISE EXCEPTION 'account priority rollback account set differs from the migration backup';
	END IF;

    -- A rollback may not silently discard priority changes made after the
    -- migration. Require every live row to still contain the exact reflected
    -- value before restoring the captured lower-wins value.
    IF EXISTS (
        SELECT 1
        FROM accounts a
        JOIN account_priority_semantic_migration_backup b
          ON b.migration_key = migration_name AND b.account_id = a.id
        WHERE a.priority::BIGINT <> migration_row.pivot - b.old_priority::BIGINT
    ) THEN
        RAISE EXCEPTION 'account priority rollback found priorities changed after migration; reconcile them explicitly before rollback';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM accounts a
        WHERE migration_row.pivot - a.priority::BIGINT > 2147483647
           OR migration_row.pivot - a.priority::BIGINT < -2147483648
    ) THEN
        RAISE EXCEPTION 'account priority rollback would overflow PostgreSQL INTEGER';
    END IF;

    ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_priority_nonnegative;

    UPDATE accounts a
    SET priority = b.old_priority,
        updated_at = COALESCE(b.old_updated_at, a.updated_at)
    FROM account_priority_semantic_migration_backup b
    WHERE b.migration_key = migration_name
      AND b.account_id = a.id;

    -- Restore the exact pre-migration priority default, including the absence
    -- of a default. The expression was captured from pg_attrdef.
    expected_default := migration_row.original_priority_default;
    IF expected_default IS NULL OR expected_default = '' THEN
        ALTER TABLE accounts ALTER COLUMN priority DROP DEFAULT;
    ELSE
        EXECUTE 'ALTER TABLE accounts ALTER COLUMN priority SET DEFAULT ' || expected_default;
    END IF;

    COMMENT ON COLUMN accounts.priority IS NULL;
    IF migration_row.original_priority_comment IS NOT NULL THEN
        EXECUTE format('COMMENT ON COLUMN accounts.priority IS %L', migration_row.original_priority_comment);
    END IF;

    -- Recreate exactly the priority-related CHECK constraints captured before
    -- the forward migration. Constraints already present under the same name
    -- are removed first so the script is deterministic.
    FOR constraint_row IN
        SELECT value
        FROM jsonb_array_elements(migration_row.original_priority_constraints)
    LOOP
        restore_name := constraint_row->>'name';
        restore_definition := constraint_row->>'definition';
        restore_validated := COALESCE((constraint_row->>'validated')::BOOLEAN, TRUE);
        IF restore_name IS NULL OR restore_definition IS NULL THEN
            RAISE EXCEPTION 'invalid stored priority constraint metadata';
        END IF;
        EXECUTE format('ALTER TABLE accounts DROP CONSTRAINT IF EXISTS %I', restore_name);
        EXECUTE format('ALTER TABLE accounts ADD CONSTRAINT %I %s%s',
            restore_name,
            restore_definition,
            CASE WHEN restore_validated THEN '' ELSE ' NOT VALID' END);
        IF restore_validated THEN
            EXECUTE format('ALTER TABLE accounts VALIDATE CONSTRAINT %I', restore_name);
        END IF;
    END LOOP;

    new_semantic_epoch := state_row.semantic_epoch + 1;

    UPDATE account_priority_semantic_migrations
    SET rolled_back_at = NOW(),
        rollback_pivot = migration_row.pivot
    WHERE migration_key = migration_name;

    -- Revoke the higher-wins publication in the same transaction as the data
    -- rollback. ON DELETE CASCADE removes its frozen bucket manifest so a
    -- delayed maintenance publisher cannot promote it after rollback.
    DELETE FROM account_priority_semantic_publications
    WHERE migration_key = migration_name;

    INSERT INTO account_priority_semantic_state (id, priority_semantics, migration_key, pivot, semantic_epoch)
    VALUES (1, 'lower_wins', migration_name || ':rollback', migration_row.pivot, new_semantic_epoch)
    ON CONFLICT (id) DO UPDATE SET
        priority_semantics = EXCLUDED.priority_semantics,
        migration_key = EXCLUDED.migration_key,
        pivot = EXCLUDED.pivot,
        semantic_epoch = EXCLUDED.semantic_epoch,
        updated_at = NOW();

    INSERT INTO scheduler_outbox (event_type, payload, dedup_key)
    VALUES (
        'full_rebuild',
        jsonb_build_object(
            'reason', 'rollback_' || migration_name,
            'priority_semantics', 'lower_wins',
            'migration_key', migration_name || ':rollback',
            'priority_pivot', migration_row.pivot,
            'semantic_epoch', new_semantic_epoch
        ),
        'rollback:' || migration_name || ':full_rebuild'
    )
    ON CONFLICT (dedup_key) WHERE dedup_key IS NOT NULL
    DO NOTHING;
END $$;

COMMIT;
