DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'RoomStatus' AND e.enumlabel = 'SELF_USE'
  ) THEN
    ALTER TYPE "RoomStatus" ADD VALUE 'SELF_USE';
  END IF;
END $$;

ALTER TABLE "DocumentVersion" ADD COLUMN IF NOT EXISTS "billingVersionId" TEXT;

CREATE INDEX IF NOT EXISTS "DocumentVersion_billingVersionId_idx" ON "DocumentVersion"("billingVersionId");

DELETE FROM "BillingVersion" bv
WHERE NOT EXISTS (SELECT 1 FROM "Room" r WHERE r."number" = bv."roomNumber")
   OR NOT EXISTS (SELECT 1 FROM "BillingMonth" bm WHERE bm."id" = bv."billingMonthId");

UPDATE "BillingVersion" bv
SET "revertedFromId" = NULL
WHERE "revertedFromId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "BillingVersion" p WHERE p."id" = bv."revertedFromId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BillingVersion_roomNumber_fkey') THEN
    ALTER TABLE "BillingVersion" ADD CONSTRAINT "BillingVersion_roomNumber_fkey"
      FOREIGN KEY ("roomNumber") REFERENCES "Room"("number") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BillingVersion_billingMonthId_fkey') THEN
    ALTER TABLE "BillingVersion" ADD CONSTRAINT "BillingVersion_billingMonthId_fkey"
      FOREIGN KEY ("billingMonthId") REFERENCES "BillingMonth"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BillingVersion_revertedFromId_fkey') THEN
    ALTER TABLE "BillingVersion" ADD CONSTRAINT "BillingVersion_revertedFromId_fkey"
      FOREIGN KEY ("revertedFromId") REFERENCES "BillingVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DocumentVersion_billingVersionId_fkey') THEN
    ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_billingVersionId_fkey"
      FOREIGN KEY ("billingVersionId") REFERENCES "BillingVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;