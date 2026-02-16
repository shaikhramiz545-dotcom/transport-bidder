-- Migration: Add comprehensive vehicle and document fields
-- Date: 2026-02-14
-- Purpose: Add vehicle details (brand, model, color, year, capacity) and document dates for Peru compliance

-- Add vehicle detail fields to DriverVerification table
ALTER TABLE DriverVerification ADD COLUMN IF NOT EXISTS vehicleBrand VARCHAR(100);
ALTER TABLE DriverVerification ADD COLUMN IF NOT EXISTS vehicleModel VARCHAR(100);
ALTER TABLE DriverVerification ADD COLUMN IF NOT EXISTS vehicleColor VARCHAR(50);
ALTER TABLE DriverVerification ADD COLUMN IF NOT EXISTS registrationYear INTEGER;
ALTER TABLE DriverVerification ADD COLUMN IF NOT EXISTS vehicleCapacity INTEGER;

-- Add license detail fields
ALTER TABLE DriverVerification ADD COLUMN IF NOT EXISTS licenseClass VARCHAR(20);
ALTER TABLE DriverVerification ADD COLUMN IF NOT EXISTS licenseIssueDate DATE;
ALTER TABLE DriverVerification ADD COLUMN IF NOT EXISTS licenseExpiryDate DATE;

-- Add DNI date fields
ALTER TABLE DriverVerification ADD COLUMN IF NOT EXISTS dniIssueDate DATE;
ALTER TABLE DriverVerification ADD COLUMN IF NOT EXISTS dniExpiryDate DATE;

-- Add optional advanced fields (for future use)
ALTER TABLE DriverVerification ADD COLUMN IF NOT EXISTS engineNumber VARCHAR(50);
ALTER TABLE DriverVerification ADD COLUMN IF NOT EXISTS chassisNumber VARCHAR(50);

-- Add document metadata fields to DriverDocument table
ALTER TABLE DriverDocument ADD COLUMN IF NOT EXISTS issueDate DATE;
ALTER TABLE DriverDocument ADD COLUMN IF NOT EXISTS policyNumber VARCHAR(100);
ALTER TABLE DriverDocument ADD COLUMN IF NOT EXISTS insuranceCompany VARCHAR(100);
ALTER TABLE DriverDocument ADD COLUMN IF NOT EXISTS certificateNumber VARCHAR(100);
ALTER TABLE DriverDocument ADD COLUMN IF NOT EXISTS inspectionCenter VARCHAR(200);

-- Add registration deadline tracking
ALTER TABLE DriverVerification ADD COLUMN IF NOT EXISTS registrationStartedAt TIMESTAMP;
ALTER TABLE DriverVerification ADD COLUMN IF NOT EXISTS registrationDeadline TIMESTAMP;

-- Comments for clarity
COMMENT ON COLUMN DriverVerification.vehicleBrand IS 'Vehicle manufacturer (Toyota, Nissan, Hyundai, etc.)';
COMMENT ON COLUMN DriverVerification.vehicleModel IS 'Vehicle model (Corolla, Sentra, Accent, etc.)';
COMMENT ON COLUMN DriverVerification.vehicleColor IS 'Vehicle color in Spanish (Blanco, Negro, Plata, etc.)';
COMMENT ON COLUMN DriverVerification.registrationYear IS 'Vehicle registration year (must be < 10 years old for taxi in Peru)';
COMMENT ON COLUMN DriverVerification.vehicleCapacity IS 'Passenger capacity (2, 4, 6, 8, etc.)';
COMMENT ON COLUMN DriverVerification.licenseClass IS 'Peru license class (A-I, A-IIa, A-IIb, A-IIIa, A-IIIb, A-IIIc)';
COMMENT ON COLUMN DriverVerification.licenseIssueDate IS 'Driver license issue date';
COMMENT ON COLUMN DriverVerification.licenseExpiryDate IS 'Driver license expiry date';
COMMENT ON COLUMN DriverVerification.dniIssueDate IS 'DNI issue date';
COMMENT ON COLUMN DriverVerification.dniExpiryDate IS 'DNI expiry date (expires every 8 years in Peru)';
COMMENT ON COLUMN DriverVerification.registrationStartedAt IS 'Timestamp when driver first started registration';
COMMENT ON COLUMN DriverVerification.registrationDeadline IS '24-hour deadline for completing registration';

COMMENT ON COLUMN DriverDocument.issueDate IS 'Document issue date';
COMMENT ON COLUMN DriverDocument.policyNumber IS 'Policy number (for SOAT insurance)';
COMMENT ON COLUMN DriverDocument.insuranceCompany IS 'Insurance company name (for SOAT)';
COMMENT ON COLUMN DriverDocument.certificateNumber IS 'Certificate number (for Revisión Técnica)';
COMMENT ON COLUMN DriverDocument.inspectionCenter IS 'Inspection center name (for Revisión Técnica)';
