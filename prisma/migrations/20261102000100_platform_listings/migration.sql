-- channel-listings and marketplace-publish: each product's listing per marketplace as the shop means
-- it, and the product's key features and barcode. Adds a table and columns; drops no data.

ALTER TABLE "Product"
    ADD COLUMN "keyFeatures" TEXT[] DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "barcode" TEXT,
    ADD CONSTRAINT "Product_key_features_check" CHECK (cardinality("keyFeatures") <= 5);

CREATE TABLE "PlatformListing" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "productId" TEXT,
    "familyId" TEXT,
    "channelListingId" TEXT,
    "overrides" JSONB NOT NULL DEFAULT '{}',
    "sent" JSONB,
    "sentAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "publishState" TEXT NOT NULL DEFAULT 'idle',
    "pending" JSONB,
    "publishedAt" TIMESTAMP(3),
    "checkCount" INTEGER NOT NULL DEFAULT 0,
    "nextCheckAt" TIMESTAMP(3),
    "checkedAt" TIMESTAMP(3),
    "issues" JSONB,
    "showing" JSONB,
    "live" BOOLEAN,
    "createMode" TEXT,
    "targetExternalId" TEXT,
    "marketplaceType" TEXT,
    "sku" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlatformListing_pkey" PRIMARY KEY ("id"),
    -- A listing is a product's or a family's own page, never both, never neither (marketplace-publish D7).
    CONSTRAINT "PlatformListing_subject_check" CHECK (("productId" IS NULL) <> ("familyId" IS NULL)),
    CONSTRAINT "PlatformListing_state_check" CHECK ("publishState" IN ('idle', 'sent', 'checking', 'attention', 'unanswered')),
    CONSTRAINT "PlatformListing_create_mode_check" CHECK ("createMode" IS NULL OR "createMode" IN ('offer', 'new')),
    CONSTRAINT "PlatformListing_version_check" CHECK ("version" >= 0 AND "checkCount" >= 0)
);

CREATE UNIQUE INDEX "PlatformListing_channelListingId_key" ON "PlatformListing"("channelListingId");
CREATE UNIQUE INDEX "PlatformListing_connectionId_productId_key" ON "PlatformListing"("connectionId", "productId");
CREATE UNIQUE INDEX "PlatformListing_connectionId_familyId_key" ON "PlatformListing"("connectionId", "familyId");
CREATE INDEX "PlatformListing_orgId_channel_idx" ON "PlatformListing"("orgId", "channel");
CREATE INDEX "PlatformListing_publishState_nextCheckAt_idx" ON "PlatformListing"("publishState", "nextCheckAt");

ALTER TABLE "PlatformListing" ADD CONSTRAINT "PlatformListing_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ChannelConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlatformListing" ADD CONSTRAINT "PlatformListing_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlatformListing" ADD CONSTRAINT "PlatformListing_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "ProductFamily"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlatformListing" ADD CONSTRAINT "PlatformListing_channelListingId_fkey" FOREIGN KEY ("channelListingId") REFERENCES "ChannelListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
