-- CreateEnum
CREATE TYPE "ChannelMapFit" AS ENUM ('EXACT', 'NEAREST');

-- CreateTable
CREATE TABLE "OrgChannel" (
    "orgId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgChannel_pkey" PRIMARY KEY ("orgId","channel")
);

-- CreateTable
CREATE TABLE "ChannelCategoryMap" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "productType" TEXT NOT NULL,
    "kind" TEXT,
    "theirCategory" TEXT NOT NULL,
    "theirLabel" TEXT,
    "fit" "ChannelMapFit" NOT NULL DEFAULT 'EXACT',
    "note" TEXT,
    "checkedOn" TIMESTAMP(3) NOT NULL,
    "checkedSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelCategoryMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelAttributeMap" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "productType" TEXT NOT NULL,
    "fact" TEXT NOT NULL,
    "theirAttribute" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "checkedOn" TIMESTAMP(3) NOT NULL,
    "checkedSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelAttributeMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelValueMap" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "list" TEXT NOT NULL,
    "valueKey" TEXT NOT NULL,
    "theirValue" TEXT NOT NULL,
    "checkedOn" TIMESTAMP(3) NOT NULL,
    "checkedSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelValueMap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrgChannel_channel_idx" ON "OrgChannel"("channel");

-- CreateIndex
CREATE INDEX "ChannelCategoryMap_channel_idx" ON "ChannelCategoryMap"("channel");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelCategoryMap_channel_productType_kind_key" ON "ChannelCategoryMap"("channel", "productType", "kind");

-- CreateIndex
CREATE INDEX "ChannelAttributeMap_channel_idx" ON "ChannelAttributeMap"("channel");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelAttributeMap_channel_productType_fact_key" ON "ChannelAttributeMap"("channel", "productType", "fact");

-- CreateIndex
CREATE INDEX "ChannelValueMap_channel_list_idx" ON "ChannelValueMap"("channel", "list");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelValueMap_channel_list_valueKey_key" ON "ChannelValueMap"("channel", "list", "valueKey");

-- AddForeignKey
ALTER TABLE "OrgChannel" ADD CONSTRAINT "OrgChannel_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A unique index does not constrain rows whose column is NULL, so the index above lets a channel
-- and product type have two mappings whose `kind` is null — two answers to "which node does an
-- untyped product of this type publish to", with nothing to choose between them. Postgres says
-- the rule as a partial index, which Prisma's schema language cannot declare, so it lives here
-- and `tests/integration/channel-registry.test.ts` is what keeps it honest.
CREATE UNIQUE INDEX "ChannelCategoryMap_channel_productType_allkinds_key"
  ON "ChannelCategoryMap" ("channel", "productType")
  WHERE "kind" IS NULL;
