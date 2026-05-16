ALTER TABLE "purchases" ADD COLUMN "total" INTEGER NOT NULL DEFAULT 0;

UPDATE "purchases"
SET "total" = "subtotal";
