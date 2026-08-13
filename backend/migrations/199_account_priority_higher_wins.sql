-- Switch accounts.priority from "lower wins" to "higher wins" without changing
-- the effective ordering of existing accounts. account_groups.priority is a
-- separate binding order and is intentionally untouched.

CREATE TABLE IF NOT EXISTS account_priority_semantic_migrations (
    migration_key TEXT PRIMARY KEY,
    pivot BIGINT NOT NULL,
    source_min_priority INTEGER NOT NULL,
    source_max_priority INTEGER NOT NULL,
    migrated_accounts BIGINT NOT NULL,
    priority_semantics TEXT NOT NULL DEFAULT 'higher_wins',
    semantic_epoch BIGINT NOT NULL DEFAULT 0,
    original_priority_default TEXT NULL,
    original_priority_comment TEXT NULL,
    original_priority_constraints JSONB NOT NULL DEFAULT '[]'::jsonb,
    backup_count BIGINT NOT NULL DEFAULT 0,
    backup_digest TEXT NOT NULL DEFAULT '',
    metadata_digest TEXT NOT NULL DEFAULT '',
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rolled_back_at TIMESTAMPTZ NULL,
    rollback_pivot BIGINT NULL
);

ALTER TABLE account_priority_semantic_migrations
    ADD COLUMN IF NOT EXISTS priority_semantics TEXT NOT NULL DEFAULT 'higher_wins',
    ADD COLUMN IF NOT EXISTS semantic_epoch BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS original_priority_default TEXT NULL,
    ADD COLUMN IF NOT EXISTS original_priority_comment TEXT NULL,
    ADD COLUMN IF NOT EXISTS original_priority_constraints JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS backup_count BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS backup_digest TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS metadata_digest TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS account_priority_semantic_state (
    id SMALLINT PRIMARY KEY CHECK (id = 1),
    priority_semantics TEXT NOT NULL,
    migration_key TEXT NOT NULL,
    pivot BIGINT NOT NULL,
    semantic_epoch BIGINT NOT NULL CHECK (semantic_epoch > 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS account_priority_semantic_migration_backup (
    migration_key TEXT NOT NULL,
    account_id BIGINT NOT NULL,
    old_priority INTEGER NOT NULL,
    old_updated_at TIMESTAMPTZ NULL,
    row_digest TEXT NOT NULL DEFAULT '',
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (migration_key, account_id)
);

-- The publication manifest must exist before the data conversion transaction
-- writes its pending row. Keeping both in this migration makes the account
-- reflection, semantic marker, outbox event, and resumable Redis publication
-- one atomic database state change.
CREATE TABLE IF NOT EXISTS account_priority_semantic_publications (
    migration_key TEXT PRIMARY KEY,
    semantic_epoch BIGINT NOT NULL CHECK (semantic_epoch > 0),
    priority_semantics TEXT NOT NULL,
    priority_pivot BIGINT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'succeeded', 'failed')),
    bucket_set_frozen BOOLEAN NOT NULL DEFAULT FALSE,
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    next_retry_at TIMESTAMPTZ NULL,
    last_error TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ NULL,
    completed_at TIMESTAMPTZ NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS account_priority_semantic_publication_buckets (
    migration_key TEXT NOT NULL REFERENCES account_priority_semantic_publications(migration_key) ON DELETE CASCADE,
    group_id BIGINT NOT NULL,
    platform TEXT NOT NULL,
    mode TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'succeeded', 'failed')),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    next_retry_at TIMESTAMPTZ NULL,
    last_error TEXT NOT NULL DEFAULT '',
    started_at TIMESTAMPTZ NULL,
    completed_at TIMESTAMPTZ NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (migration_key, group_id, platform, mode)
);

CREATE INDEX IF NOT EXISTS idx_account_priority_publications_ready
    ON account_priority_semantic_publications (status, next_retry_at, semantic_epoch);

CREATE INDEX IF NOT EXISTS idx_account_priority_publication_buckets_ready
    ON account_priority_semantic_publication_buckets (migration_key, status, next_retry_at);

ALTER TABLE account_priority_semantic_migration_backup
    ADD COLUMN IF NOT EXISTS old_updated_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS row_digest TEXT NOT NULL DEFAULT '';

-- This is an integrity-checked rollback backup. The row and aggregate digests
-- detect accidental changes, while execution remains under the migration
-- owner so a database owner can still repair it deliberately when required.
REVOKE INSERT, UPDATE, DELETE ON account_priority_semantic_migration_backup FROM PUBLIC;

DO $$
DECLARE
    migration_name CONSTANT TEXT := 'account_priority_higher_wins_v1';
    priority_pivot BIGINT;
    source_min INTEGER;
    source_max INTEGER;
    account_count BIGINT;
    semantic_epoch BIGINT;
    original_default TEXT;
    original_comment TEXT;
    original_constraints JSONB;
    constraint_row JSONB;
    backup_digest TEXT;
    metadata_digest TEXT;
    dedup_index_valid BOOLEAN;
    existing_migration account_priority_semantic_migrations%ROWTYPE;
    existing_backup_count BIGINT;
    existing_backup_digest TEXT;
