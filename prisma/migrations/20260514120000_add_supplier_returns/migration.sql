-- Add clear customer/supplier return separation without touching existing transaction data.

ALTER TABLE "sale_returns"
ADD COLUMN IF NOT EXISTS "return_type" TEXT NOT NULL DEFAULT 'CUSTOMER_RETURN';

ALTER TABLE "suppliers"
ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'SUPPLIER';

CREATE TABLE IF NOT EXISTS "supplier_returns" (
  "id" TEXT NOT NULL,
  "return_number" TEXT NOT NULL,
  "supplier_id" INTEGER NOT NULL,
  "created_by_id" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "notes" TEXT,
  "total_amount" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'COMPLETED',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "supplier_returns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "supplier_return_items" (
  "id" TEXT NOT NULL,
  "supplier_return_id" TEXT NOT NULL,
  "product_id" INTEGER NOT NULL,
  "qty" INTEGER NOT NULL,
  "cost_price" INTEGER NOT NULL,
  "subtotal" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "supplier_return_items_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "stock_movements"
ADD COLUMN IF NOT EXISTS "supplier_return_id" TEXT,
ADD COLUMN IF NOT EXISTS "supplier_return_item_id" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "supplier_returns_return_number_key"
ON "supplier_returns"("return_number");

CREATE INDEX IF NOT EXISTS "sale_returns_return_type_created_at_idx"
ON "sale_returns"("return_type", "created_at");

CREATE INDEX IF NOT EXISTS "suppliers_type_is_active_idx"
ON "suppliers"("type", "is_active");

CREATE INDEX IF NOT EXISTS "supplier_returns_supplier_id_created_at_idx"
ON "supplier_returns"("supplier_id", "created_at");

CREATE INDEX IF NOT EXISTS "supplier_returns_created_by_id_created_at_idx"
ON "supplier_returns"("created_by_id", "created_at");

CREATE INDEX IF NOT EXISTS "supplier_returns_status_created_at_idx"
ON "supplier_returns"("status", "created_at");

CREATE INDEX IF NOT EXISTS "supplier_return_items_supplier_return_id_idx"
ON "supplier_return_items"("supplier_return_id");

CREATE INDEX IF NOT EXISTS "supplier_return_items_product_id_idx"
ON "supplier_return_items"("product_id");

CREATE INDEX IF NOT EXISTS "stock_movements_supplier_return_id_idx"
ON "stock_movements"("supplier_return_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'supplier_returns_supplier_id_fkey'
  ) THEN
    ALTER TABLE "supplier_returns"
    ADD CONSTRAINT "supplier_returns_supplier_id_fkey"
    FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'supplier_returns_created_by_id_fkey'
  ) THEN
    ALTER TABLE "supplier_returns"
    ADD CONSTRAINT "supplier_returns_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'supplier_return_items_supplier_return_id_fkey'
  ) THEN
    ALTER TABLE "supplier_return_items"
    ADD CONSTRAINT "supplier_return_items_supplier_return_id_fkey"
    FOREIGN KEY ("supplier_return_id") REFERENCES "supplier_returns"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'supplier_return_items_product_id_fkey'
  ) THEN
    ALTER TABLE "supplier_return_items"
    ADD CONSTRAINT "supplier_return_items_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_movements_supplier_return_id_fkey'
  ) THEN
    ALTER TABLE "stock_movements"
    ADD CONSTRAINT "stock_movements_supplier_return_id_fkey"
    FOREIGN KEY ("supplier_return_id") REFERENCES "supplier_returns"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_movements_supplier_return_item_id_fkey'
  ) THEN
    ALTER TABLE "stock_movements"
    ADD CONSTRAINT "stock_movements_supplier_return_item_id_fkey"
    FOREIGN KEY ("supplier_return_item_id") REFERENCES "supplier_return_items"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
