-- User app: phone -> email mapping for password reset by phone
CREATE TABLE IF NOT EXISTS user_app_emails (
  phone     TEXT PRIMARY KEY,
  email     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
