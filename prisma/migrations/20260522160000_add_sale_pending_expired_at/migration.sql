ALTER TABLE "sales" ADD COLUMN "expired_at" TIMESTAMP(3);

CREATE INDEX "sales_transaction_status_payment_status_expired_at_idx"
  ON "sales"("transaction_status", "payment_status", "expired_at");
