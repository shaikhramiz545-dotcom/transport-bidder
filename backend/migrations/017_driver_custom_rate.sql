-- Add per-driver custom pricing (S/ per km)

ALTER TABLE IF EXISTS "DriverVerifications"
ADD COLUMN IF NOT EXISTS "customRatePerKm" DOUBLE PRECISION;
