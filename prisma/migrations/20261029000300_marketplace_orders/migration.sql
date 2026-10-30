-- inventory-sync D4, D8, ADR-0044: each marketplace order line, recorded once, with the stock it took,
-- whether it was oversold and its restock. Adds a table only; drops nothing.

CREATE TABLE "MarketplaceOrder" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "listingId" TEXT,
    "productId" TEXT,
    "locationExternalId" TEXT,
    "orgAddressId" TEXT,
    "locationGuessed" BOOLEAN NOT NULL DEFAULT false,
    "quantity" INTEGER NOT NULL,
    "taken" INTEGER NOT NULL DEFAULT 0,
    "oversold" BOOLEAN NOT NULL DEFAULT false,
    "amountPaise" INTEGER,
    "state" TEXT NOT NULL,
    "restockedAt" TIMESTAMP(3),
    "orderedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketplaceOrder_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MarketplaceOrder_quantity_check" CHECK ("quantity" > 0 AND "taken" >= 0 AND "taken" <= "quantity"),
    CONSTRAINT "MarketplaceOrder_amount_check" CHECK ("amountPaise" IS NULL OR "amountPaise" >= 0),
    CONSTRAINT "MarketplaceOrder_state_check" CHECK ("state" IN ('open', 'cancelled', 'shipped'))
);

CREATE UNIQUE INDEX "MarketplaceOrder_connectionId_orderId_lineId_key" ON "MarketplaceOrder"("connectionId", "orderId", "lineId");
CREATE INDEX "MarketplaceOrder_orgId_orderedAt_idx" ON "MarketplaceOrder"("orgId", "orderedAt");
CREATE INDEX "MarketplaceOrder_productId_idx" ON "MarketplaceOrder"("productId");
