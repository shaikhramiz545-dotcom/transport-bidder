-- App users table for email+password auth (replaces Firebase Auth for user & driver apps)
CREATE TABLE IF NOT EXISTS "AppUsers" (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  "passwordHash" VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  phone VARCHAR(50),
  role VARCHAR(20) NOT NULL DEFAULT 'user', -- user | driver
  "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- active | disabled
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Email verification OTPs (also used for password reset)
CREATE TABLE IF NOT EXISTS "EmailOtps" (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  otp VARCHAR(10) NOT NULL,
  scope VARCHAR(30) NOT NULL DEFAULT 'verification', -- verification | password_reset
  role VARCHAR(20) DEFAULT 'user', -- user | driver | admin | agency
  "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_otps_email_scope ON "EmailOtps" (email, scope);
CREATE INDEX IF NOT EXISTS idx_app_users_email ON "AppUsers" (email);
CREATE INDEX IF NOT EXISTS idx_app_users_phone ON "AppUsers" (phone);
