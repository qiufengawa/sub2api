-- Compatibility migration for installations that may have applied an earlier
-- form of migration 199 before the publication manifest was moved into the
-- same transaction as the priority conversion.

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

INSERT INTO account_priority_semantic_publications (
    migration_key,
    semantic_epoch,
    priority_semantics,
    priority_pivot
)
SELECT migration_key, semantic_epoch, priority_semantics, pivot
FROM account_priority_semantic_state
WHERE priority_semantics = 'higher_wins'
ON CONFLICT (migration_key) DO UPDATE SET
    semantic_epoch = EXCLUDED.semantic_epoch,
    priority_semantics = EXCLUDED.priority_semantics,
    priority_pivot = EXCLUDED.priority_pivot,
    status = CASE
        WHEN account_priority_semantic_publications.semantic_epoch <> EXCLUDED.semantic_epoch
          OR account_priority_semantic_publications.priority_semantics <> EXCLUDED.priority_semantics
          OR account_priority_semantic_publications.priority_pivot <> EXCLUDED.priority_pivot
        THEN 'pending'
        ELSE account_priority_semantic_publications.status
    END,
    bucket_set_frozen = CASE
        WHEN account_priority_semantic_publications.semantic_epoch <> EXCLUDED.semantic_epoch
          OR account_priority_semantic_publications.priority_semantics <> EXCLUDED.priority_semantics
          OR account_priority_semantic_publications.priority_pivot <> EXCLUDED.priority_pivot
        THEN FALSE
        ELSE account_priority_semantic_publications.bucket_set_frozen
    END,
    completed_at = CASE
        WHEN account_priority_semantic_publications.semantic_epoch <> EXCLUDED.semantic_epoch
          OR account_priority_semantic_publications.priority_semantics <> EXCLUDED.priority_semantics
          OR account_priority_semantic_publications.priority_pivot <> EXCLUDED.priority_pivot
        THEN NULL
        ELSE account_priority_semantic_publications.completed_at
    END,
    updated_at = NOW();

DELETE FROM account_priority_semantic_publication_buckets AS b
USING account_priority_semantic_publications AS p
WHERE b.migration_key = p.migration_key
  AND p.status = 'pending'
  AND p.bucket_set_frozen = FALSE;

COMMENT ON TABLE account_priority_semantic_publications IS
    'Resumable scheduler cache publication for an account priority semantic epoch.';

COMMENT ON TABLE account_priority_semantic_publication_buckets IS
    'Frozen per-bucket manifest; Redis semantic epoch advances only after every row succeeds.';
