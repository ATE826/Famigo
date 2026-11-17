CREATE TABLE login_captcha_gates (
    ip_hash text PRIMARY KEY,
    required boolean NOT NULL DEFAULT false,
    updated_at timestamptz NOT NULL DEFAULT now()
);
