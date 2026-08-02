-- Give ordinary gateway billing reservations an explicit renewable lease so
-- a process crash cannot leave wallet or subscription quota frozen forever.
ALTER TABLE billing_reservations
    ADD COLUMN IF NOT EXISTS lease_owner VARCHAR(64),
    ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ;

-- Reservations created by the previous build did not have a heartbeat. Give
-- them a conservative migration grace period so an in-flight long stream is
-- never reclaimed while binaries are rolling across instances.
UPDATE billing_reservations
SET lease_owner = COALESCE(NULLIF(lease_owner, ''), 'legacy-migration'),
    last_heartbeat_at = COALESCE(last_heartbeat_at, NOW()),
    lease_expires_at = COALESCE(lease_expires_at, NOW() + INTERVAL '24 hours')
WHERE status = 'pending'
  AND lease_expires_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_billing_reservations_pending_lease
    ON billing_reservations (lease_expires_at, id)
    WHERE status = 'pending' AND lease_expires_at IS NOT NULL;
