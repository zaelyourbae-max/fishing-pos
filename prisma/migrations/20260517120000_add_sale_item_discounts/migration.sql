CREATE TYPE "SaleItemDiscountType" AS ENUM ('NONE', 'FIXED', 'PERCENT');

ALTER TABLE "sale_items"
ADD COLUMN IF NOT EXISTS "original_price" DECIMAL(12, 2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "discount_type" "SaleItemDiscountType" NOT NULL DEFAULT 'NONE',
ADD COLUMN IF NOT EXISTS "discount_value" DECIMAL(12, 2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "discount_amount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "subtotal_before_discount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "subtotal_after_discount" DECIMAL(12, 2) NOT NULL DEFAULT 0;

UPDATE "sale_items"
SET
  "original_price" = "price",
  "subtotal_before_discount" = "subtotal",
  "subtotal_after_discount" = "subtotal"
WHERE
  "original_price" = 0
  AND "subtotal_before_discount" = 0
  AND "subtotal_after_discount" = 0;
