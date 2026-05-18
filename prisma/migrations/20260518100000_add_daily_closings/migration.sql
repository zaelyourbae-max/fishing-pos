CREATE TABLE "daily_closings" (
  "id" TEXT NOT NULL,
  "closing_date" DATE NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "expected_cash" INTEGER NOT NULL DEFAULT 0,
  "actual_cash" INTEGER NOT NULL DEFAULT 0,
  "difference" INTEGER NOT NULL DEFAULT 0,
  "gross_omzet" INTEGER NOT NULL DEFAULT 0,
  "net_omzet" INTEGER NOT NULL DEFAULT 0,
  "transaction_count" INTEGER NOT NULL DEFAULT 0,
  "payment_summary" JSONB,
  "return_value" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "closed_at" TIMESTAMP(3),
  "closed_by_id" INTEGER,
  "reopened_at" TIMESTAMP(3),
  "reopened_by_id" INTEGER,
  "reopen_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "daily_closings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "daily_closing_logs" (
  "id" TEXT NOT NULL,
  "daily_closing_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "reason" TEXT,
  "note" TEXT,
  "user_id" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "daily_closing_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "daily_closings_closing_date_key" ON "daily_closings"("closing_date");
CREATE INDEX "daily_closings_closing_date_status_idx" ON "daily_closings"("closing_date", "status");
CREATE INDEX "daily_closings_closed_by_id_closed_at_idx" ON "daily_closings"("closed_by_id", "closed_at");
CREATE INDEX "daily_closings_reopened_by_id_reopened_at_idx" ON "daily_closings"("reopened_by_id", "reopened_at");
CREATE INDEX "daily_closing_logs_daily_closing_id_created_at_idx" ON "daily_closing_logs"("daily_closing_id", "created_at");
CREATE INDEX "daily_closing_logs_action_created_at_idx" ON "daily_closing_logs"("action", "created_at");
CREATE INDEX "daily_closing_logs_user_id_created_at_idx" ON "daily_closing_logs"("user_id", "created_at");

ALTER TABLE "daily_closings"
  ADD CONSTRAINT "daily_closings_closed_by_id_fkey"
  FOREIGN KEY ("closed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "daily_closings"
  ADD CONSTRAINT "daily_closings_reopened_by_id_fkey"
  FOREIGN KEY ("reopened_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "daily_closing_logs"
  ADD CONSTRAINT "daily_closing_logs_daily_closing_id_fkey"
  FOREIGN KEY ("daily_closing_id") REFERENCES "daily_closings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "daily_closing_logs"
  ADD CONSTRAINT "daily_closing_logs_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
