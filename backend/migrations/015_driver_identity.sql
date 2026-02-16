CREATE TABLE IF NOT EXISTS "DriverIdentities" (
  "id" SERIAL PRIMARY KEY,
  "phone" TEXT NOT NULL UNIQUE,
  "driverId" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "DriverIdentities_phone_idx" ON "DriverIdentities" ("phone");
CREATE INDEX IF NOT EXISTS "DriverIdentities_driverId_idx" ON "DriverIdentities" ("driverId");
