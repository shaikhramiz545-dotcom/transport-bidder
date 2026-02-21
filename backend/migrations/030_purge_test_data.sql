-- 030_purge_test_data.sql
-- Clears all test data from PostgreSQL on next server startup.
-- Preserves: AdminSettings, AdminUsers, AdminRoles, schema_migrations (no code/config touched).
-- Runs once automatically via the startup migration runner.

SET session_replication_role = replica; -- disable FK checks temporarily

TRUNCATE TABLE "AppUsers"                 RESTART IDENTITY CASCADE;
TRUNCATE TABLE "EmailOtps"                RESTART IDENTITY CASCADE;
TRUNCATE TABLE "DriverVerifications"      RESTART IDENTITY CASCADE;
TRUNCATE TABLE "DriverDocuments"          RESTART IDENTITY CASCADE;
TRUNCATE TABLE "DriverVerificationAudits" RESTART IDENTITY CASCADE;
TRUNCATE TABLE "DriverIdentities"         RESTART IDENTITY CASCADE;
TRUNCATE TABLE "DriverWallets"            RESTART IDENTITY CASCADE;
TRUNCATE TABLE "WalletTransactions"       RESTART IDENTITY CASCADE;
TRUNCATE TABLE "WalletLedgers"            RESTART IDENTITY CASCADE;
TRUNCATE TABLE "rides"                    RESTART IDENTITY CASCADE;
TRUNCATE TABLE "messages"                 RESTART IDENTITY CASCADE;
TRUNCATE TABLE "TourBookings"             RESTART IDENTITY CASCADE;
TRUNCATE TABLE "TourReviews"              RESTART IDENTITY CASCADE;
TRUNCATE TABLE "TourSlots"                RESTART IDENTITY CASCADE;
TRUNCATE TABLE "TourPaxOptions"           RESTART IDENTITY CASCADE;
TRUNCATE TABLE "Tours"                    RESTART IDENTITY CASCADE;
TRUNCATE TABLE "AgencyDocuments"          RESTART IDENTITY CASCADE;
TRUNCATE TABLE "AgencyWallets"            RESTART IDENTITY CASCADE;
TRUNCATE TABLE "AgencyPayoutRequests"     RESTART IDENTITY CASCADE;
TRUNCATE TABLE "TravelAgencies"           RESTART IDENTITY CASCADE;
TRUNCATE TABLE "users"                    RESTART IDENTITY CASCADE;

SET session_replication_role = DEFAULT; -- re-enable FK checks
