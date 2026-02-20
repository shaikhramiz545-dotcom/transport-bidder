-- Migration 028: Add status and adminFeedback columns to DriverDocuments
-- Root cause: 008_driver_documents.sql created the table without these columns,
-- but the Sequelize model has them, causing every document upload to fail with
-- "column status does not exist" (HTTP 500).

ALTER TABLE "DriverDocuments" ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'pending';
ALTER TABLE "DriverDocuments" ADD COLUMN IF NOT EXISTS "adminFeedback" TEXT;

CREATE INDEX IF NOT EXISTS idx_driver_documents_status ON "DriverDocuments"(status);
