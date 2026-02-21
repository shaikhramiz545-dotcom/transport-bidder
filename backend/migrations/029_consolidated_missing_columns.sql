-- Migration 029: Consolidated fix for all missing columns across tables
-- Root cause: Several migrations (006, 010, 023, 028) may not have been applied to production DB.
-- This single migration ensures ALL required columns exist, making it safe to re-run.

-- ═══════════════════════════════════════════════════════════════════════════════
-- DriverVerifications: authUid column (from migration 006)
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "authUid" VARCHAR(255) UNIQUE;
CREATE INDEX IF NOT EXISTS idx_driver_verifications_auth_uid ON "DriverVerifications"("authUid");

-- ═══════════════════════════════════════════════════════════════════════════════
-- DriverVerifications: email, phone, city, dni, license, photoUrl (from various migrations)
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS phone VARCHAR(255);
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS city VARCHAR(255);
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS dni VARCHAR(255);
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS license VARCHAR(255);
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "hasAntecedentesPoliciales" BOOLEAN;
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "hasAntecedentesPenales" BOOLEAN;
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "customRatePerKm" DOUBLE PRECISION;
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "reuploadDocumentTypes" JSONB;
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "reuploadMessage" TEXT;
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "adminNotes" TEXT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- DriverVerifications: Vehicle detail fields (from migration 023)
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "vehicleBrand" VARCHAR(100);
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "vehicleModel" VARCHAR(100);
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "vehicleColor" VARCHAR(50);
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "registrationYear" INTEGER;
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "vehicleCapacity" INTEGER;
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "licenseClass" VARCHAR(20);
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "licenseIssueDate" DATE;
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "licenseExpiryDate" DATE;
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "dniIssueDate" DATE;
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "dniExpiryDate" DATE;
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "engineNumber" VARCHAR(50);
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "chassisNumber" VARCHAR(50);
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "registrationStartedAt" TIMESTAMP;
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "registrationDeadline" TIMESTAMP;
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "collisionRepaired" BOOLEAN DEFAULT false;
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "previousDriverId" VARCHAR(64);

-- ═══════════════════════════════════════════════════════════════════════════════
-- DriverDocuments: expiryDate (from migration 010)
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE "DriverDocuments" ADD COLUMN IF NOT EXISTS "expiryDate" DATE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- DriverDocuments: Document metadata fields (from migration 023)
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE "DriverDocuments" ADD COLUMN IF NOT EXISTS "issueDate" DATE;
ALTER TABLE "DriverDocuments" ADD COLUMN IF NOT EXISTS "policyNumber" VARCHAR(100);
ALTER TABLE "DriverDocuments" ADD COLUMN IF NOT EXISTS "insuranceCompany" VARCHAR(100);
ALTER TABLE "DriverDocuments" ADD COLUMN IF NOT EXISTS "certificateNumber" VARCHAR(100);
ALTER TABLE "DriverDocuments" ADD COLUMN IF NOT EXISTS "inspectionCenter" VARCHAR(200);

-- ═══════════════════════════════════════════════════════════════════════════════
-- DriverDocuments: status + adminFeedback (from migration 028)
-- ROOT CAUSE of "column status does not exist" error on document upload
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE "DriverDocuments" ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'pending';
ALTER TABLE "DriverDocuments" ADD COLUMN IF NOT EXISTS "adminFeedback" TEXT;
CREATE INDEX IF NOT EXISTS idx_driver_documents_status ON "DriverDocuments"(status);

-- ═══════════════════════════════════════════════════════════════════════════════
-- Unique constraints (from migration 026)
-- ═══════════════════════════════════════════════════════════════════════════════
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'driver_verifications_email_unique') THEN
    BEGIN
      ALTER TABLE "DriverVerifications" ADD CONSTRAINT driver_verifications_email_unique UNIQUE (email);
    EXCEPTION WHEN unique_violation THEN
      RAISE NOTICE 'Cannot add unique constraint on email - duplicates exist';
    END;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'driver_verifications_dni_unique') THEN
    BEGIN
      ALTER TABLE "DriverVerifications" ADD CONSTRAINT driver_verifications_dni_unique UNIQUE (dni);
    EXCEPTION WHEN unique_violation THEN
      RAISE NOTICE 'Cannot add unique constraint on dni - duplicates exist';
    END;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'driver_verifications_license_unique') THEN
    BEGIN
      ALTER TABLE "DriverVerifications" ADD CONSTRAINT driver_verifications_license_unique UNIQUE (license);
    EXCEPTION WHEN unique_violation THEN
      RAISE NOTICE 'Cannot add unique constraint on license - duplicates exist';
    END;
  END IF;
END $$;
