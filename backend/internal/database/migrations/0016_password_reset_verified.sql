-- A verified code becomes a short-lived reset-only grant, never a login session.
ALTER TABLE verification_codes ADD COLUMN verified_at TIMESTAMPTZ;
