-- order-fulfilment unit 4: the courier conflict list (docs/specs/own-store/order-fulfilment/trd.md D10, R8, A13).
-- Additive: one new table, nothing existing touched.

CREATE TABLE "CourierConflict" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "awb" TEXT NOT NULL,
    "shipmentId" TEXT,
    "parcelCode" TEXT,
    "courierWording" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "dismissedAt" TIMESTAMP(3),
    "dismissedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourierConflict_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CourierConflict_dismissedAt_createdAt_idx" ON "CourierConflict"("dismissedAt", "createdAt");
CREATE INDEX "CourierConflict_awb_idx" ON "CourierConflict"("awb");
