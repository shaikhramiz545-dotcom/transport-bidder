-- Driver verification documents (Peru: brevete, DNI, selfie, SOAT, tarjeta, vehicle photo)
CREATE TABLE IF NOT EXISTS "DriverDocuments" (
  id SERIAL PRIMARY KEY,
  "driverId" VARCHAR(255) NOT NULL,
  "documentType" VARCHAR(64) NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "fileName" VARCHAR(512),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_documents_driver_id ON "DriverDocuments"("driverId");
CREATE UNIQUE INDEX IF NOT EXISTS idx_driver_documents_driver_type ON "DriverDocuments"("driverId", "documentType");
