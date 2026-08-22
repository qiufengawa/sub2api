-- Durable user-wide access-session generation for revoke-all-sessions.
-- Existing JWTs remain valid while the generation is zero; the first bump
-- invalidates legacy claims that do not carry the new generation claim.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS revocation_version BIGINT NOT NULL DEFAULT 0;
