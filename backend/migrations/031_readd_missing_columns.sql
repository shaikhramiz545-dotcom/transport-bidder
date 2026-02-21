-- 031_readd_missing_columns.sql
-- Re-adds all required columns that may have been dropped or never created.
-- Safe to run multiple times (IF NOT EXISTS guards every statement).

ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "authUid"                  VARCHAR(255);
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "email"                    VARCHAR(255);
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "phone"                    VARCHAR(255);
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "city"                     VARCHAR(255);
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "dni"                      VARCHAR(255);
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "license"                  VARCHAR(255);
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "photoUrl"                 TEXT;
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "hasAntecedentesPoliciales" BOOLEAN;
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "hasAntecedentesPenales"   BOOLEAN;
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "customRatePerKm"          DOUBLE PRECISION;
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "reuploadDocumentTypes"    JSONB;
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "reuploadMessage"          TEXT;
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "adminNotes"               TEXT;
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "vehicleBrand"             VARCHAR(100);
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "vehicleModel"             VARCHAR(100);
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "vehicleColor"             VARCHAR(50);
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "registrationYear"         INTEGER;
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "vehicleCapacity"          INTEGER;
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "licenseClass"             VARCHAR(20);
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "licenseIssueDate"         DATE;
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "licenseExpiryDate"        DATE;
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "dniIssueDate"             DATE;
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "dniExpiryDate"            DATE;
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "engineNumber"             VARCHAR(50);
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "chassisNumber"            VARCHAR(50);
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "registrationStartedAt"    TIMESTAMP WITH TIME ZONE;
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "registrationDeadline"     TIMESTAMP WITH TIME ZONE;
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "collisionRepaired"        BOOLEAN DEFAULT false;
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "previousDriverId"         VARCHAR(64);
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "blockReason"              TEXT;

ALTER TABLE "DriverDocuments" ADD COLUMN IF NOT EXISTS "expiryDate"        DATE;
ALTER TABLE "DriverDocuments" ADD COLUMN IF NOT EXISTS "issueDate"         DATE;
ALTER TABLE "DriverDocuments" ADD COLUMN IF NOT EXISTS "policyNumber"      VARCHAR(100);
ALTER TABLE "DriverDocuments" ADD COLUMN IF NOT EXISTS "insuranceCompany"  VARCHAR(100);
ALTER TABLE "DriverDocuments" ADD COLUMN IF NOT EXISTS "certificateNumber" VARCHAR(100);
ALTER TABLE "DriverDocuments" ADD COLUMN IF NOT EXISTS "inspectionCenter"  VARCHAR(200);
ALTER TABLE "DriverDocuments" ADD COLUMN IF NOT EXISTS "status"            VARCHAR(50) DEFAULT 'pending';
ALTER TABLE "DriverDocuments" ADD COLUMN IF NOT EXISTS "adminFeedback"     TEXT;
