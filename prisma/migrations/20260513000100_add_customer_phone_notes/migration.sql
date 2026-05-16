-- AlterTable
ALTER TABLE "customers" ADD COLUMN "notes" TEXT;

-- Normalize existing Indonesian phone numbers before enforcing uniqueness.
UPDATE "customers"
SET "phone" = CASE
    WHEN regexp_replace(COALESCE("phone", ''), '[^0-9]', '', 'g') = '' THEN NULL
    WHEN regexp_replace("phone", '[^0-9]', '', 'g') LIKE '0%' THEN '62' || substring(regexp_replace("phone", '[^0-9]', '', 'g') from 2)
    WHEN regexp_replace("phone", '[^0-9]', '', 'g') LIKE '62%' THEN regexp_replace("phone", '[^0-9]', '', 'g')
    ELSE regexp_replace("phone", '[^0-9]', '', 'g')
END;

-- Replace the old non-unique lookup index with the unique customer identifier.
DROP INDEX IF EXISTS "customers_phone_idx";
CREATE UNIQUE INDEX "customers_phone_key" ON "customers"("phone");
