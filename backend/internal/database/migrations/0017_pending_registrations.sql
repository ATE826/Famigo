-- Registration challenges are not users and have no access or family membership.
CREATE TABLE pending_registrations (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    birthday DATE NOT NULL,
    legal_version TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    attempts SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX pending_registrations_email_unique ON pending_registrations (lower(email));
CREATE INDEX pending_registrations_expiry ON pending_registrations (expires_at);
