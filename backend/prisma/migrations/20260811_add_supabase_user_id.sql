-- ================================================================
-- Cab Management System: Supabase Auth ID Mapping
-- This migration adds the supabaseUserId column to the User table
-- and updates the default approval status to PENDING.
-- ================================================================

BEGIN;

-- 1. Add supabaseUserId column
ALTER TABLE "User" ADD COLUMN "supabaseUserId" TEXT;

-- 2. Create unique index for supabaseUserId
CREATE UNIQUE INDEX "User_supabaseUserId_key" ON "User"("supabaseUserId");

-- 3. Set default approvalStatus to PENDING for new users
--    Existing users already have 'APPROVED' status from previous migration.
ALTER TABLE "User" ALTER COLUMN "approvalStatus" SET DEFAULT 'PENDING';

COMMIT;
