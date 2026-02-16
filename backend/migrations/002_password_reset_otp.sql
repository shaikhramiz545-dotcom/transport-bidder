-- Password reset OTP table – Admin & Agency forgot/reset flow
CREATE TABLE IF NOT EXISTS password_reset_otp (
  id           SERIAL PRIMARY KEY,
  email        TEXT NOT NULL,
  otp          VARCHAR(6) NOT NULL,
  scope        VARCHAR(20) NOT NULL,  -- 'admin' | 'agency'
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_password_reset_otp_email_scope ON password_reset_otp(email, scope);
CREATE INDEX idx_password_reset_otp_expires ON password_reset_otp(expires_at);

-- Admin password override – when admin resets via OTP, we store hash here.
-- Login checks this first; if null, falls back to ADMIN_PASSWORD from env.
CREATE TABLE IF NOT EXISTS admin_credential (
  key   VARCHAR(64) PRIMARY KEY,
  value TEXT
);
