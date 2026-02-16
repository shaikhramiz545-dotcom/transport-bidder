-- Add antecedentes (policiales / penales) yes-no fields to DriverVerifications
ALTER TABLE "DriverVerifications"
  ADD COLUMN IF NOT EXISTS "hasAntecedentesPoliciales" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "hasAntecedentesPenales" BOOLEAN;

COMMENT ON COLUMN "DriverVerifications"."hasAntecedentesPoliciales" IS 'Driver self-reported: has antecedentes policiales (yes/no)';
COMMENT ON COLUMN "DriverVerifications"."hasAntecedentesPenales" IS 'Driver self-reported: has antecedentes penales (yes/no)';
