ALTER TABLE "sales"
  ADD COLUMN "subtotal_before_loyalty" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "loyalty_applied" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "loyalty_milestone" INTEGER,
  ADD COLUMN "loyalty_benefit_type" TEXT NOT NULL DEFAULT 'NONE',
  ADD COLUMN "loyalty_benefit_value" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "loyalty_discount_amount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "loyalty_benefit_note" TEXT;

UPDATE "sales"
SET "subtotal_before_loyalty" = "subtotal"
WHERE "subtotal_before_loyalty" = 0;

CREATE INDEX "sales_customer_id_loyalty_milestone_loyalty_applied_idx"
  ON "sales"("customer_id", "loyalty_milestone", "loyalty_applied");
