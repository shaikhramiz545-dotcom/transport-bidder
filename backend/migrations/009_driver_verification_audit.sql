-- Audit log for driver verification actions (admin or system)
CREATE TABLE IF NOT EXISTS "DriverVerificationAudits" (
  id SERIAL PRIMARY KEY,
  "driverId" VARCHAR(255) NOT NULL,
  actor VARCHAR(255) NOT NULL,
  action VARCHAR(64) NOT NULL,
  reason TEXT,
  "oldStatus" VARCHAR(64),
  "newStatus" VARCHAR(64),
  metadata JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_verification_audits_driver_id ON "DriverVerificationAudits"("driverId");
CREATE INDEX IF NOT EXISTS idx_driver_verification_audits_created_at ON "DriverVerificationAudits"("createdAt" DESC);
