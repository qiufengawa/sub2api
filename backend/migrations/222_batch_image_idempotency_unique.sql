-- Prevent concurrent identical batch submissions from creating duplicate jobs
-- after both callers pass the service-level read-before-create lookup.
CREATE UNIQUE INDEX IF NOT EXISTS batch_image_jobs_owner_idempotency_uq
    ON batch_image_jobs (user_id, api_key_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL AND idempotency_key <> '';
