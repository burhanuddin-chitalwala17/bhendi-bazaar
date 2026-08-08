-- payment-confirmation (ADR-0005): the order remembers which gateway order it is
-- being charged through, so a confirmation can match the two — and the sweep can ask
-- the gateway about orders stuck pending. Purely additive.

ALTER TABLE "Order" ADD COLUMN "gatewayOrderId" TEXT;

CREATE INDEX "Order_paymentStatus_createdAt_idx" ON "Order"("paymentStatus", "createdAt");
CREATE INDEX "Order_gatewayOrderId_idx" ON "Order"("gatewayOrderId");
