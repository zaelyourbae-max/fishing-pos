-- CreateTable
CREATE TABLE "payment_methods" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_methods_code_key" ON "payment_methods"("code");

-- CreateIndex
CREATE INDEX "payment_methods_is_active_code_idx" ON "payment_methods"("is_active", "code");

-- CreateIndex
CREATE UNIQUE INDEX "payment_settings_key_key" ON "payment_settings"("key");

-- Seed default MVP payment methods
INSERT INTO "payment_methods" ("id", "code", "name", "type", "is_active", "created_at", "updated_at")
VALUES
  ('pm_cash_default', 'CASH', 'Cash', 'CASH', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('pm_transfer_default', 'TRANSFER', 'Transfer Bank', 'BANK_TRANSFER', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('pm_qris_default', 'QRIS', 'QRIS', 'QRIS', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
