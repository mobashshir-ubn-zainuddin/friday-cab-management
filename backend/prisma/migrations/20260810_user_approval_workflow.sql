-- ================================================================
-- Cab Management System: User Admin Approval Workflow
-- Apply this migration to PostgreSQL BEFORE deploying code changes.
-- Existing users are NOT modified; all will default to APPROVED via
-- the column default. New users will default to PENDING (changed in
-- application logic at INSERT time).
-- ================================================================

BEGIN;

-- 1. Create enum type for approval status
CREATE TYPE "UserApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- 2. Add new columns on "User" table.
--    DEFAULT 'APPROVED' on the column guarantees every EXISTING row
--    instantly has APPROVED status, without needing an UPDATE backfill.
ALTER TABLE "User"
    ADD COLUMN "approvalStatus" "UserApprovalStatus" NOT NULL DEFAULT 'APPROVED',
    ADD COLUMN "approvalReviewedAt" TIMESTAMP(3),
    ADD COLUMN "approvalReviewedBy" TEXT,
    ADD COLUMN "rejectionReason"      TEXT;

-- 3. (Optional) For NEW signups going forward we want PENDING to be
--    the default at the DB level too. But our application code
--    (POST /auth/signup) explicitly sets approvalStatus='PENDING' for
--    non-admin new users, so changing the default here is optional.
--    If you want a belt-and-suspenders approach, uncomment:
-- ALTER TABLE "User" ALTER COLUMN "approvalStatus" SET DEFAULT 'PENDING';

-- 4. Index on the new status column for fast admin pending-list queries
CREATE INDEX IF NOT EXISTS "User_approvalStatus_idx" ON "User"("approvalStatus");

COMMIT;
