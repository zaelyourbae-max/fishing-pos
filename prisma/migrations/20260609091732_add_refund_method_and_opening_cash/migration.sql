-- AlterTable
ALTER TABLE "daily_closings" ADD COLUMN     "opening_cash" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "sale_returns" ADD COLUMN     "refund_method" TEXT NOT NULL DEFAULT 'CASH';
