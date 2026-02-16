-- Tbidder Initial Schema
-- Users, Drivers, Agencies, Companies, Rides, Transactions

-- Enums
CREATE TYPE user_role AS ENUM ('passenger', 'driver', 'admin', 'agency_admin', 'corporate_admin');
CREATE TYPE ride_status AS ENUM ('searching', 'bidding', 'accepted', 'started', 'completed', 'cancelled');
CREATE TYPE transaction_type AS ENUM ('topup', 'ride_deduction', 'transfer', 'refund');
CREATE TYPE transaction_status AS ENUM ('pending', 'approved', 'rejected');

-- Users (phone, role, rating, device_id)
CREATE TABLE users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone      TEXT UNIQUE NOT NULL,
  role       user_role NOT NULL DEFAULT 'passenger',
  rating     NUMERIC(3,2) DEFAULT 0,
  device_id  TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_device_id ON users(device_id);

-- Agencies (master_wallet, commission_rate)
CREATE TABLE agencies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT,
  master_wallet   NUMERIC(12,2) NOT NULL DEFAULT 0,
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 7.5,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Companies (credit_limit, ruc_tax_id)
CREATE TABLE companies (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT,
  credit_limit NUMERIC(12,2) NOT NULL DEFAULT 0,
  ruc_tax_id   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_companies_ruc ON companies(ruc_tax_id);

-- Drivers (wallet_balance, vehicle_video_url, agency_id, is_verified)
CREATE TABLE drivers (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_balance     NUMERIC(12,2) NOT NULL DEFAULT 0,
  vehicle_video_url  TEXT,
  agency_id          UUID REFERENCES agencies(id) ON DELETE SET NULL,
  is_verified        BOOLEAN NOT NULL DEFAULT false,
  dni_url            TEXT,
  license_url        TEXT,
  soat_url           TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

CREATE INDEX idx_drivers_user ON drivers(user_id);
CREATE INDEX idx_drivers_agency ON drivers(agency_id);
CREATE INDEX idx_drivers_verified ON drivers(is_verified);

-- Rides (offered_price, final_price, status, otp)
CREATE TABLE rides (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  driver_id      UUID REFERENCES drivers(id) ON DELETE SET NULL,
  offered_price  NUMERIC(10,2) NOT NULL,
  final_price    NUMERIC(10,2),
  status         ride_status NOT NULL DEFAULT 'searching',
  otp            CHAR(4),
  pickup_lat     NUMERIC(10,7),
  pickup_lng     NUMERIC(10,7),
  pickup_address TEXT,
  drop_lat       NUMERIC(10,7),
  drop_lng       NUMERIC(10,7),
  drop_address   TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at     TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ
);

CREATE INDEX idx_rides_user ON rides(user_id);
CREATE INDEX idx_rides_driver ON rides(driver_id);
CREATE INDEX idx_rides_status ON rides(status);
CREATE INDEX idx_rides_created ON rides(created_at);

-- Transactions (proof_image, type, amount)
CREATE TABLE transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        transaction_type NOT NULL,
  amount      NUMERIC(12,2) NOT NULL,
  proof_image TEXT,
  status      transaction_status NOT NULL DEFAULT 'pending',
  driver_id   UUID REFERENCES drivers(id) ON DELETE SET NULL,
  ride_id     UUID REFERENCES rides(id) ON DELETE SET NULL,
  agency_id   UUID REFERENCES agencies(id) ON DELETE SET NULL,
  company_id  UUID REFERENCES companies(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_driver ON transactions(driver_id);
CREATE INDEX idx_transactions_ride ON transactions(ride_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created ON transactions(created_at);

-- updated_at trigger helper
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at    BEFORE UPDATE ON users    FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER agencies_updated_at BEFORE UPDATE ON agencies FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER companies_updated_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER drivers_updated_at  BEFORE UPDATE ON drivers  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER rides_updated_at    BEFORE UPDATE ON rides    FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
