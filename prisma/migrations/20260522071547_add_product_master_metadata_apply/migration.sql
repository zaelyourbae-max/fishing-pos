-- DropForeignKey
ALTER TABLE "daily_closing_logs" DROP CONSTRAINT "daily_closing_logs_daily_closing_id_fkey";

-- AddForeignKey
ALTER TABLE "daily_closing_logs" ADD CONSTRAINT "daily_closing_logs_daily_closing_id_fkey" FOREIGN KEY ("daily_closing_id") REFERENCES "daily_closings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "sales_payment_proof_uploaded_by_id_payment_proof_uploaded_at_id" RENAME TO "sales_payment_proof_uploaded_by_id_payment_proof_uploaded_a_idx";
