-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "archived_at" TIMESTAMP(3),
ADD COLUMN     "exported_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "sales_archived_at_createdAt_idx" ON "sales"("archived_at", "createdAt");
