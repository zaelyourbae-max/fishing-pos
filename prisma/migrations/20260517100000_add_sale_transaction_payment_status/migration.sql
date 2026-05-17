DO $$ BEGIN
  CREATE TYPE "TransactionStatus" AS ENUM ('SUCCESS', 'PENDING', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'WAITING_PROOF', 'PAID', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "sales"
ADD COLUMN IF NOT EXISTS "transaction_status" "TransactionStatus" NOT NULL DEFAULT 'SUCCESS',
ADD COLUMN IF NOT EXISTS "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PAID';

UPDATE "sales"
SET "payment_method" = UPPER("payment_method")
WHERE "payment_method" IN ('cash', 'qris', 'transfer');

ALTER TABLE "sales"
ALTER COLUMN "payment_method" SET DEFAULT 'CASH';

CREATE INDEX IF NOT EXISTS "sales_transaction_status_payment_status_createdAt_idx"
ON "sales"("transaction_status", "payment_status", "createdAt");
