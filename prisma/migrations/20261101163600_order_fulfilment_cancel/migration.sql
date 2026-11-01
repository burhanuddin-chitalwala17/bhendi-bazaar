-- order-fulfilment unit 5: cancellation's records (docs/specs/own-store/order-fulfilment/trd.md
-- D13, D14, D16). Additive: three new tables, one seeded row, one partial index; nothing existing
-- is changed or dropped.

-- CreateEnum
CREATE TYPE "RefundState" AS ENUM ('OWED', 'REQUESTED', 'STARTED', 'UNCONFIRMED', 'FAILED');

-- D13: one budget release per parcel and offer, or per order and offer on expiry.
CREATE TABLE "PromotionBudgetRelease" (
    "id" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "shipmentId" TEXT,
    "amountPaise" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromotionBudgetRelease_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PromotionBudgetRelease_amount_positive" CHECK ("amountPaise" > 0)
);

-- D14: the fee, one row, edited without a deploy.
CREATE TABLE "FulfilmentSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "cancellationFeePaise" INTEGER NOT NULL DEFAULT 5000,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updatedByName" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FulfilmentSettings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FulfilmentSettings_one_row" CHECK ("id" = 'default'),
    CONSTRAINT "FulfilmentSettings_fee_range" CHECK ("cancellationFeePaise" BETWEEN 0 AND 100000)
);

-- D16: the refund one parcel is owed.
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "cause" TEXT NOT NULL,
    "state" "RefundState" NOT NULL DEFAULT 'OWED',
    "gatewayRefundId" TEXT,
    "failureReason" TEXT,
    "requestedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Refund_amount_positive" CHECK ("amountPaise" > 0)
);

CREATE INDEX "PromotionBudgetRelease_orderId_idx" ON "PromotionBudgetRelease"("orderId");
CREATE INDEX "PromotionBudgetRelease_promotionId_idx" ON "PromotionBudgetRelease"("promotionId");
CREATE UNIQUE INDEX "PromotionBudgetRelease_shipmentId_promotionId_key" ON "PromotionBudgetRelease"("shipmentId", "promotionId");
-- An expiry's release has no parcel; Postgres treats nulls as distinct, so it needs its own key.
CREATE UNIQUE INDEX "PromotionBudgetRelease_order_orderId_promotionId_key" ON "PromotionBudgetRelease"("orderId", "promotionId") WHERE "shipmentId" IS NULL;

CREATE UNIQUE INDEX "Refund_shipmentId_key" ON "Refund"("shipmentId");
CREATE INDEX "Refund_state_createdAt_idx" ON "Refund"("state", "createdAt");
CREATE INDEX "Refund_orderId_idx" ON "Refund"("orderId");

-- One fee per parcel: a repeated cancel, or two racing, charges the shop once (D14).
CREATE UNIQUE INDEX "OrgLedgerEntry_fee_shipmentId_key" ON "OrgLedgerEntry"("shipmentId") WHERE "kind" = 'CANCELLATION_FEE';

ALTER TABLE "PromotionBudgetRelease" ADD CONSTRAINT "PromotionBudgetRelease_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromotionBudgetRelease" ADD CONSTRAINT "PromotionBudgetRelease_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromotionBudgetRelease" ADD CONSTRAINT "PromotionBudgetRelease_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The owner's fee (Q20): ₹50. Reference data production needs, so it ships here, not in the seed.
INSERT INTO "FulfilmentSettings" ("id", "cancellationFeePaise", "version", "updatedAt")
VALUES ('default', 5000, 0, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
