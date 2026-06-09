-- CreateIndex
CREATE INDEX "products_isActive_stock_idx" ON "products"("isActive", "stock");

-- CreateIndex
CREATE INDEX "purchases_created_at_idx" ON "purchases"("created_at");

-- CreateIndex
CREATE INDEX "supplier_returns_created_at_idx" ON "supplier_returns"("created_at");
