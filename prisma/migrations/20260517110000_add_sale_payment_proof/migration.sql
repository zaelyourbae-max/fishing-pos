ALTER TABLE "sales"
ADD COLUMN IF NOT EXISTS "payment_proof_url" TEXT,
ADD COLUMN IF NOT EXISTS "payment_proof_uploaded_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "payment_proof_uploaded_by_id" INTEGER;

DO $$ BEGIN
  ALTER TABLE "sales"
  ADD CONSTRAINT "sales_payment_proof_uploaded_by_id_fkey"
  FOREIGN KEY ("payment_proof_uploaded_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "sales_payment_proof_uploaded_by_id_payment_proof_uploaded_at_idx"
ON "sales"("payment_proof_uploaded_by_id", "payment_proof_uploaded_at");
