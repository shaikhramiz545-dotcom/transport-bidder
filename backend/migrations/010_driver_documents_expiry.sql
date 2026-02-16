-- Optional expiry date for driver documents (SOAT, brevete)
ALTER TABLE "DriverDocuments"
  ADD COLUMN IF NOT EXISTS "expiryDate" DATE;

COMMENT ON COLUMN "DriverDocuments"."expiryDate" IS 'Used for soat and optionally brevete; canGoOnline blocks if soat expired';
