-- Internal admin notes (not shown to driver)
ALTER TABLE "DriverVerifications"
  ADD COLUMN IF NOT EXISTS "adminNotes" TEXT;

COMMENT ON COLUMN "DriverVerifications"."adminNotes" IS 'Internal admin notes; not shown to driver';
