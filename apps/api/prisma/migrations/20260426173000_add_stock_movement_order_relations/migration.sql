-- Purpose: link inventory audit rows to the order/order item that caused the movement.
-- Data impact: existing StockMovement rows remain valid with nullable order references.

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN "orderId" TEXT,
ADD COLUMN "orderItemId" TEXT;

-- CreateIndex
CREATE INDEX "StockMovement_orderId_createdAt_idx" ON "StockMovement"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_orderItemId_createdAt_idx" ON "StockMovement"("orderItemId", "createdAt");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
