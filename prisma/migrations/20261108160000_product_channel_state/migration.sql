-- listing-model/dynamic-form unit 2 (D3, R4): each product's completeness per channel the shop sells on, stored by
-- the refresh job. One new table; nothing existing changes.

-- CreateTable
CREATE TABLE "ProductChannelState" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "required" INTEGER NOT NULL,
    "missing" INTEGER NOT NULL,
    "missingKeys" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductChannelState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductChannelState_orgId_channel_idx" ON "ProductChannelState"("orgId", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "ProductChannelState_productId_channel_key" ON "ProductChannelState"("productId", "channel");

-- AddForeignKey
ALTER TABLE "ProductChannelState" ADD CONSTRAINT "ProductChannelState_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

