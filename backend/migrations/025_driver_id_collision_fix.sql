-- Migration 025: Driver ID Collision Security Fix
-- Purpose: Add hard constraints to prevent driverId collisions and prepare wallet isolation

-- 1. Ensure unique constraints exist (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "driver_identity_phone_unique" ON "DriverIdentities" (phone);
CREATE UNIQUE INDEX IF NOT EXISTS "driver_identity_driverid_unique" ON "DriverIdentities" ("driverId");
CREATE UNIQUE INDEX IF NOT EXISTS "driver_wallet_driverid_unique" ON "DriverWallets" ("driverId");
CREATE UNIQUE INDEX IF NOT EXISTS "driver_verification_driverid_unique" ON "DriverVerifications" ("driverId");

-- 2. Add appUserId column to DriverWallets for future 1:1 relationship with AppUser
-- This decouples the wallet from the phone-derived driverId entirely.
ALTER TABLE "DriverWallets" ADD COLUMN IF NOT EXISTS "appUserId" INTEGER;
ALTER TABLE "DriverWallets" ADD CONSTRAINT "driver_wallet_appuser_fk"
  FOREIGN KEY ("appUserId") REFERENCES "AppUsers" (id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "driver_wallet_appuserid_unique"
  ON "DriverWallets" ("appUserId") WHERE "appUserId" IS NOT NULL;

-- 3. Add phone column to DriverWallets for cross-reference auditing
ALTER TABLE "DriverWallets" ADD COLUMN IF NOT EXISTS "ownerPhone" VARCHAR(32);

-- 4. Add collision_repaired flag to DriverVerifications for tracking repaired records
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "collisionRepaired" BOOLEAN DEFAULT FALSE;
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "previousDriverId" VARCHAR(64);

-- 5. Add format check constraint on driverId (must start with DRV- or d-)
-- Prevents injection of arbitrary strings as driverIds
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'driver_identity_driverid_format'
  ) THEN
    ALTER TABLE "DriverIdentities" ADD CONSTRAINT "driver_identity_driverid_format"
      CHECK ("driverId" ~ '^(DRV-|d-)[a-zA-Z0-9]+$');
  END IF;
END $$;
