-- Wallet ledger (audit for all balance changes)
CREATE TABLE IF NOT EXISTS "WalletLedgers" (
  id SERIAL PRIMARY KEY,
  "driverId" VARCHAR(255) NOT NULL,
  type VARCHAR(64) NOT NULL,
  "creditsChange" INTEGER NOT NULL,
  "refId" VARCHAR(255),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_ledgers_driver_id ON "WalletLedgers"("driverId");
CREATE INDEX IF NOT EXISTS idx_wallet_ledgers_created_at ON "WalletLedgers"("createdAt" DESC);

-- Optional: last recharge timestamp and fraud protection
ALTER TABLE "DriverWallets"
  ADD COLUMN IF NOT EXISTS "lastRechargeAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "rejectedRechargeCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "WalletTransactions"
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMPTZ;

COMMENT ON COLUMN "DriverWallets"."lastRechargeAt" IS 'Set when admin approves a recharge';
COMMENT ON COLUMN "DriverWallets"."rejectedRechargeCount" IS 'Incremented on decline; block new recharge when >= 3';
COMMENT ON COLUMN "WalletTransactions"."approvedAt" IS 'Set when admin approves';
