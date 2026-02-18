-- Driver wallets and wallet transactions for recharge flow
CREATE TABLE IF NOT EXISTS "DriverWallets" (
  id SERIAL PRIMARY KEY,
  "driverId" VARCHAR(255) UNIQUE NOT NULL,
  balance INTEGER NOT NULL DEFAULT 0,
  "lastScratchAt" DATE,
  "creditsValidUntil" DATE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "WalletTransactions" (
  id SERIAL PRIMARY KEY,
  "driverId" VARCHAR(255) NOT NULL,
  "amountSoles" DOUBLE PRECISION NOT NULL,
  "creditsAmount" INTEGER NOT NULL,
  "transactionId" VARCHAR(255) NOT NULL,
  "screenshotUrl" TEXT,
  status VARCHAR(255) NOT NULL DEFAULT 'pending',
  "adminNote" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_driver_id ON "WalletTransactions"("driverId");
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_status ON "WalletTransactions"(status);
