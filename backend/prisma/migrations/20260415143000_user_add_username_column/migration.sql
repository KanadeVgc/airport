-- Fix drift: User table exists without `email` / `username` (e.g. manual table or partial setup)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "username" TEXT;

-- Backfill: e.g. name "Admin" + id "001" -> "admin_001" (you can rename in Studio to "admin")
UPDATE "User"
SET "username" = LOWER(COALESCE(NULLIF(TRIM("name"), ''), 'user') || '_' || "id")
WHERE "username" IS NULL OR TRIM("username") = '';

ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");
