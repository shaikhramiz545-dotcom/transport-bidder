-- Add name and department columns to AdminUsers table for team management
ALTER TABLE "AdminUsers" ADD COLUMN IF NOT EXISTS "name" VARCHAR(255);
ALTER TABLE "AdminUsers" ADD COLUMN IF NOT EXISTS "department" VARCHAR(255);
