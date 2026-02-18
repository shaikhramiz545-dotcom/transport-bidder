-- Driver verifications for Admin Panel (sync from Driver app via Firestore)
CREATE TABLE IF NOT EXISTS "DriverVerifications" (
  id SERIAL PRIMARY KEY,
  "driverId" VARCHAR(255) UNIQUE NOT NULL,
  status VARCHAR(255) NOT NULL DEFAULT 'pending',
  "vehicleType" VARCHAR(255) DEFAULT 'car',
  "vehiclePlate" VARCHAR(255),
  "driverName" VARCHAR(255),
  "blockReason" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_verifications_driver_id ON "DriverVerifications"("driverId");
CREATE INDEX IF NOT EXISTS idx_driver_verifications_status ON "DriverVerifications"(status);
