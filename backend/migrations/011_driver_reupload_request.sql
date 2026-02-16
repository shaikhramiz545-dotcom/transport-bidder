-- Admin "request reupload" for specific document types + message (shown to driver)
ALTER TABLE "DriverVerifications"
  ADD COLUMN IF NOT EXISTS "reuploadDocumentTypes" JSONB,
  ADD COLUMN IF NOT EXISTS "reuploadMessage" TEXT;

COMMENT ON COLUMN "DriverVerifications"."reuploadDocumentTypes" IS 'Array of documentType strings when admin requested reupload';
COMMENT ON COLUMN "DriverVerifications"."reuploadMessage" IS 'Instructions shown to driver when reupload requested';
