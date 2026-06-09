-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "archived_sales_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "archived_sales_spend" INTEGER NOT NULL DEFAULT 0;