BEGIN
    SELECT *
    INTO existing_migration
    FROM account_priority_semantic_migrations
    WHERE migration_key = migration_name
      AND rolled_back_at IS NULL
    FOR UPDATE;

    IF FOUND THEN
        SELECT COUNT(*),
               md5(COALESCE(string_agg(
                   account_id::text || ':' || old_priority::text || ':' || COALESCE(to_char(old_updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'), '<null>'),
                   '|' ORDER BY account_id
               ), ''))
        INTO existing_backup_count, existing_backup_digest
        FROM account_priority_semantic_migration_backup
        WHERE migration_key = migration_name;

        IF existing_backup_count <> existing_migration.backup_count
           OR existing_backup_count <> existing_migration.migrated_accounts
           OR existing_backup_digest <> existing_migration.backup_digest
           OR EXISTS (
               SELECT 1
               FROM account_priority_semantic_migration_backup b
               WHERE b.migration_key = migration_name
                 AND b.row_digest <> md5(b.account_id::text || ':' || b.old_priority::text || ':' || COALESCE(to_char(b.old_updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'), '<null>'))
           ) THEN
            RAISE EXCEPTION 'existing account priority migration backup is incomplete or corrupted';
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM account_priority_semantic_state s
            WHERE s.id = 1
              AND s.priority_semantics = 'higher_wins'
              AND s.migration_key = migration_name
              AND s.pivot = existing_migration.pivot
              AND s.semantic_epoch = existing_migration.semantic_epoch
        ) THEN
            RAISE EXCEPTION 'existing account priority migration semantic state is missing or inconsistent';
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM account_priority_semantic_publications p
            WHERE p.migration_key = migration_name
              AND p.priority_semantics = 'higher_wins'
              AND p.priority_pivot = existing_migration.pivot
              AND p.semantic_epoch = existing_migration.semantic_epoch
        ) THEN
            RAISE EXCEPTION 'existing account priority migration publication manifest is missing or inconsistent';
        END IF;

        IF (SELECT COUNT(*) FROM accounts) <> existing_migration.migrated_accounts
           OR EXISTS (
               SELECT 1
               FROM account_priority_semantic_migration_backup b
               LEFT JOIN accounts a ON a.id = b.account_id
               WHERE b.migration_key = migration_name
                 AND (
                     a.id IS NULL
                     OR a.priority::BIGINT <> existing_migration.pivot - b.old_priority::BIGINT
                 )
           ) THEN
            RAISE EXCEPTION 'existing account priority migration account state is incomplete or inconsistent';
        END IF;

        RETURN;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM account_priority_semantic_migrations
        WHERE migration_key = migration_name
          AND rolled_back_at IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'account priority migration % was rolled back; create a new migration key instead of replaying it', migration_name;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM account_priority_semantic_migration_backup
        WHERE migration_key = migration_name
    ) THEN
        RAISE EXCEPTION 'orphaned account priority migration backup exists for %; repair it before retrying', migration_name;
    END IF;

    LOCK TABLE accounts IN SHARE ROW EXCLUSIVE MODE;

    SELECT pg_get_expr(ad.adbin, ad.adrelid)
    INTO original_default
    FROM pg_attribute a
    LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
    WHERE a.attrelid = 'accounts'::regclass AND a.attname = 'priority';

    SELECT col_description('accounts'::regclass, a.attnum)
    INTO original_comment
    FROM pg_attribute a
    WHERE a.attrelid = 'accounts'::regclass AND a.attname = 'priority';

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'name', c.conname,
        'definition', regexp_replace(pg_get_constraintdef(c.oid), '\s+NOT VALID\s*$', ''),
        'validated', c.convalidated
    ) ORDER BY c.conname), '[]'::jsonb)
    INTO original_constraints
    FROM pg_constraint c
    WHERE c.conrelid = 'accounts'::regclass
      AND c.contype = 'c'
      AND EXISTS (
          SELECT 1
          FROM pg_attribute a
          WHERE a.attrelid = c.conrelid
            AND a.attname = 'priority'
            AND a.attnum = ANY(c.conkey)
      );

    SELECT EXISTS (
        SELECT 1
        FROM pg_class idx
        JOIN pg_index i ON i.indexrelid = idx.oid
        JOIN pg_class tbl ON tbl.oid = i.indrelid
        JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
        WHERE ns.nspname = 'public'
          AND tbl.relname = 'scheduler_outbox'
          AND idx.relname = 'idx_scheduler_outbox_pending_dedup_key'
          AND i.indisunique AND i.indisvalid AND i.indisready
          AND pg_get_expr(i.indpred, i.indrelid) ILIKE '%dedup_key%'
    ) INTO dedup_index_valid;
    IF NOT dedup_index_valid THEN
        RAISE EXCEPTION 'scheduler outbox pending dedup index is missing or invalid';
    END IF;

    -- Remove every historical CHECK constraint that references priority. The
    -- definitions are stored above and recreated by the manual rollback; this
    -- prevents a legacy 1..100 constraint from silently becoming a new
    -- product ceiling.
    FOR constraint_row IN
        SELECT jsonb_build_object(
            'name', c.conname,
            'definition', regexp_replace(pg_get_constraintdef(c.oid), '\s+NOT VALID\s*$', ''),
            'validated', c.convalidated
        )
        FROM pg_constraint c
        WHERE c.conrelid = 'accounts'::regclass
          AND c.contype = 'c'
          AND EXISTS (
              SELECT 1
              FROM pg_attribute a
              WHERE a.attrelid = c.conrelid
                AND a.attname = 'priority'
                AND a.attnum = ANY(c.conkey)
          )
    LOOP
        EXECUTE format('ALTER TABLE accounts DROP CONSTRAINT %I', constraint_row->>'name');
    END LOOP;

    SELECT
        COALESCE(MIN(priority), 0),
        COALESCE(MAX(priority), 0),
        COUNT(*)
    INTO source_min, source_max, account_count
    FROM accounts;

    priority_pivot := source_max::BIGINT;

    -- The forward conversion is only valid for the historical non-negative
    -- domain. Do not hide corrupt legacy values by reflecting them into a
    -- seemingly valid new value.
    IF source_min < 0 THEN
        RAISE EXCEPTION 'account priority migration found negative legacy value: %', source_min;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM accounts
        WHERE priority_pivot - priority::BIGINT > 2147483647
           OR priority_pivot - priority::BIGINT < 0
    ) THEN
        RAISE EXCEPTION 'account priority conversion exceeds PostgreSQL INTEGER range';
    END IF;

    INSERT INTO account_priority_semantic_migration_backup (
        migration_key,
        account_id,
        old_priority,
        old_updated_at,
        row_digest
    )
    SELECT migration_name,
           id,
           priority,
           updated_at,
           md5(id::text || ':' || priority::text || ':' || COALESCE(to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'), '<null>'))
    FROM accounts;

    SELECT COALESCE(COUNT(*), 0),
           md5(COALESCE(string_agg(
               account_id::text || ':' || old_priority::text || ':' || COALESCE(to_char(old_updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'), '<null>'),
               '|' ORDER BY account_id
           ), ''))
    INTO account_count, backup_digest
    FROM account_priority_semantic_migration_backup
    WHERE migration_key = migration_name;

    metadata_digest := md5(
        COALESCE(original_default, '<null>') || '|' ||
        COALESCE(original_comment, '<null>') || '|' ||
        original_constraints::text
    );

    SELECT COALESCE(MAX(s.semantic_epoch), 0) + 1
    INTO semantic_epoch
    FROM account_priority_semantic_state AS s;

    UPDATE accounts
    SET priority = (priority_pivot - priority::BIGINT)::INTEGER,
        updated_at = NOW();

    INSERT INTO account_priority_semantic_migrations (
        migration_key,
        pivot,
        source_min_priority,
        source_max_priority,
        migrated_accounts,
        priority_semantics,
        semantic_epoch,
        original_priority_default,
        original_priority_comment,
        original_priority_constraints,
        backup_count,
        backup_digest,
        metadata_digest
    ) VALUES (
        migration_name,
        priority_pivot,
        source_min,
        source_max,
        account_count,
        'higher_wins',
        semantic_epoch,
        original_default,
        original_comment,
        original_constraints,
        account_count,
        backup_digest,
        metadata_digest
    );

    INSERT INTO account_priority_semantic_state (id, priority_semantics, migration_key, pivot, semantic_epoch)
    VALUES (1, 'higher_wins', migration_name, priority_pivot, semantic_epoch)
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
            'reason', migration_name,
            'priority_semantics', 'higher_wins',
            'migration_key', migration_name,
            'priority_pivot', priority_pivot,
            'semantic_epoch', semantic_epoch
        ),
        'migration:' || migration_name || ':full_rebuild'
    )
    ON CONFLICT (dedup_key) WHERE dedup_key IS NOT NULL
    DO NOTHING;

    INSERT INTO account_priority_semantic_publications (
        migration_key,
        semantic_epoch,
        priority_semantics,
        priority_pivot
    ) VALUES (
        migration_name,
        semantic_epoch,
        'higher_wins',
        priority_pivot
    )
    ON CONFLICT (migration_key) DO NOTHING;
END $$;

ALTER TABLE accounts ALTER COLUMN priority SET DEFAULT 0;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'accounts_priority_nonnegative'
          AND conrelid = 'accounts'::regclass
    ) THEN
        ALTER TABLE accounts
            ADD CONSTRAINT accounts_priority_nonnegative
            CHECK (priority >= 0) NOT VALID;
    END IF;
END $$;

ALTER TABLE accounts VALIDATE CONSTRAINT accounts_priority_nonnegative;

COMMENT ON COLUMN accounts.priority IS
    'Account call priority. Higher values are scheduled first; minimum is 0.';
