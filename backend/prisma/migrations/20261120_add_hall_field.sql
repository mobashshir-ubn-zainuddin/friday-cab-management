-- Add hall of residence field to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "hall" TEXT;
