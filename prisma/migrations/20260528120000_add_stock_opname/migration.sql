-- CreateEnum
CREATE TYPE "StockOpnameStatus" AS ENUM ('DRAFT', 'COUNTING', 'REVIEW', 'APPROVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StockOpnameMode" AS ENUM ('IMPORT_EXCEL', 'MANUAL');

-- AlterTable
ALTER TABLE "stock_movements"
ADD COLUMN "stock_opname_session_id" TEXT,
ADD COLUMN "stock_opname_item_id" TEXT;

-- CreateTable
CREATE TABLE "stock_opname_sessions" (
    "id" TEXT NOT NULL,
    "opname_number" TEXT NOT NULL,
    "mode" "StockOpnameMode" NOT NULL DEFAULT 'IMPORT_EXCEL',
    "status" "StockOpnameStatus" NOT NULL DEFAULT 'COUNTING',
    "title" TEXT,
    "notes" TEXT,
    "snapshot_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "approved_by_id" INTEGER,
    "cancelled_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "approved_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancel_reason" TEXT,

    CONSTRAINT "stock_opname_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_opname_items" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "product_id" INTEGER NOT NULL,
    "product_sku_snapshot" TEXT,
    "barcode_snapshot" TEXT,
    "product_name_snapshot" TEXT NOT NULL,
    "category_snapshot" TEXT,
    "unit_snapshot" TEXT,
    "rack_location_snapshot" TEXT,
    "system_stock" INTEGER NOT NULL,
    "physical_stock" INTEGER,
    "difference" INTEGER,
    "notes" TEXT,
    "counted_by_id" INTEGER,
    "counted_at" TIMESTAMP(3),
    "source" TEXT,
    "approval_stock_before" INTEGER,
    "approval_stock_after" INTEGER,
    "approval_delta" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_opname_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stock_opname_sessions_opname_number_key" ON "stock_opname_sessions"("opname_number");

-- CreateIndex
CREATE INDEX "stock_opname_sessions_status_created_at_idx" ON "stock_opname_sessions"("status", "created_at");

-- CreateIndex
CREATE INDEX "stock_opname_sessions_created_by_id_created_at_idx" ON "stock_opname_sessions"("created_by_id", "created_at");

-- CreateIndex
CREATE INDEX "stock_opname_sessions_approved_by_id_approved_at_idx" ON "stock_opname_sessions"("approved_by_id", "approved_at");

-- CreateIndex
CREATE UNIQUE INDEX "stock_opname_items_session_id_product_id_key" ON "stock_opname_items"("session_id", "product_id");

-- CreateIndex
CREATE INDEX "stock_opname_items_session_id_idx" ON "stock_opname_items"("session_id");

-- CreateIndex
CREATE INDEX "stock_opname_items_product_id_idx" ON "stock_opname_items"("product_id");

-- CreateIndex
CREATE INDEX "stock_opname_items_counted_by_id_counted_at_idx" ON "stock_opname_items"("counted_by_id", "counted_at");

-- CreateIndex
CREATE INDEX "stock_movements_stock_opname_session_id_idx" ON "stock_movements"("stock_opname_session_id");

-- CreateIndex
CREATE INDEX "stock_movements_stock_opname_item_id_idx" ON "stock_movements"("stock_opname_item_id");

-- AddForeignKey
ALTER TABLE "stock_opname_sessions" ADD CONSTRAINT "stock_opname_sessions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_opname_sessions" ADD CONSTRAINT "stock_opname_sessions_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_opname_sessions" ADD CONSTRAINT "stock_opname_sessions_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_opname_items" ADD CONSTRAINT "stock_opname_items_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "stock_opname_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_opname_items" ADD CONSTRAINT "stock_opname_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_opname_items" ADD CONSTRAINT "stock_opname_items_counted_by_id_fkey" FOREIGN KEY ("counted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_stock_opname_session_id_fkey" FOREIGN KEY ("stock_opname_session_id") REFERENCES "stock_opname_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_stock_opname_item_id_fkey" FOREIGN KEY ("stock_opname_item_id") REFERENCES "stock_opname_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
