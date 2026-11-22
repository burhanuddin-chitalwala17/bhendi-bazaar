-- unmatched-payments D3: a refund owed for a payment captured after its order was released has no parcel.
ALTER TABLE "Refund" ALTER COLUMN "shipmentId" DROP NOT NULL;
ALTER TABLE "Refund" ADD COLUMN "gatewayPaymentId" TEXT;
CREATE UNIQUE INDEX "Refund_gatewayPaymentId_key" ON "Refund"("gatewayPaymentId");
