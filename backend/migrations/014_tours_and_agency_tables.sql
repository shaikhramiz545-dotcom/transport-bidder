-- Tours / Attractions module tables + feature flags + agency finance

CREATE TABLE IF NOT EXISTS "FeatureFlags" (
  "key" VARCHAR(255) PRIMARY KEY,
  "value" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "AdminSettings" (
  "key" VARCHAR(255) PRIMARY KEY DEFAULT 'global',
  "commissionPercent" DOUBLE PRECISION NOT NULL DEFAULT 10,
  "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "TravelAgencies" (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  "passwordHash" VARCHAR(255),
  phone VARCHAR(255),
  country VARCHAR(255) NOT NULL,
  currency VARCHAR(16) NOT NULL DEFAULT 'USD',
  status VARCHAR(64) NOT NULL DEFAULT 'pending',
  "verificationNote" TEXT,
  "userId" INTEGER,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "AgencyDocuments" (
  id SERIAL PRIMARY KEY,
  "travelAgencyId" INTEGER NOT NULL REFERENCES "TravelAgencies"(id) ON DELETE CASCADE,
  "documentType" VARCHAR(255) NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "fileName" VARCHAR(255),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "Tours" (
  id SERIAL PRIMARY KEY,
  "travelAgencyId" INTEGER NOT NULL REFERENCES "TravelAgencies"(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  country VARCHAR(255) NOT NULL,
  city VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  category VARCHAR(64) NOT NULL,
  description TEXT,
  "includedServices" TEXT,
  images JSONB NOT NULL DEFAULT '[]',
  "videoUrl" VARCHAR(255),
  "durationMins" INTEGER,
  "meetingPoint" VARCHAR(255),
  "cancellationPolicy" TEXT,
  "freeCancellation" BOOLEAN NOT NULL DEFAULT true,
  "freeCancellationHours" INTEGER,
  languages JSONB NOT NULL DEFAULT '[]',
  status VARCHAR(64) NOT NULL DEFAULT 'pending',
  "pendingChangeSummary" TEXT,
  "suspendReason" TEXT,
  "suspendFixInstructions" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "TourPaxOptions" (
  id SERIAL PRIMARY KEY,
  "tourId" INTEGER NOT NULL REFERENCES "Tours"(id) ON DELETE CASCADE,
  label VARCHAR(255) NOT NULL,
  "pricePerPax" DOUBLE PRECISION NOT NULL,
  currency VARCHAR(16) NOT NULL DEFAULT 'USD',
  "minCount" INTEGER NOT NULL DEFAULT 1,
  "maxCount" INTEGER,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "TourSlots" (
  id SERIAL PRIMARY KEY,
  "tourId" INTEGER NOT NULL REFERENCES "Tours"(id) ON DELETE CASCADE,
  "slotDate" DATE NOT NULL,
  "startTime" VARCHAR(32) NOT NULL,
  "endTime" VARCHAR(32),
  "maxPax" INTEGER NOT NULL,
  "bookedPax" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "TourBookings" (
  id SERIAL PRIMARY KEY,
  "tourId" INTEGER NOT NULL REFERENCES "Tours"(id) ON DELETE CASCADE,
  "tourSlotId" INTEGER NOT NULL REFERENCES "TourSlots"(id) ON DELETE CASCADE,
  "travelAgencyId" INTEGER NOT NULL REFERENCES "TravelAgencies"(id) ON DELETE CASCADE,
  "totalAmount" DOUBLE PRECISION NOT NULL,
  currency VARCHAR(16) NOT NULL DEFAULT 'USD',
  "paxCount" INTEGER NOT NULL,
  "guestName" VARCHAR(255) NOT NULL,
  "guestEmail" VARCHAR(255) NOT NULL,
  "guestPhone" VARCHAR(255),
  "guestWhatsApp" VARCHAR(255),
  "specialInstructions" TEXT,
  "preferredLanguage" VARCHAR(16) NOT NULL DEFAULT 'en',
  "meetingPoint" VARCHAR(255),
  status VARCHAR(64) NOT NULL DEFAULT 'pending_payment',
  "dlocalPaymentId" VARCHAR(255),
  "dlocalStatus" VARCHAR(64),
  "voucherCode" VARCHAR(255),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "AgencyWallets" (
  id SERIAL PRIMARY KEY,
  "travelAgencyId" INTEGER NOT NULL UNIQUE REFERENCES "TravelAgencies"(id) ON DELETE CASCADE,
  balance DOUBLE PRECISION NOT NULL DEFAULT 0,
  currency VARCHAR(16) NOT NULL DEFAULT 'USD',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "TourReviews" (
  id SERIAL PRIMARY KEY,
  "tourId" INTEGER NOT NULL REFERENCES "Tours"(id) ON DELETE CASCADE,
  "bookingId" INTEGER REFERENCES "TourBookings"(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL,
  "reviewText" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "AgencyPayoutRequests" (
  id SERIAL PRIMARY KEY,
  "travelAgencyId" INTEGER NOT NULL REFERENCES "TravelAgencies"(id) ON DELETE CASCADE,
  amount DOUBLE PRECISION NOT NULL,
  currency VARCHAR(16) NOT NULL DEFAULT 'USD',
  "bankDetails" JSONB,
  status VARCHAR(64) NOT NULL DEFAULT 'pending',
  "adminNote" TEXT,
  "processedAt" TIMESTAMPTZ,
  "gatewayCharges" DOUBLE PRECISION,
  "transferFee" DOUBLE PRECISION,
  "netAmount" DOUBLE PRECISION,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tours_status ON "Tours"(status);
CREATE INDEX IF NOT EXISTS idx_tours_country ON "Tours"(country);
CREATE INDEX IF NOT EXISTS idx_tours_city ON "Tours"(city);
CREATE INDEX IF NOT EXISTS idx_tour_pax_options_tour_id ON "TourPaxOptions"("tourId");
CREATE INDEX IF NOT EXISTS idx_tour_slots_tour_id ON "TourSlots"("tourId");
CREATE INDEX IF NOT EXISTS idx_tour_bookings_tour_id ON "TourBookings"("tourId");
CREATE INDEX IF NOT EXISTS idx_tour_bookings_status ON "TourBookings"(status);
CREATE INDEX IF NOT EXISTS idx_agency_payout_requests_status ON "AgencyPayoutRequests"(status);
