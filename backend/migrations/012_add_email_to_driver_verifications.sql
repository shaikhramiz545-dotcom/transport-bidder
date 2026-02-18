-- Add optional email column to DriverVerifications for admin/driver mapping
ALTER TABLE "DriverVerifications"
  ADD COLUMN IF NOT EXISTS "email" TEXT;

