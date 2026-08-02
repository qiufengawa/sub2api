-- Add request identity metadata so ordinary gateway reservations can be
-- retried idempotently without conflating two payloads that reuse an ID.
ALTER TABLE billing_reservations
    ADD COLUMN IF NOT EXISTS request_fingerprint VARCHAR(64) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS request_payload_hash VARCHAR(64) NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_billing_reservations_request_fingerprint
    ON billing_reservations (request_fingerprint)
    WHERE request_fingerprint <> '';
