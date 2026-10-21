-- The listings a shop has on a connected marketplace, and the progress of reading them
-- (docs/specs/marketplace-integration/channel-import, TRD D1, D2). No data is dropped.

ALTER TABLE "ChannelConnection"
    ADD COLUMN "readState" TEXT,
    ADD COLUMN "readTotal" INTEGER,
    ADD COLUMN "readDone" INTEGER,
    ADD COLUMN "readStartedAt" TIMESTAMP(3),
    ADD COLUMN "readFinishedAt" TIMESTAMP(3),
    ADD COLUMN "readTouchedAt" TIMESTAMP(3),
    ADD COLUMN "readErrorCode" TEXT,
    ADD CONSTRAINT "ChannelConnection_readState_check" CHECK ("readState" IS NULL OR "readState" IN ('RUNNING', 'DONE', 'STOPPED'));

CREATE TABLE "ChannelListing" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "skuKey" TEXT NOT NULL,
    "externalId" TEXT,
    "title" TEXT,
    "imageUrl" TEXT,
    "status" TEXT,
    "pricePaise" INTEGER,
    "quantity" INTEGER,
    "parentSku" TEXT,
    "parentTitle" TEXT,
    "variationAxis" TEXT,
    "productId" TEXT,
    "linkSource" TEXT,
    "linkedAt" TIMESTAMP(3),
    "unlinkedAt" TIMESTAMP(3),
    "unlinkedById" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "goneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelListing_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ChannelListing_status_check" CHECK ("status" IS NULL OR "status" IN ('LIVE', 'INACTIVE', 'INCOMPLETE')),
    CONSTRAINT "ChannelListing_linkSource_check" CHECK ("linkSource" IS NULL OR "linkSource" IN ('SKU', 'OWNER')),
    -- A link names how it was made, and only a linked row says so.
    CONSTRAINT "ChannelListing_link_check" CHECK (("productId" IS NULL) = ("linkSource" IS NULL)),
    CONSTRAINT "ChannelListing_money_check" CHECK ("pricePaise" IS NULL OR "pricePaise" >= 0),
    CONSTRAINT "ChannelListing_quantity_check" CHECK ("quantity" IS NULL OR "quantity" >= 0)
);

CREATE UNIQUE INDEX "ChannelListing_connectionId_sku_key" ON "ChannelListing"("connectionId", "sku");
CREATE INDEX "ChannelListing_orgId_channel_idx" ON "ChannelListing"("orgId", "channel");
CREATE INDEX "ChannelListing_productId_idx" ON "ChannelListing"("productId");
CREATE INDEX "ChannelListing_orgId_skuKey_idx" ON "ChannelListing"("orgId", "skuKey");

ALTER TABLE "ChannelListing" ADD CONSTRAINT "ChannelListing_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ChannelConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChannelListing" ADD CONSTRAINT "ChannelListing_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
