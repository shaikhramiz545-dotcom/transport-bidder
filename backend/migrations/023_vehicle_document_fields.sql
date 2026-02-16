-- Migration: Add comprehensive vehicle and document fields
-- Date: 2026-02-14
-- Purpose: Add vehicle details (brand, model, color, year, capacity) and document dates for Peru compliance

-- Add vehicle detail fields to DriverVerifications table
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "vehicleBrand" VARCHAR(100);
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "vehicleModel" VARCHAR(100);
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "vehicleColor" VARCHAR(50);
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "registrationYear" INTEGER;
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "vehicleCapacity" INTEGER;

-- Add license detail fields
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "licenseClass" VARCHAR(20);
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "licenseIssueDate" DATE;
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "licenseExpiryDate" DATE;

-- Add DNI date fields
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "dniIssueDate" DATE;
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "dniExpiryDate" DATE;

-- Add optional advanced fields (for future use)
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "engineNumber" VARCHAR(50);
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "chassisNumber" VARCHAR(50);

-- Add document metadata fields to DriverDocuments table
ALTER TABLE "DriverDocuments" ADD COLUMN IF NOT EXISTS "issueDate" DATE;
ALTER TABLE "DriverDocuments" ADD COLUMN IF NOT EXISTS "policyNumber" VARCHAR(100);
ALTER TABLE "DriverDocuments" ADD COLUMN IF NOT EXISTS "insuranceCompany" VARCHAR(100);
ALTER TABLE "DriverDocuments" ADD COLUMN IF NOT EXISTS "certificateNumber" VARCHAR(100);
ALTER TABLE "DriverDocuments" ADD COLUMN IF NOT EXISTS "inspectionCenter" VARCHAR(200);

-- Add registration deadline tracking
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "registrationStartedAt" TIMESTAMP;
ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "registrationDeadline" TIMESTAMP;

-- Comments for clarity
COMMENT ON COLUMN "DriverVerifications"."vehicleBrand" IS 'Vehicle manufacturer (Toyota, Nissan, Hyundai, etc.)';
COMMENT ON COLUMN "DriverVerifications"."vehicleModel" IS 'Vehicle model (Corolla, Sentra, Accent, etc.)';
COMMENT ON COLUMN "DriverVerifications"."vehicleColor" IS 'Vehicle color in Spanish (Blanco, Negro, Plata, etc.)';
COMMENT ON COLUMN "DriverVerifications"."registrationYear" IS 'Vehicle registration year (must be < 10 years old for taxi in Peru)';
COMMENT ON COLUMN "DriverVerifications"."vehicleCapacity" IS 'Passenger capacity (2, 4, 6, 8, etc.)';
COMMENT ON COLUMN "DriverVerifications"."licenseClass" IS 'Peru license class (A-I, A-IIa, A-IIb, A-IIIa, A-IIIb, A-IIIc)';
COMMENT ON COLUMN "DriverVerifications"."licenseIssueDate" IS 'Driver license issue date';
COMMENT ON COLUMN "DriverVerifications"."licenseExpiryDate" IS 'Driver license expiry date';
COMMENT ON COLUMN "DriverVerifications"."dniIssueDate" IS 'DNI issue date';
COMMENT ON COLUMN "DriverVerifications"."dniExpiryDate" IS 'DNI expiry date (expires every 8 years in Peru)';
COMMENT ON COLUMN "DriverVerifications"."registrationStartedAt" IS 'Timestamp when driver first started registration';
COMMENT ON COLUMN "DriverVerifications"."registrationDeadline" IS '24-hour deadline for completing registration';

COMMENT ON COLUMN "DriverDocuments"."issueDate" IS 'Document issue date';
COMMENT ON COLUMN "DriverDocuments"."policyNumber" IS 'Policy number (for SOAT insurance)';
COMMENT ON COLUMN "DriverDocuments"."insuranceCompany" IS 'Insurance company name (for SOAT)';
COMMENT ON COLUMN "DriverDocuments"."certificateNumber" IS 'Certificate number (for Revisión Técnica)';
COMMENT ON COLUMN "DriverDocuments"."inspectionCenter" IS 'Inspection center name (for Revisión Técnica)';
