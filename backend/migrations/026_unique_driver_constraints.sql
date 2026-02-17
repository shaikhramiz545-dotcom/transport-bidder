-- Add unique constraints to DriverVerifications table
-- for fraud prevention (prevent same DNI/License/Email re-registration)

DO $$
BEGIN
    -- Add unique constraint for DNI if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'driver_verifications_dni_key'
    ) THEN
        ALTER TABLE "DriverVerifications" ADD CONSTRAINT "driver_verifications_dni_key" UNIQUE ("dni");
    END IF;

    -- Add unique constraint for License if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'driver_verifications_license_key'
    ) THEN
        ALTER TABLE "DriverVerifications" ADD CONSTRAINT "driver_verifications_license_key" UNIQUE ("license");
    END IF;

    -- Add unique constraint for Email if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'driver_verifications_email_key'
    ) THEN
        ALTER TABLE "DriverVerifications" ADD CONSTRAINT "driver_verifications_email_key" UNIQUE ("email");
    END IF;

EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error adding constraints: %', SQLERRM;
END $$;
