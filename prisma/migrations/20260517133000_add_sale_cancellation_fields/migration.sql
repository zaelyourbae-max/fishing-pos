ALTER TABLE "sales"
ADD COLUMN IF NOT EXISTS "cancel_reason" TEXT,
ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "cancelled_by_id" INTEGER;

DO $$ BEGIN
  ALTER TABLE "sales"
  ADD CONSTRAINT "sales_cancelled_by_id_fkey"
  FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "sales_cancelled_by_id_cancelled_at_idx"
ON "sales"("cancelled_by_id", "cancelled_at");
