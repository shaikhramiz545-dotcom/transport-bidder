-- Add authUid column to DriverVerifications table
-- This column stores Firebase Auth UID for secure driver identity resolution

ALTER TABLE "DriverVerifications" 
ADD COLUMN IF NOT EXISTS "authUid" VARCHAR(255) UNIQUE;

CREATE INDEX IF NOT EXISTS idx_driver_verifications_auth_uid 
ON "DriverVerifications"("authUid");
