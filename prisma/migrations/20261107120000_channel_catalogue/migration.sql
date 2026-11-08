-- listing-model/channel-catalogue (D1, D6): each channel's own types and fields, read from the channel,
-- and the required fields a channel adds later. Three new tables; nothing existing changes.

-- CreateTable
CREATE TABLE "ChannelType" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "schema" JSONB,
    "schemaVersion" TEXT,
    "source" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL,
    "goneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelTypeChange" (
    "id" TEXT NOT NULL,
    "channelTypeId" TEXT NOT NULL,
    "added" JSONB NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelTypeChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelField" (
    "id" TEXT NOT NULL,
    "channelTypeId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "requirement" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "allowedValues" JSONB,
    "allowedUnits" JSONB,
    "adapterFills" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3) NOT NULL,
    "goneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelField_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChannelType_channel_key_key" ON "ChannelType"("channel", "key");

-- CreateIndex
CREATE INDEX "ChannelTypeChange_detectedAt_idx" ON "ChannelTypeChange"("detectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelField_channelTypeId_key_key" ON "ChannelField"("channelTypeId", "key");

-- AddForeignKey
ALTER TABLE "ChannelTypeChange" ADD CONSTRAINT "ChannelTypeChange_channelTypeId_fkey" FOREIGN KEY ("channelTypeId") REFERENCES "ChannelType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelField" ADD CONSTRAINT "ChannelField_channelTypeId_fkey" FOREIGN KEY ("channelTypeId") REFERENCES "ChannelType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

