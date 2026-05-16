-- CreateTable
CREATE TABLE "message_logs" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_phone" TEXT,
    "target_name" TEXT,
    "status" TEXT NOT NULL,
    "provider" TEXT,
    "related_sale_id" TEXT,
    "payload" JSONB,
    "error_message" TEXT,
    "created_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "message_logs_type_status_created_at_idx" ON "message_logs"("type", "status", "created_at");

-- CreateIndex
CREATE INDEX "message_logs_target_type_created_at_idx" ON "message_logs"("target_type", "created_at");

-- CreateIndex
CREATE INDEX "message_logs_related_sale_id_created_at_idx" ON "message_logs"("related_sale_id", "created_at");

-- CreateIndex
CREATE INDEX "message_logs_created_by_id_created_at_idx" ON "message_logs"("created_by_id", "created_at");

-- AddForeignKey
ALTER TABLE "message_logs" ADD CONSTRAINT "message_logs_related_sale_id_fkey" FOREIGN KEY ("related_sale_id") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_logs" ADD CONSTRAINT "message_logs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
