-- Additive product master data fields (non-destructive)
ALTER TABLE "products"
ADD COLUMN "brand" TEXT,
ADD COLUMN "type" TEXT,
ADD COLUMN "size" TEXT,
ADD COLUMN "variant" TEXT,
ADD COLUMN "rack_location" TEXT;
